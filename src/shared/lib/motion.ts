/**
 * Motion tokens for reveal / fade-in animations.
 * Duration and easing are defined as CSS variables in app/styles.css (:root).
 */

export const motionDurationReveal = 'var(--motion-duration-reveal)'
export const motionEaseReveal = 'var(--motion-ease-reveal)'
export const motionEaseRevealOut = 'var(--motion-ease-reveal-out)'
export const motionEaseRevealIn = 'var(--motion-ease-reveal-in)'
export const motionOffsetRevealX = 'var(--motion-offset-reveal-x)'
export const motionOffsetRevealY = 'var(--motion-offset-reveal-y)'

export type RevealTransitionProperty =
  | 'opacity'
  | 'transform'
  | 'max-width'
  | 'grid-template-rows'

/** Build a transition string for reveal animations (opacity, transform, etc.). */
export function motionRevealTransition(
  properties: Array<RevealTransitionProperty> = ['opacity', 'transform'],
  options?: { ease?: string; delay?: string },
): string {
  const ease = options?.ease ?? motionEaseReveal
  const delay = options?.delay ? ` ${options.delay}` : ''
  return properties
    .map((prop) => `${prop} ${motionDurationReveal} ${ease}${delay}`)
    .join(', ')
}

/** Opacity-only fade (e.g. image load, content swap). */
export function motionFadeTransition(ease: string = motionEaseReveal): string {
  return `opacity ${motionDurationReveal} ${ease}`
}
