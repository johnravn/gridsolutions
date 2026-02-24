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
        background: 'var(--color-background)',
        maxWidth: '100vw',
      }}
    >
      {/* Background geometrics with parallax */}
      <GeometricBackground />

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
            <Flex align="center" gap={isMd ? '6' : '3'} wrap="wrap" justify="end">
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

      {/* Hero Section */}
      <Box
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: isMd ? '80px' : '60px',
          paddingBottom: '2rem',
          paddingLeft: isMd ? 0 : '1rem',
          paddingRight: isMd ? 0 : '1rem',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* 3D flight cases with parallax – behind content */}
        <FlightCasesParallax />

        <Container size="4" style={{ width: '100%', maxWidth: '100%', position: 'relative', zIndex: 2 }}>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap={{ initial: '5', md: '7' }}
            style={{ textAlign: 'center', width: '100%' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ width: '100%', padding: isMd ? 0 : '0 0.5rem' }}
            >
              <Heading
                size={{ initial: '8', sm: '9', md: '9' }}
                style={{
                  fontWeight: 900,
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                  marginBottom: '1rem',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                >
                  <Text
                    style={{
                      background:
                        'linear-gradient(135deg, var(--accent-11) 0%, var(--accent-9) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      backgroundSize: '200% auto',
                      display: 'block',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      fontWeight: 900,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    Complete Operations Management
                  </Text>
                </motion.div>
                <br />
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                >
                  <Text
                    style={{
                      color: 'var(--gray-12)',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      fontWeight: 900,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    for Modern Companies
                  </Text>
                </motion.div>
              </Heading>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
              style={{
                width: '100%',
                maxWidth: '680px',
                padding: isMd ? 0 : '0 0.5rem',
              }}
            >
              <Text
                size={{ initial: '3', sm: '4', md: '5' }}
                style={{
                  color: 'var(--gray-11)',
                  maxWidth: '680px',
                  lineHeight: 1.65,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontWeight: 500,
                }}
              >
                Streamline your entire operation with a unified platform for
                inventory, crew management, job scheduling, and customer
                relations—all in one place.
              </Text>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
              style={{ width: '100%' }}
            >
              <Flex
                gap="3"
                align="center"
                justify="center"
                direction={{ initial: 'column', sm: 'row' }}
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  padding: isMd ? 0 : '0 0.5rem',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  style={{ width: isSm ? 'auto' : '100%' }}
                >
                  <Button
                    size={isMd ? '4' : '3'}
                    variant="classic"
                    onClick={() => navigate({ to: '/signup' })}
                    style={{
                      padding: '0.75rem 2rem',
                      width: isSm ? 'auto' : '100%',
                    }}
                  >
                    Get Started
                    <motion.span
                      animate={{ x: [0, 4, 0] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      style={{ display: 'inline-flex', marginLeft: '0.5rem' }}
                    >
                      <ArrowRight />
                    </motion.span>
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  style={{ width: isSm ? 'auto' : '100%' }}
                >
                  <Button
                    size={isMd ? '4' : '3'}
                    variant="outline"
                    onClick={() => navigate({ to: '/login' })}
                    style={{
                      padding: '0.75rem 2rem',
                      width: isSm ? 'auto' : '100%',
                    }}
                  >
                    Sign In
                  </Button>
                </motion.div>
              </Flex>
            </motion.div>
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
            <Text
              size={isSm ? '4' : '3'}
              style={{
                textAlign: 'center',
                color: 'var(--gray-11)',
                marginBottom: isMd ? '4rem' : '2rem',
              }}
            >
              Powerful tools designed to simplify your workflow
            </Text>
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

const FLIGHT_SILVER = 'linear-gradient(145deg, #c0c4c8 0%, #8a8e92 50%, #a8acb0 100%)'
const FLIGHT_BLACK = '#1a1b1c'

function FlightCaseFace({
  w,
  h,
  face,
  depth,
  showHandle,
  showLatches,
}: {
  w: number
  h: number
  face: 'front' | 'top' | 'right'
  depth: number
  showHandle?: boolean
  showLatches?: boolean
}) {
  const isFront = face === 'front'
  const strip = 3
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: face === 'right' ? depth : w,
        height: face === 'top' ? depth : h,
        background: FLIGHT_BLACK,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
        backfaceVisibility: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Silver edge strip (aluminum profile) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `${strip}px solid #9ca0a4`,
          boxSizing: 'border-box',
          borderRadius: 3,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 0 rgba(0,0,0,0.15)',
        }}
      />
      {/* Ball corners (silver, at vertices) */}
      {[
        { left: 0, top: 0 },
        { left: '100%', top: 0 },
        { left: '100%', top: '100%' },
        { left: 0, top: '100%' },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: strip * 2.2,
            height: strip * 2.2,
            marginLeft: pos.left === '100%' ? -strip * 2.2 : 0,
            marginTop: pos.top === '100%' ? -strip * 2.2 : 0,
            borderRadius: '50%',
            background: FLIGHT_SILVER,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.25)',
          }}
        />
      ))}
      {isFront && showHandle && (
        <div
          style={{
            position: 'absolute',
            top: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: Math.max(w * 0.32, 28),
            height: 5,
            borderRadius: 3,
            background: 'linear-gradient(180deg, #909498 0%, #606468 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 2px #1a1b1c',
          }}
        />
      )}
      {isFront && showLatches && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: '28%',
              left: '25%',
              width: Math.max(w * 0.12, 12),
              height: Math.max(h * 0.08, 8),
              borderRadius: 2,
              background: 'linear-gradient(145deg, #a0a4a8 0%, #606468 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '28%',
              right: '25%',
              width: Math.max(w * 0.12, 12),
              height: Math.max(h * 0.08, 8),
              borderRadius: 2,
              background: 'linear-gradient(145deg, #a0a4a8 0%, #606468 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)',
            }}
          />
        </>
      )}
    </div>
  )
}

function SingleFlightCase({
  w,
  h,
  d,
  showHandle,
  showLatches,
  transform,
}: {
  w: number
  h: number
  d: number
  showHandle?: boolean
  showLatches?: boolean
  transform: string
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        transformStyle: 'preserve-3d',
        transform,
      }}
    >
      {/* Front */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          transform: 'translateZ(0)',
        }}
      >
        <FlightCaseFace w={w} h={h} face="front" depth={d} showHandle={showHandle} showLatches={showLatches} />
      </div>
      {/* Top */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: d,
          transform: 'rotateX(-90deg)',
          transformOrigin: 'top center',
        }}
      >
        <FlightCaseFace w={w} h={d} face="top" depth={d} />
      </div>
      {/* Right */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: d,
          height: h,
          transform: `rotateY(90deg) translateX(${w}px)`,
          transformOrigin: 'left center',
        }}
      >
        <FlightCaseFace w={d} h={h} face="right" depth={d} />
      </div>
    </div>
  )
}

function FlightCasesParallax() {
  const { scrollY } = useScroll()
  const wallY = useTransform(scrollY, [0, 500], [0, 60])

  /* Wall: from middle to right. Each row is a horizontal strip; cases stack. Right = closer (origin). */
  const wallCells: Array<{ w: number; h: number; d: number; showHandle?: boolean; showLatches?: boolean }> = [
    { w: 72, h: 52, d: 28, showHandle: true, showLatches: true },
    { w: 68, h: 48, d: 26, showLatches: true },
    { w: 76, h: 50, d: 30, showHandle: true, showLatches: true },
    { w: 70, h: 46, d: 26, showLatches: true },
    { w: 64, h: 44, d: 24, showHandle: true },
    { w: 74, h: 54, d: 28, showLatches: true },
    { w: 68, h: 48, d: 26, showHandle: true, showLatches: true },
    { w: 72, h: 50, d: 26, showLatches: true },
    { w: 70, h: 46, d: 28, showHandle: true, showLatches: true },
    { w: 66, h: 44, d: 24, showLatches: true },
    { w: 78, h: 52, d: 30, showHandle: true, showLatches: true },
    { w: 68, h: 48, d: 26 },
  ]

  return (
    <Box
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
        perspective: '1400px',
      }}
    >
      {/* Wall container: spans center (50%) to right; origin at right so right is closer */}
      <motion.div
        style={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transformOrigin: '100% 50%',
          transform: 'translateY(-50%) rotateY(-20deg)',
          y: wallY,
          width: '58%',
          maxWidth: 720,
          height: '75%',
          maxHeight: 520,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: 6,
          alignContent: 'center',
          justifyContent: 'center',
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        {wallCells.map((cell, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transformStyle: 'preserve-3d',
            }}
          >
            <SingleFlightCase
              w={cell.w}
              h={cell.h}
              d={cell.d}
              showHandle={cell.showHandle}
              showLatches={cell.showLatches}
              transform="translateZ(0)"
            />
          </div>
        ))}
      </motion.div>
    </Box>
  )
}

function GeometricBackground() {
  return (
    <Box
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        opacity: 0.4,
        willChange: 'transform',
      }}
    >
      <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 1200 1600"
        preserveAspectRatio="none"
        style={{ display: 'block', transform: 'translateZ(0)' }}
        animate={{
          y: [0, -20, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              style={{ stopColor: 'var(--accent-a2)', stopOpacity: 1 }}
            />
            <stop
              offset="100%"
              style={{ stopColor: 'var(--gray-a2)', stopOpacity: 1 }}
            />
          </linearGradient>
        </defs>
        {/* Large intersecting bands */}
        <motion.rect
          x="250"
          y="-100"
          width="200"
          height="1800"
          fill="var(--gray-a1)"
          transform="rotate(12 600 800)"
          animate={{
            y: [0, 30, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.rect
          x="-100"
          y="300"
          width="600"
          height="100"
          fill="var(--gray-a1)"
          transform="rotate(-10 600 800)"
          animate={{
            x: [0, 20, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Large polygon spanning most of the view */}
        <motion.polygon
          points="50,50 1100,50 1050,800 200,850"
          fill="url(#grad1)"
          opacity="0.3"
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Single large accent shape */}
        <motion.polygon
          points="800,200 1200,150 1000,1200 600,1100"
          fill="var(--indigo-a2)"
          animate={{
            y: [0, -30, 0],
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.svg>
    </Box>
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
