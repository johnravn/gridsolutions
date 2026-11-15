// src/features/legal/pages/TermsPrivacyPage.tsx
import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Separator,
} from '@radix-ui/themes'
import {
  AnimatedBackground,
  DEFAULT_GEOMETRIC_BACKGROUND_PRESET,
} from '@shared/ui/components/AnimatedBackground'
import {
  LEGAL_CLOSE_LABEL,
  LEGAL_PAGE_TITLE,
  LegalTermsBody,
} from '../content/termsPrivacy'
import { useLockDocumentScroll } from '../hooks/useLockDocumentScroll'
import type { LegalLang } from '../types'

export default function TermsPrivacyPage() {
  const [lang, setLang] = React.useState<LegalLang>('en')
  useLockDocumentScroll()

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 1,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <AnimatedBackground
        intensity={0.35}
        preset={DEFAULT_GEOMETRIC_BACKGROUND_PRESET}
      />
      <Card
        size="4"
        style={{
          width: '100%',
          maxWidth: 860,
          background: 'var(--gray-a2)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between" wrap="wrap" gap="3">
            <Heading size="7">{LEGAL_PAGE_TITLE[lang]}</Heading>
            <SegmentedControl.Root
              size="2"
              value={lang}
              onValueChange={(v) => setLang(v as LegalLang)}
            >
              <SegmentedControl.Item value="en">English</SegmentedControl.Item>
              <SegmentedControl.Item value="no">Norsk</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>

          <Separator size="4" />

          <Box
            style={{
              maxHeight: '70dvh',
              overflow: 'auto',
              paddingRight: 8,
            }}
          >
            <LegalTermsBody lang={lang} />
          </Box>

          <Separator size="4" />

          <Flex justify="end" gap="2">
            <Button highContrast asChild variant="solid">
              <Link to="/signup">{LEGAL_CLOSE_LABEL[lang]}</Link>
            </Button>
          </Flex>
        </Flex>
      </Card>
    </Box>
  )
}
