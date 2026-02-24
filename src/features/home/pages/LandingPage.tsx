import { useNavigate } from '@tanstack/react-router'
import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useState } from 'react'
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
  Message,
  ReportColumns,
  Shield,
  Sparks,
  User,
} from 'iconoir-react'
import logoBlack from '@shared/assets/gridLogo/grid_logo_black.svg'
import logoWhite from '@shared/assets/gridLogo/grid_logo_white.svg'
import { useTheme } from '@app/hooks/useTheme'
import { useMediaQuery } from '@app/hooks/useMediaQuery'

export default function LandingPage() {
  const navigate = useNavigate()
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

  const [navHovered, setNavHovered] = useState<string | null>(null)
  const navItems: Array<{ label: string; id: string }> = [
    { label: 'Features', id: 'features' },
    { label: 'Why Grid', id: 'why' },
    { label: 'Get Started', id: 'get-started' },
    { label: 'Sign In', id: '/login' },
  ]

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
      {/* Header – minimal nav */}
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
                onClick={() => navigate({ to: '/' })}
              >
                <img
                  src={isDark ? logoWhite : logoBlack}
                  alt="Grid"
                  style={{ height: isMd ? 26 : 22, width: 'auto' }}
                />
              </Flex>
            </motion.div>
            <Flex
              align="center"
              gap={isMd ? '6' : '3'}
              wrap="wrap"
              justify="end"
            >
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
                    fontSize: isMd ? 14 : 13,
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
                          ? 'transparent'
                          : 'var(--gray-11)',
                      background:
                        navHovered === item.id
                          ? 'linear-gradient(135deg, var(--accent-9) 0%, var(--accent-11) 100%)'
                          : 'none',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor:
                        navHovered === item.id ? 'transparent' : undefined,
                      backgroundClip: 'text',
                      transition: 'color 0.2s ease, background 0.2s ease',
                    }}
                  >
                    {item.label}
                  </span>
                </motion.button>
              ))}
            </Flex>
          </Flex>
        </Container>
      </motion.header>

      {/* Hero Section – two columns */}
      <Box
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          paddingTop: isMd ? '80px' : '60px',
          paddingBottom: '2rem',
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
                    variant="classic"
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
                flex: '1 1 45%',
                maxWidth: isMd ? 560 : 420,
                minHeight: 340,
              }}
            >
              <HeroGraphicCards />
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Features Grid Section */}
      <Box
        id="features"
        style={{
          position: 'relative',
          padding: isMd ? '6rem 0' : '3rem 1rem',
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

      {/* Problem/Solution Section */}
      <Box
        id="why"
        style={{
          position: 'relative',
          padding: isMd ? '6rem 0' : '3rem 1rem',
          background: 'var(--gray-2)',
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
                        variant="classic"
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

function HeroGraphicCards() {
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
