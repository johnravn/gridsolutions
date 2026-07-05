import * as React from 'react'
import { getBlurredPlaceholderUrl } from '@shared/lib/storageImageUrls'
import './LazyImage.css'

type LazyImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'loading'
> & {
  /** How far before the viewport to start loading. Default 200px. */
  rootMargin?: string
  /** Skip lazy loading and load immediately (still shows blur-up). */
  eager?: boolean
}

export default function LazyImage({
  src,
  alt,
  className,
  style,
  rootMargin = '200px',
  eager = false,
  onLoad,
  ...rest
}: LazyImageProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = React.useState(eager)
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [placeholderFailed, setPlaceholderFailed] = React.useState(false)

  const resolvedSrc = typeof src === 'string' ? src : undefined
  const placeholderSrc = React.useMemo(
    () => (resolvedSrc ? getBlurredPlaceholderUrl(resolvedSrc) : null),
    [resolvedSrc],
  )
  const useTinyPlaceholder = Boolean(placeholderSrc && !placeholderFailed)

  React.useEffect(() => {
    if (eager || !containerRef.current || isVisible) return

    const node = containerRef.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [eager, isVisible, rootMargin])

  React.useEffect(() => {
    setIsLoaded(false)
    setPlaceholderFailed(false)
  }, [resolvedSrc])

  const objectFit =
    typeof style?.objectFit === 'string' ? style.objectFit : 'cover'

  const fullImageClass = [
    'lazy-image__full',
    isLoaded
      ? 'lazy-image__full--loaded'
      : useTinyPlaceholder
        ? ''
        : 'lazy-image__full--blur-loading',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={containerRef}
      className={['lazy-image', className].filter(Boolean).join(' ')}
      style={style}
    >
      {isVisible && useTinyPlaceholder && placeholderSrc && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden
          className={[
            'lazy-image__placeholder',
            isLoaded ? 'lazy-image__placeholder--hidden' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ objectFit }}
          onError={() => setPlaceholderFailed(true)}
        />
      )}

      {isVisible && resolvedSrc && (
        <img
          {...rest}
          src={resolvedSrc}
          alt={alt ?? ''}
          className={fullImageClass}
          style={{ objectFit }}
          onLoad={(event) => {
            setIsLoaded(true)
            onLoad?.(event)
          }}
        />
      )}
    </div>
  )
}
