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
  Text,
} from '@radix-ui/themes'
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'

type Lang = 'en' | 'no'

export default function TermsPrivacyPage() {
  const [lang, setLang] = React.useState<Lang>('en')

  // Prevent body scroll and padding issues
  React.useEffect(() => {
    const originalStyle = {
      overflow: document.body.style.overflow,
      padding: document.body.style.padding,
      margin: document.body.style.margin,
    }
    const originalHtmlStyle = {
      overflow: document.documentElement.style.overflow,
      padding: document.documentElement.style.padding,
      margin: document.documentElement.style.margin,
    }

    document.body.style.overflow = 'hidden'
    document.body.style.padding = '0'
    document.body.style.margin = '0'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.padding = '0'
    document.documentElement.style.margin = '0'

    return () => {
      document.body.style.overflow = originalStyle.overflow
      document.body.style.padding = originalStyle.padding
      document.body.style.margin = originalStyle.margin
      document.documentElement.style.overflow = originalHtmlStyle.overflow
      document.documentElement.style.padding = originalHtmlStyle.padding
      document.documentElement.style.margin = originalHtmlStyle.margin
    }
  }, [])

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
      <AnimatedBackground intensity={0.1} shapeType="circles" speed={0.5} />
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
          {/* Header */}
          <Flex align="center" justify="between" wrap="wrap" gap="3">
            <Heading size="7">
              {lang === 'en' ? 'Terms & Privacy' : 'Vilkår & Personvern'}
            </Heading>
            <SegmentedControl.Root
              size="2"
              value={lang}
              onValueChange={(v) => setLang(v as Lang)}
            >
              <SegmentedControl.Item value="en">English</SegmentedControl.Item>
              <SegmentedControl.Item value="no">Norsk</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>

          <Separator size="4" />

          {/* Scrollable content (simple + reliable) */}
          <Box
            style={{
              maxHeight: '70dvh',
              overflow: 'auto',
              paddingRight: 8,
            }}
          >
            {lang === 'en' ? <EnglishContent /> : <NorwegianContent />}
          </Box>

          <Separator size="4" />

          <Flex justify="end" gap="2">
            <Button highContrast asChild variant="solid">
              <Link to="/signup">{lang === 'en' ? 'Close' : 'Lukk'}</Link>
            </Button>
          </Flex>
        </Flex>
      </Card>
    </Box>
  )
}

/* --------- Content helpers --------- */

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box mb="4">
      <Heading size="4" mb="2">
        {title}
      </Heading>
      <Text as="div" size="2" color="gray">
        {children}
      </Text>
    </Box>
  )
}

function EnglishContent() {
  return (
    <Box>
      <Section title="1. Introduction">
        By using this service (“Platform”), you agree to these Terms of Service
        and our Privacy Notice (collectively, “Terms”). If you do not agree, do
        not use the Platform.
      </Section>

      <Section title="2. Definitions">
        “We”, “us”, and “our” refer to the Platform operator. “You” means the
        account holder or authorized user. “Inventory” means equipment and
        stock. “Booking” means the allocation of crew and/or inventory to a job.
      </Section>

      <Section title="3. Accounts & Access">
        You must provide accurate information and keep your credentials secure.
        You are responsible for all activity under your account. We may suspend
        or terminate accounts that violate these Terms or applicable law.
      </Section>

      <Section title="4. Use of the Platform">
        You agree to use the Platform only for lawful business purposes.
        Reverse-engineering, scraping, or abusing rate limits is prohibited. We
        may update or discontinue features at any time.
      </Section>

      <Section title="5. Inventory & Crew Booking">
        The Platform helps plan availability and reservations. You are solely
        responsible for the correctness of entries, conflicts resolution,
        on-site safety, compliance, and honoring any contractual obligations.
      </Section>

      <Section title="6. Payments (if applicable)">
        If paid features are offered, fees and billing cycles will be shown at
        checkout or in your plan. Unpaid invoices may lead to account
        suspension. Taxes are your responsibility unless stated otherwise.
      </Section>

      <Section title="7. Data & Privacy">
        We process personal data to operate the Platform, improve services, and
        meet legal obligations. We retain data only as long as necessary. See
        the Privacy Notice below for details about categories, purposes,
        retention, and your rights.
      </Section>

      <Section title="8. Security">
        We use reasonable technical and organizational measures to protect data.
        No method of transmission or storage is 100% secure; you use the
        Platform at your own risk and must implement appropriate internal
        controls.
      </Section>

      <Section title="9. Confidentiality">
        You may process third-party data in the Platform. You are responsible
        for having a lawful basis and for honoring confidentiality commitments
        to your clients and crew.
      </Section>

      <Section title="10. Warranties & Liability">
        The Platform is provided “as is” and “as available”. To the maximum
        extent permitted by law, we disclaim all warranties and limit our
        liability for indirect, incidental, or consequential damages.
      </Section>

      <Section title="11. Termination">
        You may stop using the Platform at any time. We may terminate or suspend
        access for breach of these Terms or for legal reasons. Upon termination,
        your right to access the Platform ceases.
      </Section>

      <Section title="12. Governing Law">
        These Terms are governed by the laws of your principal place of
        business, unless mandatory local law requires otherwise. Disputes will
        be resolved by competent courts in that jurisdiction.
      </Section>

      <Section title="Privacy Notice (Summary)">
        We collect account and usage data to provide the Platform. Legal bases
        may include contract performance and legitimate interests. You may
        request access, correction, deletion, or portability where applicable.
        We may share data with processors (e.g., hosting, analytics) under data
        protection agreements. Contact us to exercise your rights.
      </Section>

      <Section title="Contact">
        If you have questions or requests, contact your administrator or our
        support team at privacy@example.com.
      </Section>
    </Box>
  )
}

function NorwegianContent() {
  return (
    <Box>
      <Section title="1. Innledning">
        Ved å bruke denne tjenesten («Plattformen») aksepterer du disse
        vilkårene og vår personvernerklæring (samlet «Vilkår»). Dersom du ikke
        samtykker, må du ikke bruke Plattformen.
      </Section>

      <Section title="2. Definisjoner">
        «Vi», «oss» og «vår» viser til plattformoperatøren. «Du» betyr
        kontoinnehaver eller autorisert bruker. «Inventar» betyr utstyr og
        lager. «Booking» betyr tildeling av mannskap og/eller inventar til et
        oppdrag.
      </Section>

      <Section title="3. Konto & Tilgang">
        Du må oppgi riktige opplysninger og holde innloggingsdetaljer sikre. Du
        er ansvarlig for all aktivitet på kontoen din. Vi kan suspendere eller
        avslutte kontoer som bryter Vilkårene eller gjeldende lav.
      </Section>

      <Section title="4. Bruk av Plattformen">
        Du skal kun bruke Plattformen til lovlige forretningsformål.
        Reverse-engineering, scraping eller misbruk av kapasitetsgrenser er
        forbudt. Vi kan oppdatere eller avvikle funksjoner når som helst.
      </Section>

      <Section title="5. Inventar & Mannskapsbooking">
        Plattformen hjelper med planlegging av tilgjengelighet og reservasjoner.
        Du er alene ansvarlig for riktigheten i registreringer, håndtering av
        konflikter, HMS på stedet, etterlevelse og oppfyllelse av kontrakter.
      </Section>

      <Section title="6. Betaling (dersom aktuelt)">
        Dersom betalte funksjoner tilbys, vil priser og faktureringssyklus
        fremgå ved kjøp eller i abonnementet. Manglende betaling kan føre til
        suspendering. Skatter og avgifter er ditt ansvar med mindre annet er
        angitt.
      </Section>

      <Section title="7. Data & Personvern">
        Vi behandler personopplysninger for å drive Plattformen, forbedre
        tjenestene og oppfylle lovkrav. Vi lagrer data kun så lenge det er
        nødvendig. Se sammendraget under for kategorier, formål, lagringstid og
        dine rettigheter.
      </Section>

      <Section title="8. Sikkerhet">
        Vi benytter rimelige tekniske og organisatoriske tiltak for å beskytte
        data. Ingen metode er 100 % sikker; du bruker Plattformen på eget ansvar
        og må ha hensiktsmessige interne kontroller.
      </Section>

      <Section title="9. Konfidensialitet">
        Du kan behandle tredjepartsdata i Plattformen. Du er ansvarlig for å ha
        gyldig behandlingsgrunnlag og etterleve konfidensialitetsforpliktelser
        overfor kunder og mannskap.
      </Section>

      <Section title="10. Ansvarsfraskrivelse & Ansvarsbegrensning">
        Plattformen leveres «som den er» og «som tilgjengelig». I den grad loven
        tillater, fraskriver vi oss garantier og begrenser ansvar for indirekte,
        tilfeldige eller følgeskader.
      </Section>

      <Section title="11. Opphør">
        Du kan slutte å bruke Plattformen når som helst. Vi kan avslutte eller
        suspendere tilgangen ved brudd på Vilkårene eller av rettslige grunner.
        Ved opphør opphører din rett til å bruke Plattformen.
      </Section>

      <Section title="12. Lovvalg">
        Vilkårene reguleres av lovene der virksomheten din er etablert, med
        mindre ufravikelig lokal rett krever noe annet. Tvister avgjøres av
        kompetent domstol i denne jurisdiksjonen.
      </Section>

      <Section title="Personvernerklæring (Sammendrag)">
        Vi samler inn konto- og bruksdata for å levere Plattformen.
        Behandlingsgrunnlag kan være oppfyllelse av avtale og berettiget
        interesse. Du kan be om innsyn, retting, sletting eller dataportabilitet
        der det gjelder. Vi kan dele data med databehandlere (f.eks. drift,
        analyse) under databehandleravtaler. Kontakt oss for å utøve dine
        rettigheter.
      </Section>

      <Section title="Kontakt">
        Ved spørsmål eller henvendelser, kontakt administrator eller vårt
        personvernteam på privacy@example.com.
      </Section>
    </Box>
  )
}
