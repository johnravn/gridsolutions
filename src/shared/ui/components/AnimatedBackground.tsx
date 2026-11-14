import { Box } from '@radix-ui/themes'

type ShapeType = 'circles' | 'triangles' | 'rectangles'

/**
 * Soft accent shapes behind auth/offer shells.
 * Continuous slide/rotate loops were removed (decorative, always-on GPU).
 * Shapes stay static; prefer-reduced-motion users get the same calm backdrop.
 */
export function AnimatedBackground({
  intensity = 1.0,
  shapeType = 'circles',
  speed: _speed = 1.0,
  boostLightContrast = true,
}: {
  intensity?: number
  shapeType?: ShapeType
  /** @deprecated Ignored — background no longer animates. */
  speed?: number
  /** When false, shape colors stay subtle after theme class hydration. */
  boostLightContrast?: boolean
}) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  const initialRotations = [15, 30, 45, 60, 75]

  const shapeExtra = (index: number) => {
    if (shapeType === 'circles') {
      if (index === 3)
        return 'border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;'
      if (index === 4)
        return 'border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%;'
      return 'border-radius: 50%;'
    }
    if (shapeType === 'triangles') {
      return 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);'
    }
    if (index === 1) return 'border-radius: 20px;'
    if (index === 3) return 'border-radius: 40px;'
    if (index === 4) return 'border-radius: 15px;'
    return 'border-radius: 10px;'
  }

  return (
    <Box
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .bg-shape {
          position: absolute;
          opacity: ${clampedIntensity};
          mix-blend-mode: normal;
        }

        .bg-shape-1 {
          width: 800px;
          height: 800px;
          background: var(--accent-a3);
          top: -200px;
          left: 10%;
          transform: rotate(${initialRotations[0]}deg);
          ${shapeExtra(0)}
        }

        .bg-shape-2 {
          width: 600px;
          height: 600px;
          background: var(--accent-a2);
          top: 20%;
          right: -10%;
          left: auto;
          transform: rotate(${initialRotations[1]}deg);
          ${shapeExtra(1)}
        }

        .bg-shape-3 {
          width: 1000px;
          height: 1000px;
          background: var(--accent-a3);
          bottom: -300px;
          left: -15%;
          transform: rotate(${initialRotations[2]}deg);
          ${shapeExtra(2)}
        }

        .bg-shape-4 {
          width: 400px;
          height: 400px;
          background: var(--accent-a2);
          top: 50%;
          left: 40%;
          transform: rotate(${initialRotations[3]}deg);
          ${shapeExtra(3)}
        }

        .bg-shape-5 {
          width: 700px;
          height: 700px;
          background: var(--accent-a3);
          top: 10%;
          left: 55%;
          transform: rotate(${initialRotations[4]}deg);
          ${shapeExtra(4)}
        }

        ${
          boostLightContrast
            ? `/* Increase contrast for light mode */
        .light .bg-shape-1,
        .light .bg-shape-3,
        .light .bg-shape-5 {
          background: var(--accent-a7);
        }

        .light .bg-shape-2,
        .light .bg-shape-4 {
          background: var(--accent-a6);
        }`
            : ''
        }
      `}</style>
      <div className="bg-shape bg-shape-1" />
      <div className="bg-shape bg-shape-2" />
      <div className="bg-shape bg-shape-3" />
      <div className="bg-shape bg-shape-4" />
      <div className="bg-shape bg-shape-5" />
    </Box>
  )
}
