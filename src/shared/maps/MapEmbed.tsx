import * as React from 'react'
import { appEnv } from '@shared/lib/env'

type MapEmbedProps = {
  /** What to show in Maps: full address, place name, or "lat,lng" */
  query: string
  /** Optional: 1–20 (lower = farther out) */
  zoom?: number
  /** Optional sizing; defaults to responsive 16:9 */
  className?: string
  style?: React.CSSProperties
  width?: number | string
  height?: number | string
  title?: string
}

/** Build a Google Maps Embed API place URL, or null when the key is missing. */
export function buildGoogleMapsEmbedUrl(
  query: string,
  zoom?: number,
): string | null {
  const mapsKey = appEnv.googleMapsPlatformApiKey()
  if (!mapsKey) return null

  const url = new URL('https://www.google.com/maps/embed/v1/place')
  url.searchParams.set('q', query) // URL handles encoding (æ/ø/å etc.)
  if (zoom != null) url.searchParams.set('zoom', String(zoom))
  url.searchParams.set('key', mapsKey)
  return url.toString()
}

export default function MapEmbed({
  query,
  zoom,
  className,
  style,
  width = '100%',
  height = 0, // 0 means we’ll use the aspect-ratio container
  title = 'Google Maps location',
}: MapEmbedProps) {
  const url = buildGoogleMapsEmbedUrl(query, zoom)

  if (!url) {
    // Fail loud in dev, quiet in prod
    if (appEnv.isDev()) {
      console.warn(
        'VITE_GOOGLE_MAPS_PLATFORM_API_KEY is missing. Add it to your .env file.',
      )
    }
    return null
  }

  // If caller didn’t provide a fixed height, render a responsive 16:9 box
  const responsive = height === 0

  return (
    <div
      className={className}
      style={{
        position: responsive ? 'relative' : undefined,
        width,
        ...(responsive
          ? {
              aspectRatio:
                '16 / 9' as unknown as React.CSSProperties['aspectRatio'],
            }
          : { height }),
        ...style,
        borderRadius: '5px',
        overflow: 'clip',
      }}
    >
      <iframe
        title={title}
        src={url}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        style={{
          border: 0,
          position: responsive ? 'absolute' : undefined,
          inset: responsive ? 0 : undefined,
          width: '100%',
          height: responsive ? '100%' : height || '100%',
        }}
      />
    </div>
  )
}
