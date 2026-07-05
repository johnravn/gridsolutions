import * as React from 'react'
import { Box } from '@radix-ui/themes'

type ShapeType = 'circles' | 'triangles' | 'rectangles'

export function AnimatedBackground({
  intensity = 1.0,
  shapeType = 'circles',
  speed = 1.0,
  boostLightContrast = true,
}: {
  intensity?: number
  shapeType?: ShapeType
  speed?: number
  /** When false, shape colors stay subtle after theme class hydration. */
  boostLightContrast?: boolean
}) {
  // Clamp intensity between 0 and 1
  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  // Clamp speed between 0.1 and 3.0, use as multiplier (inverse for duration)
  const speedMultiplier = Math.max(0.1, Math.min(3.0, speed))
  // Base durations (in seconds) - slower speed = longer duration
  const baseDurations = [120, 150, 180, 100, 200]
  const durations = baseDurations.map((d) => d / speedMultiplier)
  // Rotation durations (in seconds) - much slower for subtle rotation, also affected by speed multiplier
  // Each shape rotates at a different speed for variety
  const baseRotationDurations = [300, 420, 360, 380, 400]
  const rotationDurations = baseRotationDurations.map(
    (d) => d / speedMultiplier,
  )

  // Initial rotation angles (degrees) - each shape starts at a different angle
  const initialRotations = [15, 30, 45, 60, 75]

  // Calculate rotation amounts (degrees per slide cycle) for triangles/rectangles
  // Much more subtle - only partial rotations per slide cycle
  const rotationAmounts = durations.map((slideDur, idx) =>
    Math.round((slideDur / rotationDurations[idx]) * 360),
  )

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
        @keyframes slideSlow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(calc(100vw + 100%));
          }
        }
        
        @keyframes slideSlowReverse {
          0% {
            transform: translateX(calc(100vw + 100%));
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        @keyframes slideSlowWithRotate1 {
          0% {
            transform: translateX(-100%) rotate(${initialRotations[0]}deg);
          }
          100% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[0] + rotationAmounts[0]}deg);
          }
        }
        
        @keyframes slideSlowReverseWithRotate2 {
          0% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[1]}deg);
          }
          100% {
            transform: translateX(-100%) rotate(${initialRotations[1] - rotationAmounts[1]}deg);
          }
        }
        
        @keyframes slideSlowWithRotate3 {
          0% {
            transform: translateX(-100%) rotate(${initialRotations[2]}deg);
          }
          100% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[2] + rotationAmounts[2]}deg);
          }
        }
        
        @keyframes slideSlowReverseWithRotate4 {
          0% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[3]}deg);
          }
          100% {
            transform: translateX(-100%) rotate(${initialRotations[3] - rotationAmounts[3]}deg);
          }
        }
        
        @keyframes slideSlowWithRotate5 {
          0% {
            transform: translateX(-100%) rotate(${initialRotations[4]}deg);
          }
          100% {
            transform: translateX(calc(100vw + 100%)) rotate(${initialRotations[4] + rotationAmounts[4]}deg);
          }
        }
        
        @keyframes rotateSlow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        
        @keyframes rotateSlowReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        
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
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowWithRotate1 ${durations[0]}s linear infinite`
              : `slideSlow ${durations[0]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 10px;' : ''}
        }
        
        .bg-shape-2 {
          width: 600px;
          height: 600px;
          background: var(--accent-a2);
          top: 20%;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowReverseWithRotate2 ${durations[1]}s linear infinite`
              : `slideSlowReverse ${durations[1]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 20px;' : ''}
        }
        
        .bg-shape-3 {
          width: 1000px;
          height: 1000px;
          background: var(--accent-a3);
          bottom: -300px;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowWithRotate3 ${durations[2]}s linear infinite`
              : `slideSlow ${durations[2]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 50%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 10px;' : ''}
        }
        
        .bg-shape-4 {
          width: 400px;
          height: 400px;
          background: var(--accent-a2);
          top: 50%;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowReverseWithRotate4 ${durations[3]}s linear infinite`
              : `slideSlowReverse ${durations[3]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 40px;' : ''}
        }
        
        .bg-shape-5 {
          width: 700px;
          height: 700px;
          background: var(--accent-a3);
          top: 10%;
          left: 0;
          animation: ${
            shapeType === 'triangles' || shapeType === 'rectangles'
              ? `slideSlowWithRotate5 ${durations[4]}s linear infinite`
              : `slideSlow ${durations[4]}s linear infinite`
          };
          ${shapeType === 'circles' ? 'border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%;' : ''}
          ${shapeType === 'triangles' ? 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' : ''}
          ${shapeType === 'rectangles' ? 'border-radius: 15px;' : ''}
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
