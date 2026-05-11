import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  notificationPreferencesQuery,
  upsertNotificationPreferences,
} from '@features/notifications/api/queries'
import { sendMatterEmailTest } from '@shared/email'

export default function ProfileMatterEmailSettings() {
  const qc = useQueryClient()
  const { companyId, company } = useCompany()
  const { success, error: toastError } = useToast()

  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
  })
  const userId = authUser?.id ?? ''

  const { data: prefs } = useQuery({
    ...notificationPreferencesQuery({
      userId,
      companyId: companyId ?? '',
    }),
    enabled: !!userId && !!companyId,
  })

  const [local, setLocal] = React.useState({
    email_matter_announcements: true,
    email_matter_updates: true,
    email_matter_invites: true,
  })

  React.useEffect(() => {
    if (prefs) {
      setLocal({
        email_matter_announcements:
          prefs.email_matter_announcements ?? prefs.email_announcements ?? true,
        email_matter_updates:
          prefs.email_matter_updates ?? prefs.email_matter_replies ?? true,
        email_matter_invites:
          prefs.email_matter_invites ?? prefs.email_crew_invites ?? true,
      })
    }
  }, [prefs])

  const save = useMutation({
    mutationFn: async () => {
      if (!userId || !companyId) throw new Error('Missing company')
      await upsertNotificationPreferences({
        user_id: userId,
        company_id: companyId,
        email_matter_announcements: local.email_matter_announcements,
        email_matter_updates: local.email_matter_updates,
        email_matter_invites: local.email_matter_invites,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['notification-preferences', userId, companyId],
      })
      success('Saved', 'Notification preferences updated')
    },
    onError: (e: any) => {
      toastError('Save failed', e?.message ?? 'Try again')
    },
  })

  const sendTest = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Missing company')
      const result = await sendMatterEmailTest({ companyId })
      if (!result.ok) {
        const msg = [result.failure.message, result.failure.details]
          .filter(Boolean)
          .join(' — ')
        throw new Error(msg || 'Could not send test email')
      }
      return result
    },
    onSuccess: () => {
      success(
        'Test email sent',
        'Check the inbox for the address on your Grid profile (and spam).',
      )
    },
    onError: (e: any) => {
      toastError('Test email failed', e?.message ?? 'Try again')
    },
  })

  if (!companyId) {
    return (
      <Card size="3">
        <Box p="4">
          <Text color="gray" size="2">
            Select a company to configure matter notifications.
          </Text>
        </Box>
      </Card>
    )
  }

  return (
    <Card size="3">
      <Box p="4">
        <Heading size="4" mb="2">
          Matter notifications
        </Heading>
        <Text size="2" color="gray" mb="4">
          Email alerts for matters involving{' '}
          <Text weight="medium">{company?.name ?? 'this company'}</Text>.
          Push notifications (PWA) will be added here later. In-app matters stay
          in the Matters inbox.
        </Text>
        <Flex align="center" gap="3" wrap="wrap" mb="4">
          <Button
            type="button"
            variant="soft"
            disabled={sendTest.isPending || !userId}
            onClick={() => sendTest.mutate()}
          >
            {sendTest.isPending ? 'Sending…' : 'Send test email'}
          </Button>
          <Text size="2" color="gray" style={{ flex: '1 1 200px' }}>
            Sends one message from Grid to your profile email so you can confirm
            delivery and spam-folder behavior.
          </Text>
        </Flex>
        <Separator size="4" mb="4" />
        <Flex direction="column" gap="4">
          <Row
            label="Announcements"
            description="Email when you receive company announcements"
            checked={local.email_matter_announcements}
            onCheckedChange={(v) =>
              setLocal((s) => ({ ...s, email_matter_announcements: v }))
            }
          />
          <Row
            label="Updates"
            description="Email for update matters: crew invite and offer responses to you as project lead, offer revisions, and activity on your Latest posts"
            checked={local.email_matter_updates}
            onCheckedChange={(v) =>
              setLocal((s) => ({ ...s, email_matter_updates: v }))
            }
          />
          <Row
            label="Invites"
            description="Email for crew invitations on jobs"
            checked={local.email_matter_invites}
            onCheckedChange={(v) =>
              setLocal((s) => ({ ...s, email_matter_invites: v }))
            }
          />
        </Flex>
        <Flex justify="end" mt="4">
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save preferences'}
          </Button>
        </Flex>
      </Box>
    </Card>
  )
}

function Row({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <Flex align="center" justify="between" gap="4" wrap="wrap">
      <Box style={{ flex: '1 1 220px', minWidth: 0 }}>
        <Text weight="medium">{label}</Text>
        <Text size="2" color="gray" style={{ display: 'block', marginTop: 4 }}>
          {description}
        </Text>
      </Box>
      <Switch
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
    </Flex>
  )
}
