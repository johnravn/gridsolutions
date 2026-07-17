import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  BoxIso,
  Building,
  Calendar,
  Car,
  CheckCircle,
  GoogleDocs,
  Group,
  HomeSimple,
  Mail,
  Menu,
  Message,
  MoreVert,
  OpenInBrowser,
  Phone,
  ReportColumns,
  Safari,
  ShareIos,
  Shield,
  SmartphoneDevice,
  Sparks,
  User,
  Xmark,
} from 'iconoir-react'
import logoBlack from '@shared/assets/gridLogo/grid_logo_black.svg'
import logoWhite from '@shared/assets/gridLogo/grid_logo_white.svg'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import { prettyPhone } from '@shared/phone/phone'
import { useTheme } from '@app/hooks/useTheme'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import type { MouseEvent, ReactNode } from 'react'

const SUPPORT_PHONE_E164 = '+4795721220'
const SUPPORT_EMAIL = 'john.ravndal@gmail.com'

export default function LandingPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const { isDark } = useTheme()
  const isMd = useMediaQuery('(min-width: 768px)')
  const isSm = useMediaQuery('(min-width: 640px)')
  const headerOpacity = useTransform(scrollY, [0, 100], [0.95, 1])
  const headerBackground = useTransform(
    scrollY,
    [0, 100],
    ['var(--color-panel-translucent)', 'var(--color-panel-solid)'],
  )

  const scrollToSection = (id: string) => {
    if (id.startsWith('/')) {
      navigate({ to: id as '/' })
      return
    }
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (pathname === '/contact') {
      const el = document.getElementById('contact')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [pathname])

  const [navHovered, setNavHovered] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navItems: Array<{ label: string; id: string }> = [
    { label: 'Features', id: 'features' },
    { label: 'App', id: 'app' },
    { label: 'Why Grid', id: 'why' },
    { label: 'Try Demo', id: '/demo' },
    { label: 'Contact', id: 'contact' },
    { label: 'Get Started', id: 'get-started' },
    { label: 'Sign In', id: '/login' },
  ]

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false)
    scrollToSection(id)
  }

  useEffect(() => {
    if (isMd) setMobileMenuOpen(false)
  }, [isMd])

  return (
    <Box
      ref={containerRef}
      style={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(160deg, var(--color-background) 0%, var(--gray-2) 35%, var(--accent-a1) 70%, var(--gray-2) 100%)',
        backgroundAttachment: 'fixed',
        maxWidth: '100vw',
      }}
    >
      {/* Header – desktop links / mobile hamburger */}
      <motion.header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: isMd ? '0.75rem 2rem' : '0.625rem 1rem',
          background: headerBackground,
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--gray-a3)',
          opacity: headerOpacity,
        }}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Container size="4">
          <Flex align="center" justify="between" gap="4">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Flex
                align="center"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setMobileMenuOpen(false)
                  navigate({ to: '/' })
                }}
              >
                <img
                  src={isDark ? logoWhite : logoBlack}
                  alt="Grid"
                  style={{ height: isMd ? 26 : 22, width: 'auto' }}
                />
              </Flex>
            </motion.div>

            {isMd ? (
              <Flex align="center" gap="6" justify="end">
                {navItems.map((item) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    onMouseEnter={() => setNavHovered(item.id)}
                    onMouseLeave={() => setNavHovered(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.35rem 0',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: '0.02em',
                      position: 'relative',
                    }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <span
                      style={{
                        color:
                          navHovered === item.id
                            ? 'var(--accent-11)'
                            : 'var(--gray-11)',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {item.label}
                    </span>
                  </motion.button>
                ))}
              </Flex>
            ) : (
              <button
                type="button"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid var(--gray-a5)',
                  background: 'var(--color-panel-solid)',
                  color: 'var(--gray-12)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {mobileMenuOpen ? (
                  <Xmark width={20} height={20} />
                ) : (
                  <Menu width={20} height={20} />
                )}
              </button>
            )}
          </Flex>

          {!isMd && mobileMenuOpen ? (
            <Flex
              direction="column"
              gap="1"
              style={{
                marginTop: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--gray-a4)',
              }}
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '0.75rem 0.25rem',
                    fontFamily: 'inherit',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--gray-12)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </Flex>
          ) : null}
        </Container>
      </motion.header>

      {/* Hero Section – two columns */}
      <Box
        style={{
          position: 'relative',
          minHeight: isMd ? '100vh' : 'auto',
          display: 'flex',
          alignItems: 'center',
          paddingTop: isMd ? '80px' : '1.5rem',
          paddingBottom: isMd ? '2rem' : '1rem',
          paddingLeft: isMd ? 0 : '1rem',
          paddingRight: isMd ? 0 : '1rem',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <Container size="4" style={{ width: '100%', maxWidth: '100%' }}>
          <Flex
            direction={{ initial: 'column', md: 'row' }}
            align={{ initial: 'center', md: 'center' }}
            justify="between"
            gap={{ initial: '6', md: '8' }}
            style={{ width: '100%', textAlign: isMd ? 'left' : 'center' }}
          >
            {/* Left: large header, lighter weight */}
            <Flex
              direction="column"
              align={{ initial: 'center', md: 'start' }}
              gap="4"
              style={{
                flex: '1 1 50%',
                maxWidth: isMd ? 'none' : 520,
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Heading
                  size={{ initial: '8', sm: '9', md: '9' }}
                  style={{
                    fontWeight: 300,
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    marginBottom: 0,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  <Text
                    style={{
                      background:
                        'linear-gradient(135deg, var(--accent-11) 0%, var(--accent-9) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'block',
                      fontWeight: 300,
                    }}
                  >
                    Complete Operations Management
                  </Text>
                  <Text
                    as="span"
                    style={{
                      display: 'block',
                      color: 'var(--gray-12)',
                      fontWeight: 300,
                      letterSpacing: '-0.02em',
                      marginTop: '0.15em',
                    }}
                  >
                    for Modern Companies
                  </Text>
                </Heading>
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                style={{
                  margin: 0,
                  fontSize: isMd ? 18 : 16,
                  lineHeight: 1.6,
                  color: 'var(--gray-11)',
                  maxWidth: 480,
                }}
              >
                Streamline your entire operation with a unified platform for
                inventory, crew management, job scheduling, and customer
                relations—all in one place.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
              >
                <Flex
                  gap="3"
                  wrap="wrap"
                  justify={{ initial: 'center', md: 'start' }}
                >
                  <Button
                    size={isMd ? '4' : '3'}
                    variant="solid"
                    onClick={() => navigate({ to: '/demo' })}
                    style={{ padding: '0.75rem 1.75rem' }}
                  >
                    Try Demo
                    <Sparks
                      style={{ marginLeft: 8, verticalAlign: 'middle' }}
                    />
                  </Button>
                  <Button
                    size={isMd ? '4' : '3'}
                    variant="outline"
                    onClick={() => navigate({ to: '/signup' })}
                    style={{ padding: '0.75rem 1.75rem' }}
                  >
                    Get Started
                    <ArrowRight
                      style={{ marginLeft: 8, verticalAlign: 'middle' }}
                    />
                  </Button>
                  <Button
                    size={isMd ? '4' : '3'}
                    variant="outline"
                    onClick={() => navigate({ to: '/login' })}
                    style={{ padding: '0.75rem 1.75rem' }}
                  >
                    Sign In
                  </Button>
                </Flex>
              </motion.div>
            </Flex>

            {/* Right: representational graphic cards */}
            <Flex
              align="center"
              justify="center"
              gap="4"
              style={{
                flex: isMd ? '1 1 45%' : 'none',
                maxWidth: isMd ? 560 : 420,
                minHeight: isMd ? 340 : 0,
                display: isSm ? 'flex' : 'none',
              }}
            >
              <HeroGraphicCards />
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Demo Section */}
      <Box
        id="try-demo"
        style={{
          position: 'relative',
          padding: isMd ? '4rem 0' : '2rem 1rem',
        }}
      >
        <Container size="4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Box
              style={{
                padding: isMd ? '3rem' : '2rem 1.5rem',
                background: 'var(--color-panel-translucent)',
                backdropFilter: 'blur(8px)',
                borderRadius: '20px',
                border: '1px solid var(--accent-a5)',
                textAlign: 'center',
              }}
            >
              <Heading
                size={isMd ? '7' : '6'}
                style={{ marginBottom: '0.75rem', color: 'var(--gray-12)' }}
              >
                Try Grid without signing up
              </Heading>
              <Text
                size={isMd ? '4' : '3'}
                style={{
                  display: 'block',
                  color: 'var(--gray-11)',
                  lineHeight: 1.7,
                  maxWidth: 640,
                  margin: '0 auto 1.5rem',
                }}
              >
                Explore the full platform with sample data — jobs, inventory,
                crew, calendar, and more. No account needed. Demo mode is
                read-only, so you can click around freely without changing
                anything.
              </Text>
              <Flex justify="center">
                <Button
                  size={isMd ? '4' : '3'}
                  variant="solid"
                  onClick={() => navigate({ to: '/demo' })}
                  style={{ padding: '0.85rem 2.5rem' }}
                >
                  Try Demo
                  <Sparks style={{ marginLeft: 8, verticalAlign: 'middle' }} />
                </Button>
              </Flex>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Features Grid Section */}
      <Box
        id="features"
        style={{
          position: 'relative',
          padding: isMd ? '6rem 0' : '2rem 1rem',
          scrollMarginTop: 72,
        }}
      >
        <Container size="4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Heading
              size={isMd ? '8' : isSm ? '7' : '6'}
              style={{
                textAlign: 'center',
                marginBottom: '1rem',
                color: 'var(--gray-12)',
              }}
            >
              Everything You Need
            </Heading>
          </motion.div>

          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: isSm
                ? 'repeat(auto-fit, minmax(280px, 1fr))'
                : '1fr',
              gap: isSm ? '2rem' : '1.5rem',
            }}
          >
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                index={index}
              />
            ))}
          </Box>
        </Container>
      </Box>

      <AppPwaSection isMd={isMd} isSm={isSm} />

      {/* Problem/Solution Section */}
      <Box
        id="why"
        style={{
          position: 'relative',
          padding: isMd ? '6rem 0' : '3rem 1rem',
          background: 'transparent',
          scrollMarginTop: 72,
        }}
      >
        <Container size="4">
          <Flex
            direction={{ initial: 'column', md: 'row' }}
            gap="6"
            align="center"
          >
            <Box style={{ flex: 1, width: '100%' }}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <Heading
                  size={isMd ? '8' : isSm ? '7' : '6'}
                  style={{ marginBottom: '1rem', color: 'var(--gray-12)' }}
                >
                  Why Grid?
                </Heading>
                <Text
                  size={isSm ? '4' : '3'}
                  style={{
                    color: 'var(--gray-11)',
                    lineHeight: 1.8,
                    marginBottom: '2rem',
                  }}
                >
                  Running a company means juggling multiple systems and
                  spreadsheets, leading to missed deadlines, double-bookings,
                  and frustrated teams. Grid brings everything together in one
                  intuitive platform.
                </Text>
                <Box
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isSm
                      ? 'repeat(auto-fit, minmax(200px, 1fr))'
                      : '1fr',
                    gap: isSm ? '1.5rem' : '1rem',
                  }}
                >
                  {benefits.map((benefit, index) => (
                    <motion.div
                      key={benefit.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-50px' }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.1,
                        ease: 'easeOut',
                      }}
                    >
                      <motion.div
                        whileHover={{ y: -4, scale: 1.02 }}
                        transition={{
                          type: 'spring',
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <Box
                          style={{
                            padding: '1.5rem',
                            background: 'var(--color-panel-translucent)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '12px',
                            border: '1px solid var(--gray-4)',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <motion.div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background:
                                'linear-gradient(135deg, var(--accent-a2) 0%, transparent 50%)',
                              opacity: 0,
                              borderRadius: '12px',
                            }}
                            whileHover={{ opacity: 0.1 }}
                            transition={{ duration: 0.3 }}
                          />
                          <Box style={{ position: 'relative', zIndex: 1 }}>
                            <motion.div
                              style={{
                                marginBottom: '0.75rem',
                                color: 'var(--accent-11)',
                                display: 'inline-block',
                              }}
                              whileHover={{
                                scale: 1.15,
                                rotate: [0, -10, 10, -10, 0],
                              }}
                              transition={{
                                scale: { duration: 0.2 },
                                rotate: { duration: 0.6 },
                              }}
                            >
                              {benefit.icon}
                            </motion.div>
                            <Flex direction="column" gap="1">
                              <Text
                                size="3"
                                weight="bold"
                                style={{
                                  marginBottom: '0.5rem',
                                  color: 'var(--gray-12)',
                                }}
                              >
                                {benefit.title}
                              </Text>
                              <Text
                                size="2"
                                style={{ color: 'var(--gray-11)' }}
                              >
                                {benefit.description}
                              </Text>
                            </Flex>
                          </Box>
                        </Box>
                      </motion.div>
                    </motion.div>
                  ))}
                </Box>
              </motion.div>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box
        id="get-started"
        style={{
          position: 'relative',
          padding: isMd ? '6rem 0' : '3rem 1rem',
          scrollMarginTop: 72,
        }}
      >
        <Container size="4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              style={{
                padding: isMd ? '4rem' : '2rem 1.5rem',
                background:
                  'linear-gradient(135deg, var(--accent-9) 0%, var(--accent-11) 100%)',
                borderRadius: '24px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {/* Animated gradient overlay */}
              <motion.div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
                  backgroundSize: '200% 200%',
                }}
                animate={{
                  backgroundPosition: ['0% 0%', '100% 100%'],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
              <Box style={{ position: 'relative', zIndex: 1 }}>
                <Heading
                  size={isMd ? '8' : isSm ? '7' : '6'}
                  style={{ color: 'white', marginBottom: '1rem' }}
                >
                  Ready to Transform Your Operations?
                </Heading>
                <Flex direction="column" gap="1" align="center">
                  <Text
                    size={isMd ? '5' : isSm ? '4' : '3'}
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      marginBottom: isMd ? '2rem' : '1rem',
                      maxWidth: '600px',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }}
                  >
                    Join companies already using Grid to streamline their
                    operations and boost productivity.
                  </Text>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 4px 20px var(--accent-a7)',
                          '0 8px 30px var(--accent-a8)',
                          '0 4px 20px var(--accent-a7)',
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{
                        borderRadius: 'var(--radius-3)',
                        display: 'inline-block',
                        width: '100%',
                        maxWidth: '300px',
                      }}
                    >
                      <Button
                        size={isMd ? '4' : '3'}
                        variant="solid"
                        onClick={() => navigate({ to: '/signup' })}
                        style={{
                          background: 'var(--accent-9)',
                          color: 'var(--accent-contrast)',
                          padding: '0.75rem 2rem',
                          width: isSm ? '300px' : '100%',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          const button = e.currentTarget
                          const shimmer = document.createElement('div')
                          shimmer.style.cssText = `
                          position: absolute;
                          top: 0;
                          left: -100%;
                          width: 100%;
                          height: 100%;
                          background: linear-gradient(
                            90deg,
                            transparent,
                            rgba(255, 255, 255, 0.3),
                            transparent
                          );
                          transition: left 0.5s ease;
                        `
                          button.appendChild(shimmer)
                          requestAnimationFrame(() => {
                            shimmer.style.left = '100%'
                          })
                          setTimeout(() => shimmer.remove(), 500)
                        }}
                      >
                        <Flex align="center" gap="2" justify="center">
                          Get Started Free
                          <motion.div
                            animate={{
                              x: [0, 4, 0],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          >
                            <ArrowRight />
                          </motion.div>
                        </Flex>
                      </Button>
                    </motion.div>
                  </motion.div>
                </Flex>
              </Box>
            </motion.div>
          </motion.div>
        </Container>
      </Box>

      {/* Contact Section */}
      <Box
        id="contact"
        style={{
          position: 'relative',
          padding: isMd ? '6rem 0' : '3rem 1rem',
          background: 'var(--gray-2)',
          scrollMarginTop: isMd ? '80px' : '1rem',
        }}
      >
        <Container size="4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Box
              style={{
                padding: isMd ? '3rem' : '2rem 1.5rem',
                background: 'var(--color-panel-translucent)',
                backdropFilter: 'blur(8px)',
                borderRadius: '20px',
                border: '1px solid var(--gray-4)',
                textAlign: 'center',
              }}
            >
              <Heading
                size={isMd ? '7' : '6'}
                style={{ marginBottom: '0.75rem', color: 'var(--gray-12)' }}
              >
                Contact Support
              </Heading>
              <Text
                size={isMd ? '4' : '3'}
                style={{
                  display: 'block',
                  color: 'var(--gray-11)',
                  lineHeight: 1.7,
                  maxWidth: 520,
                  margin: '0 auto 0.8rem',
                }}
              >
                Need help getting access to your company? Reach out and we will
                sort it out.
              </Text>
              <Flex
                direction={{ initial: 'column', sm: 'row' }}
                align="center"
                justify="center"
                gap="4"
              >
                <CopyableContactLink
                  href={`tel:${SUPPORT_PHONE_E164}`}
                  label={prettyPhone(SUPPORT_PHONE_E164)}
                  copyText={SUPPORT_PHONE_E164}
                  copyLabel="Copy phone number"
                  icon={
                    <Phone
                      width={20}
                      height={20}
                      style={{ color: 'var(--accent-11)' }}
                    />
                  }
                />
                <CopyableContactLink
                  href={`mailto:${SUPPORT_EMAIL}`}
                  label={SUPPORT_EMAIL}
                  copyText={SUPPORT_EMAIL}
                  copyLabel="Copy email address"
                  icon={
                    <Mail
                      width={20}
                      height={20}
                      style={{ color: 'var(--accent-11)' }}
                    />
                  }
                />
              </Flex>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        style={{
          padding: isMd ? '3rem 0' : '2rem 1rem',
          borderTop: '1px solid var(--gray-4)',
          background: 'var(--gray-2)',
        }}
      >
        <Container size="4">
          <Flex
            direction={{ initial: 'column', md: 'row' }}
            align="center"
            justify="between"
            gap="4"
          >
            <Flex
              align="center"
              gap="2"
              direction={{ initial: 'column', sm: 'row' }}
            >
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gray-12)',
                }}
              >
                <ReportColumns width={isMd ? 32 : 28} height={isMd ? 32 : 28} />
              </Box>
              <Text
                size={isSm ? '3' : '2'}
                style={{ color: 'var(--gray-11)', textAlign: 'center' }}
              >
                © 2025 Grid. All rights reserved.
              </Text>
            </Flex>
            <Flex gap="4">
              <Button
                variant="ghost"
                size={isSm ? '3' : '2'}
                onClick={() => navigate({ to: '/legal' })}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
              >
                Terms & Privacy
              </Button>
            </Flex>
          </Flex>
        </Container>
      </Box>
    </Box>
  )
}

function CopyableContactLink({
  href,
  label,
  copyText,
  copyLabel,
  icon,
}: {
  href: string
  label: string
  copyText: string
  copyLabel: string
  icon: ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Flex
      align="center"
      gap="2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
      <a
        href={href}
        style={{
          color: 'var(--gray-12)',
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        <Text size="4" weight="medium">
          {label}
        </Text>
      </a>
      <Box
        style={{
          marginLeft: '0.25rem',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        <CopyIconButton text={copyText} copyLabel={copyLabel} />
      </Box>
    </Flex>
  )
}

function HeroGraphicCards() {
  const isSmall = !useMediaQuery('(min-width: 640px)')

  if (isSmall) return null

  return (
    <Flex
      gap="4"
      align="center"
      justify="center"
      wrap="wrap"
      style={{
        width: '100%',
        maxWidth: 520,
        perspective: '800px',
      }}
    >
      {/* Card 1: Dashboard / overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        style={{
          width: 200,
          height: 148,
          borderRadius: 16,
          background: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-5)',
          boxShadow: '0 12px 32px var(--gray-a5)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--accent-5)',
            }}
          />
          <div
            style={{
              height: 10,
              width: 72,
              borderRadius: 5,
              background: 'var(--gray-5)',
            }}
          />
        </div>
        <div
          style={{
            height: 10,
            width: '100%',
            borderRadius: 5,
            background: 'var(--gray-4)',
          }}
        />
        <div
          style={{
            height: 10,
            width: '80%',
            borderRadius: 5,
            background: 'var(--gray-4)',
          }}
        />
        <div
          style={{
            flex: 1,
            minHeight: 36,
            borderRadius: 10,
            background: 'var(--gray-3)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            padding: 8,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                borderRadius: 6,
                background: 'var(--gray-4)',
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Card 2: Calendar / schedule */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        style={{
          width: 176,
          height: 176,
          borderRadius: 16,
          background: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-5)',
          boxShadow: '0 12px 32px var(--gray-a5)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            height: 12,
            width: 88,
            borderRadius: 6,
            background: 'var(--gray-5)',
            alignSelf: 'center',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 32,
                height: 26,
                borderRadius: 6,
                background:
                  i === 3 || i === 7 ? 'var(--accent-5)' : 'var(--gray-4)',
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Card 3: List / jobs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        style={{
          width: 228,
          height: 132,
          borderRadius: 16,
          background: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-5)',
          boxShadow: '0 12px 32px var(--gray-a5)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--gray-5)',
              }}
            />
            <div
              style={{
                height: 10,
                flex: 1,
                borderRadius: 5,
                background: i === 1 ? 'var(--accent-4)' : 'var(--gray-4)',
              }}
            />
          </div>
        ))}
      </motion.div>
    </Flex>
  )
}

type InstallPlatform = 'ios' | 'android'

const iosSteps = [
  {
    icon: <Safari width={18} height={18} />,
    label: 'Open Grid in Safari',
  },
  {
    icon: <ShareIos width={18} height={18} />,
    label: 'Tap Share, then Add to Home Screen',
  },
  {
    icon: <HomeSimple width={18} height={18} />,
    label: 'Tap Add — Grid appears on your home screen',
  },
] as const

const androidSteps = [
  {
    icon: <OpenInBrowser width={18} height={18} />,
    label: 'Open Grid in Chrome',
  },
  {
    icon: <MoreVert width={18} height={18} />,
    label: 'Tap the menu (⋮), then Install app',
  },
  {
    icon: <SmartphoneDevice width={18} height={18} />,
    label: 'Confirm Install — Grid opens like an app',
  },
] as const

function AppInstallGuide() {
  const [platform, setPlatform] = useState<InstallPlatform>('ios')
  const steps = platform === 'ios' ? iosSteps : androidSteps

  return (
    <Box
      style={{
        background: 'var(--color-panel-translucent)',
        backdropFilter: 'blur(8px)',
        borderRadius: 16,
        border: '1px solid var(--gray-4)',
        padding: '1.25rem',
      }}
    >
      <Flex gap="2" style={{ marginBottom: '1rem' }}>
        {(
          [
            {
              id: 'ios' as const,
              label: 'iPhone',
              icon: <Safari width={16} height={16} />,
            },
            {
              id: 'android' as const,
              label: 'Android',
              icon: <SmartphoneDevice width={16} height={16} />,
            },
          ] as const
        ).map((tab) => {
          const active = platform === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPlatform(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.4rem 0.85rem',
                borderRadius: 999,
                border: active
                  ? '1px solid var(--accent-7)'
                  : '1px solid var(--gray-5)',
                background: active ? 'var(--accent-3)' : 'transparent',
                color: active ? 'var(--accent-11)' : 'var(--gray-11)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </Flex>
      <Flex direction="column" gap="3">
        {steps.map((step, index) => (
          <Flex key={step.label} align="start" gap="3">
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--accent-3)',
                color: 'var(--accent-11)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {index + 1}
            </Box>
            <Flex align="center" gap="2" style={{ paddingTop: 3 }}>
              <Box style={{ color: 'var(--gray-10)', display: 'flex' }}>
                {step.icon}
              </Box>
              <Text
                size="2"
                style={{ color: 'var(--gray-12)', lineHeight: 1.5 }}
              >
                {step.label}
              </Text>
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Box>
  )
}

function useSectionPhoneTilt(enabled: boolean) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const canTilt = enabled && !prefersReducedMotion
  const rotateXRaw = useMotionValue(0)
  const rotateYRaw = useMotionValue(0)
  const translateXRaw = useMotionValue(0)
  const translateYRaw = useMotionValue(0)
  const rotateX = useSpring(rotateXRaw, { stiffness: 180, damping: 22 })
  const rotateY = useSpring(rotateYRaw, { stiffness: 180, damping: 22 })
  const translateX = useSpring(translateXRaw, { stiffness: 180, damping: 22 })
  const translateY = useSpring(translateYRaw, { stiffness: 180, damping: 22 })

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!canTilt) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    rotateXRaw.set(y * -10)
    rotateYRaw.set(x * 18)
    translateXRaw.set(x * 14)
    translateYRaw.set(y * 8)
  }

  const onMouseLeave = () => {
    rotateXRaw.set(0)
    rotateYRaw.set(0)
    translateXRaw.set(0)
    translateYRaw.set(0)
  }

  return {
    canTilt,
    rotateX,
    rotateY,
    translateX,
    translateY,
    onMouseMove,
    onMouseLeave,
  }
}

function AppPwaSection({ isMd, isSm }: { isMd: boolean; isSm: boolean }) {
  const {
    canTilt,
    rotateX,
    rotateY,
    translateX,
    translateY,
    onMouseMove,
    onMouseLeave,
  } = useSectionPhoneTilt(isMd)

  return (
    <Box
      id="app"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        padding: isMd ? '6rem 0' : '3rem 1rem',
        background: 'var(--gray-2)',
        scrollMarginTop: 72,
      }}
    >
      <Container size="4">
        <Flex
          direction={{ initial: 'column', md: 'row' }}
          gap={isMd ? '8' : '5'}
          align="center"
        >
          <Box style={{ flex: 1, width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Flex align="center" gap="2" style={{ marginBottom: '0.75rem' }}>
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--accent-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-11)',
                  }}
                >
                  <SmartphoneDevice width={22} height={22} />
                </Box>
                <Text
                  size="2"
                  weight="medium"
                  style={{ color: 'var(--accent-11)' }}
                >
                  Progressive Web App
                </Text>
              </Flex>
              <Heading
                size={isMd ? '8' : isSm ? '7' : '6'}
                style={{ marginBottom: '1rem', color: 'var(--gray-12)' }}
              >
                Use Grid on your phone
              </Heading>
              <Text
                size={isSm ? '4' : '3'}
                style={{
                  color: 'var(--gray-11)',
                  lineHeight: 1.8,
                  marginBottom: '1.5rem',
                  display: 'block',
                }}
              >
                We don&apos;t have a native App Store or Play Store app. Grid is
                a Progressive Web App — install it from your browser and it
                opens full-screen from your home screen, just like a native app.
                No store download required.
              </Text>
              <AppInstallGuide />
            </motion.div>
          </Box>
          <Box
            style={{
              flex: isMd ? '0 0 280px' : '1',
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <PwaPhoneMockup
                canTilt={canTilt}
                rotateX={rotateX}
                rotateY={rotateY}
                translateX={translateX}
                translateY={translateY}
              />
            </motion.div>
          </Box>
        </Flex>
      </Container>
    </Box>
  )
}

function PwaPhoneMockup({
  canTilt,
  rotateX,
  rotateY,
  translateX,
  translateY,
}: {
  canTilt: boolean
  rotateX: ReturnType<typeof useSpring>
  rotateY: ReturnType<typeof useSpring>
  translateX: ReturnType<typeof useSpring>
  translateY: ReturnType<typeof useSpring>
}) {
  const { isDark } = useTheme()

  return (
    <div
      style={{
        perspective: 900,
        width: 260,
        height: 520,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        style={{
          width: 240,
          height: 490,
          borderRadius: 36,
          background: isDark ? 'var(--gray-1)' : '#1a1a1c',
          border: '2px solid var(--gray-6)',
          boxShadow:
            '0 24px 48px var(--gray-a6), inset 0 0 0 1px var(--gray-a3)',
          padding: 10,
          position: 'relative',
          rotateX,
          rotateY,
          x: translateX,
          y: translateY,
          transformStyle: 'preserve-3d',
          willChange: canTilt ? 'transform' : undefined,
        }}
      >
        {/* Dynamic Island */}
        <Box
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 72,
            height: 22,
            borderRadius: 12,
            background: isDark ? 'var(--gray-3)' : '#0a0a0b',
            zIndex: 2,
          }}
        />
        {/* Screen */}
        <Box
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 28,
            background: 'var(--color-background)',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Status bar */}
          <Flex
            justify="between"
            align="center"
            style={{
              padding: '12px 18px 6px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--gray-12)',
            }}
          >
            <span>9:41</span>
            <Flex gap="1" align="center">
              <Box
                style={{
                  width: 14,
                  height: 8,
                  borderRadius: 2,
                  border: '1px solid var(--gray-11)',
                }}
              />
            </Flex>
          </Flex>

          {/* App header */}
          <Flex align="center" gap="2" style={{ padding: '8px 14px 12px' }}>
            <img
              src={isDark ? logoWhite : logoBlack}
              alt=""
              style={{ height: 18, width: 'auto' }}
            />
            <Box style={{ flex: 1 }} />
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--accent-4)',
              }}
            />
          </Flex>

          {/* Week strip */}
          <Flex gap="1" style={{ padding: '0 12px 12px' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  background: i === 2 ? 'var(--accent-4)' : 'var(--gray-3)',
                  border:
                    i === 2
                      ? '1px solid var(--accent-7)'
                      : '1px solid transparent',
                }}
              />
            ))}
          </Flex>

          {/* Section cards */}
          <Flex
            direction="column"
            gap="2"
            style={{ padding: '0 12px', flex: 1 }}
          >
            {[
              { titleW: '55%', rows: 2 },
              { titleW: '40%', rows: 3 },
              { titleW: '48%', rows: 2 },
            ].map((card, cardIndex) => (
              <Box
                key={cardIndex}
                style={{
                  borderRadius: 12,
                  background: 'var(--color-panel-solid)',
                  border: '1px solid var(--gray-4)',
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <Box
                  style={{
                    height: 8,
                    width: card.titleW,
                    borderRadius: 4,
                    background: 'var(--gray-5)',
                  }}
                />
                {Array.from({ length: card.rows }).map((_, rowIndex) => (
                  <Flex key={rowIndex} gap="2" align="center">
                    <Box
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background:
                          cardIndex === 0 && rowIndex === 0
                            ? 'var(--accent-5)'
                            : 'var(--gray-4)',
                        flexShrink: 0,
                      }}
                    />
                    <Box
                      style={{
                        height: 7,
                        flex: 1,
                        borderRadius: 4,
                        background: 'var(--gray-4)',
                      }}
                    />
                  </Flex>
                ))}
              </Box>
            ))}
          </Flex>

          {/* Home indicator */}
          <Box
            style={{
              width: 96,
              height: 4,
              borderRadius: 2,
              background: 'var(--gray-8)',
              margin: '10px auto 8px',
            }}
          />
        </Box>
      </motion.div>
    </div>
  )
}

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number]
  index: number
}) {
  const isMd = useMediaQuery('(min-width: 768px)')
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: 'easeOut',
      }}
    >
      <motion.div
        whileHover={{ y: -8, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ height: '100%' }}
      >
        <Box
          style={{
            padding: isMd ? '2rem' : '1.5rem',
            background: 'var(--color-panel-translucent)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            border: '1px solid var(--gray-4)',
            height: '100%',
            cursor: 'default',
            willChange: 'transform',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle gradient overlay on hover */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, var(--accent-a2) 0%, transparent 50%)',
              opacity: 0,
              borderRadius: '16px',
            }}
            whileHover={{ opacity: 0.1 }}
            transition={{ duration: 0.3 }}
          />
          <Box style={{ position: 'relative', zIndex: 1 }}>
            <motion.div
              style={{
                marginBottom: '1rem',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'var(--accent-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-11)',
              }}
              whileHover={{
                scale: 1.1,
                rotate: [0, -5, 5, -5, 0],
              }}
              transition={{
                scale: { duration: 0.2 },
                rotate: { duration: 0.5 },
              }}
            >
              {feature.icon}
            </motion.div>
            <Heading
              size="5"
              style={{ marginBottom: '0.5rem', color: 'var(--gray-12)' }}
            >
              {feature.title}
            </Heading>
            <Text size="3" style={{ color: 'var(--gray-11)', lineHeight: 1.6 }}>
              {feature.description}
            </Text>
          </Box>
        </Box>
      </motion.div>
    </motion.div>
  )
}

const features = [
  {
    icon: <Group width={24} height={24} />,
    title: 'Crew Management',
    description:
      'Track your team, manage schedules, and ensure the right people are on the right jobs at the right time.',
  },
  {
    icon: <GoogleDocs width={24} height={24} />,
    title: 'Job Management',
    description:
      'Create, assign, and track jobs from start to finish with all the details you need in one place.',
  },
  {
    icon: <Calendar width={24} height={24} />,
    title: 'Smart Calendar',
    description:
      'Visualize your operations with an intuitive calendar view that helps prevent conflicts and optimize resources.',
  },
  {
    icon: <BoxIso width={24} height={24} />,
    title: 'Inventory Tracking',
    description:
      'Keep tabs on your inventory levels, set low-stock alerts, and ensure you have what you need when you need it.',
  },
  {
    icon: <Car width={24} height={24} />,
    title: 'Vehicle Fleet',
    description:
      'Manage your company vehicles and track assignments to keep operations running smoothly.',
  },
  {
    icon: <User width={24} height={24} />,
    title: 'Customer Relations',
    description:
      'Maintain detailed customer profiles and manage relationships all in one organized system.',
  },
  {
    icon: <Message width={24} height={24} />,
    title: 'Team Collaboration',
    description:
      'Communicate through matters, share updates, and keep everyone in the loop with real-time notifications.',
  },
  {
    icon: <Building width={24} height={24} />,
    title: 'Company Dashboard',
    description:
      'Get a comprehensive overview of your entire operation with key metrics and insights at a glance.',
  },
  {
    icon: <Bell width={24} height={24} />,
    title: 'Alerts & Notifications',
    description:
      'Stay informed about important updates, low stock, scheduling conflicts, and more with smart alerts.',
  },
]

const benefits = [
  {
    icon: <CheckCircle width={24} height={24} />,
    title: 'Increased Efficiency',
    description: 'Automate workflows and reduce manual errors',
  },
  {
    icon: <Activity width={24} height={24} />,
    title: 'Better Planning',
    description: 'Make data-driven decisions with real-time insights',
  },
  {
    icon: <Shield width={24} height={24} />,
    title: 'Secure & Reliable',
    description: 'Enterprise-grade security and backup systems',
  },
  {
    icon: <Sparks width={24} height={24} />,
    title: 'Easy to Use',
    description: 'Intuitive interface that your team will love',
  },
]
