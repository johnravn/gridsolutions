// src/app/routes/guards/RequireCap.tsx
import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthz } from '@shared/auth/useAuthz'
import { Flex, Spinner, Text } from '@radix-ui/themes'
import type { Capability } from '@shared/auth/permissions'

export default function RequireCap({
  need,
  children,
}: {
  need: Capability
  children: React.ReactNode
}) {
  const { loading, caps } = useAuthz()
  const navigate = useNavigate()
  const allowed = caps.has(need)

  React.useEffect(() => {
    if (loading || allowed) return
    void navigate({ to: '/dashboard', replace: true })
  }, [loading, allowed, navigate])

  if (loading || !allowed) {
    return (
      <Flex align="center" justify="center" style={{ height: '50vh' }}>
        <Flex align="center" gap="1">
          <Text>Thinking</Text>
          <Spinner size="2" />
        </Flex>
      </Flex>
    )
  }

  return <>{children}</>
}
