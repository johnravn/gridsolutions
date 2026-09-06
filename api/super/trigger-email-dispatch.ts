/**
 * Super admin: manually trigger notification email dispatch.
 * POST /api/super/trigger-email-dispatch
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/shared/types/database.types.js'

export type TriggerEmailDispatchResult = {
  ok: true
  runId?: string | null
  scanned: number
  attempted: number
  sentOrProcessed: number
  errors: number
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const auth = req.headers?.authorization
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ')
      ? auth.slice(7)
      : null
  if (!bearer) {
    res.status(401).json({ error: 'Missing authorization' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    res.status(500).json({ error: 'Missing Supabase config' })
    return
  }

  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  })
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(bearer)
  if (authError || !user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }

  const serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('superuser')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    res.status(500).json({ error: profileError.message })
    return
  }
  if (!profile?.superuser) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/dispatch-notification-emails`
  try {
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        'x-trigger-source': 'manual',
      },
      body: JSON.stringify({ trigger_source: 'manual' }),
    })

    const body = (await response
      .json()
      .catch(() => ({}))) as TriggerEmailDispatchResult & {
      error?: string
      runId?: string | null
    }

    if (!response.ok) {
      res.status(response.status >= 400 ? response.status : 500).json({
        error: body.error ?? `Dispatch failed (${response.status})`,
        runId: body.runId ?? null,
      })
      return
    }

    res.status(200).json(body)
  } catch (e: unknown) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Dispatch failed',
    })
  }
}
