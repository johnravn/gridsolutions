import * as React from 'react'
import { Badge, Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  motionFadeTransition,
  motionRevealTransition,
} from '@shared/lib/motion'
import {
  Download,
  MediaImage,
  MediaVideo,
  NavArrowRight,
  Page,
} from 'iconoir-react'
import {
  collectPrettyOfferResources,
  downloadAllPrettyOfferResources,
  downloadPrettyOfferResource,
} from '../../utils/prettyOfferResources'
import type { PrettyOfferResourceKind } from '../../utils/prettyOfferResources'
import type { PublicPrettyOfferModule } from '../../types'

type Props = {
  modules: Array<PublicPrettyOfferModule>
}

const KIND_LABELS: Record<PrettyOfferResourceKind, string> = {
  image: 'Images',
  video: 'Videos',
  file: 'Files',
}

function ResourceIcon({ kind }: { kind: PrettyOfferResourceKind }) {
  if (kind === 'image') return <MediaImage width={14} height={14} />
  if (kind === 'video') return <MediaVideo width={14} height={14} />
  return <Page width={14} height={14} />
}

export function PrettyOfferResourceSummary({ modules }: Props) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const resources = React.useMemo(
    () => collectPrettyOfferResources(modules),
    [modules],
  )
  const [expanded, setExpanded] = React.useState(false)
  const [downloadingAll, setDownloadingAll] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)

  if (resources.length === 0) return null

  const grouped = resources.reduce<
    Record<PrettyOfferResourceKind, typeof resources>
  >(
    (acc, resource) => {
      acc[resource.kind].push(resource)
      return acc
    },
    { image: [], video: [], file: [] },
  )

  const countLabel = `${resources.length} file${resources.length === 1 ? '' : 's'}`

  const toggleExpanded = () => setExpanded((current) => !current)

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleExpanded()
    }
  }

  const handleDownloadAll = (event: React.MouseEvent) => {
    event.stopPropagation()
    setDownloadingAll(true)
    void downloadAllPrettyOfferResources(resources).finally(() =>
      setDownloadingAll(false),
    )
  }

  return (
    <Box
      className={[
        'pretty-deck-resource-summary',
        expanded ? '' : 'pretty-deck-resource-summary--collapsed',
      ]
        .filter(Boolean)
        .join(' ')}
      role={expanded ? undefined : 'button'}
      tabIndex={expanded ? undefined : 0}
      aria-expanded={expanded}
      onClick={expanded ? undefined : () => setExpanded(true)}
      onKeyDown={expanded ? undefined : handleCardKeyDown}
    >
      <Flex
        align="center"
        justify="between"
        gap="2"
        className="pretty-deck-resource-summary__header"
        role={expanded ? 'button' : undefined}
        tabIndex={expanded ? 0 : undefined}
        onClick={
          expanded
            ? (event) => {
                event.stopPropagation()
                setExpanded(false)
              }
            : undefined
        }
        onKeyDown={expanded ? handleCardKeyDown : undefined}
      >
        <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
          <NavArrowRight
            width={16}
            height={16}
            className="pretty-deck-resource-summary__chevron"
          />
          <Text size="3" weight="medium">
            Resources in this offer
          </Text>
          <Badge size="1" variant="soft" color="gray">
            {countLabel}
          </Badge>
        </Flex>
        <Button
          size="1"
          variant="ghost"
          disabled={downloadingAll}
          onClick={handleDownloadAll}
        >
          <Download width={14} height={14} />
          {downloadingAll ? 'Downloading…' : 'Download all'}
        </Button>
      </Flex>

      <div
        className="pretty-deck-resource-summary__expand"
        style={{
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: prefersReducedMotion
            ? undefined
            : motionRevealTransition(['grid-template-rows']),
        }}
      >
        <div className="pretty-deck-resource-summary__expand-inner">
          <Box
            className="pretty-deck-resource-summary__body"
            style={{
              opacity: expanded ? 1 : 0,
              transition: prefersReducedMotion
                ? undefined
                : motionFadeTransition(),
            }}
          >
            {(['image', 'video', 'file'] as const).map((kind) => {
              const items = grouped[kind]
              if (items.length === 0) return null

              return (
                <Box key={kind} className="pretty-deck-resource-summary__group">
                  <Text size="1" weight="bold" color="gray" mb="1" as="div">
                    {KIND_LABELS[kind].toUpperCase()}
                  </Text>
                  {items.map((resource) => (
                    <Flex
                      key={resource.id}
                      align="center"
                      justify="between"
                      gap="2"
                      className="pretty-deck-resource-summary__row"
                    >
                      <Flex
                        align="center"
                        gap="2"
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <ResourceIcon kind={kind} />
                        <Text size="2" as="div" truncate>
                          {resource.name}
                          <Text as="span" size="1" color="gray">
                            {' · '}
                            {resource.moduleTitle}
                          </Text>
                        </Text>
                      </Flex>
                      <IconButton
                        size="1"
                        variant="ghost"
                        aria-label={`Download ${resource.name}`}
                        disabled={downloadingId === resource.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setDownloadingId(resource.id)
                          void downloadPrettyOfferResource(resource)
                            .catch(() => {
                              window.open(
                                resource.url,
                                '_blank',
                                'noopener,noreferrer',
                              )
                            })
                            .finally(() => setDownloadingId(null))
                        }}
                      >
                        <Download width={14} height={14} />
                      </IconButton>
                    </Flex>
                  ))}
                </Box>
              )
            })}
          </Box>
        </div>
      </div>
    </Box>
  )
}
