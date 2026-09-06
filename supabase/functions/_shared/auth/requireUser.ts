import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5.9.6'
import type { User } from 'https://esm.sh/@supabase/supabase-js@2'

function unauthorized(
  jsonHeaders: Record<string, string>,
  details?: string,
): Response {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      ...(details ? { details } : {}),
    }),
    { status: 401, headers: jsonHeaders },
  )
}

function base64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4)
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const value = JSON.parse(json)
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Publishable/secret keys, or anon/service JWTs minted from API keys (no user `sub`). */
function isNonUserBearer(token: string): boolean {
  if (!token || token.startsWith('sb_')) return true
  const payload = base64UrlJson(token.split('.')[1] ?? '')
  if (!payload) return false
  const sub = payload.sub
  const role = payload.role
  if (typeof sub === 'string' && sub.length > 0) return false
  return role === 'anon' || role === 'service_role'
}

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function projectJwks(supabaseUrl: string) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`
  let jwks = jwksByUrl.get(url)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url))
    jwksByUrl.set(url, jwks)
  }
  return jwks
}

/**
 * Resolve the calling user from Authorization: Bearer <user JWT>.
 * Verifies ES256/RS256 access tokens against the project's JWKS (local-safe).
 */
export async function requireUserFromBearer(params: {
  req: Request
  supabaseUrl: string
  anonKey: string
  corsHeaders?: Record<string, string>
}): Promise<
  | { ok: true; user: User; authHeader: string }
  | { ok: false; response: Response }
> {
  const jsonHeaders = {
    ...(params.corsHeaders ?? {}),
    'Content-Type': 'application/json',
  }

  const authHeader = params.req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: unauthorized(jsonHeaders) }
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (isNonUserBearer(token)) {
    return {
      ok: false,
      response: unauthorized(
        jsonHeaders,
        'Expected a signed-in user access token in Authorization (not an API key)',
      ),
    }
  }

  try {
    const { payload } = await jwtVerify(token, projectJwks(params.supabaseUrl))
    const sub = typeof payload.sub === 'string' ? payload.sub : null
    if (!sub) {
      return {
        ok: false,
        response: unauthorized(jsonHeaders, 'JWT missing sub claim'),
      }
    }

    const user = {
      id: sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      app_metadata:
        payload.app_metadata && typeof payload.app_metadata === 'object'
          ? (payload.app_metadata as User['app_metadata'])
          : {},
      user_metadata:
        payload.user_metadata && typeof payload.user_metadata === 'object'
          ? (payload.user_metadata as User['user_metadata'])
          : {},
      aud: typeof payload.aud === 'string' ? payload.aud : 'authenticated',
      created_at: '',
    } as User

    return { ok: true, user, authHeader }
  } catch (e) {
    // Fallback for legacy HS256 projects / missing JWKS: Auth /user.
    const userRes = await fetch(
      `${params.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: params.anonKey,
        },
      },
    )

    let authBody: {
      id?: string
      msg?: string
      message?: string
      error?: string
    } | null = null
    try {
      authBody = (await userRes.json()) as {
        id?: string
        msg?: string
        message?: string
        error?: string
      }
    } catch {
      authBody = null
    }

    if (userRes.ok && authBody?.id) {
      return { ok: true, user: authBody as User, authHeader }
    }

    const joseMsg = e instanceof Error ? e.message : String(e)
    const details =
      authBody?.msg ??
      authBody?.message ??
      authBody?.error ??
      (userRes.ok ? joseMsg : `${joseMsg}; Auth /user ${userRes.status}`)

    return { ok: false, response: unauthorized(jsonHeaders, details) }
  }
}
