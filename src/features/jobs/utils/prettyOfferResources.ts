import { parseColumnLayoutColumns } from './columnLayoutStorage'
import { parseOptionsGroups } from './optionsBlockStorage'
import {
  isStorageMediaPath,
  resolvePrettyOfferMediaUrl,
} from './prettyOfferMediaUpload'
import type { PrettyOfferModuleBlock, PublicPrettyOfferModule } from '../types'

export type PrettyOfferResourceKind = 'image' | 'video' | 'file'

export type PrettyOfferResource = {
  id: string
  name: string
  url: string
  kind: PrettyOfferResourceKind
  moduleTitle: string
}

export function getFilenameFromResourceUrl(
  url: string,
  fallback = 'file',
): string {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split('/').pop()
    if (segment) return decodeURIComponent(segment)
  } catch {
    const segment = url.split('/').pop()
    if (segment) return decodeURIComponent(segment)
  }
  return fallback
}

export function isPdfResourceUrl(url: string): boolean {
  return /\.pdf($|[?#])/i.test(url)
}

function resolveResourceUrl(url: string): string | null {
  if (!url.trim()) return null
  if (isStorageMediaPath(url)) return resolvePrettyOfferMediaUrl(url)
  return url
}

function addResource(
  resources: Array<PrettyOfferResource>,
  seen: Set<string>,
  entry: Omit<PrettyOfferResource, 'url'> & { url: string | null | undefined },
) {
  const resolvedUrl = entry.url ? resolveResourceUrl(entry.url) : null
  if (!resolvedUrl || seen.has(resolvedUrl)) return
  seen.add(resolvedUrl)
  resources.push({ ...entry, url: resolvedUrl })
}

function collectFromBlocks(
  blocks: Array<PrettyOfferModuleBlock>,
  moduleTitle: string,
  resources: Array<PrettyOfferResource>,
  seen: Set<string>,
) {
  const sorted = [...blocks].sort((a, b) => a.sort_order - b.sort_order)

  for (const block of sorted) {
    switch (block.block_type) {
      case 'gallery':
        for (const item of block.items ?? []) {
          if (!item.url) continue
          addResource(resources, seen, {
            id: item.id,
            name:
              item.summary?.trim() ||
              item.label?.trim() ||
              getFilenameFromResourceUrl(item.url, 'Image'),
            url: item.url,
            kind: 'image',
            moduleTitle,
          })
        }
        break
      case 'video':
        if (!block.url || !isStorageMediaPath(block.url)) break
        addResource(resources, seen, {
          id: block.id,
          name:
            block.link_title?.trim() ||
            block.caption?.trim() ||
            getFilenameFromResourceUrl(block.url, 'Video'),
          url: block.url,
          kind: 'video',
          moduleTitle,
        })
        break
      case 'file_upload':
        for (const item of block.items ?? []) {
          if (!item.url) continue
          addResource(resources, seen, {
            id: item.id,
            name:
              item.label?.trim() ||
              item.summary?.trim() ||
              getFilenameFromResourceUrl(item.url, 'Document'),
            url: item.url,
            kind: 'file',
            moduleTitle,
          })
        }
        break
      case 'column_layout':
        for (const column of parseColumnLayoutColumns(block.items)) {
          collectFromBlocks(column.blocks, moduleTitle, resources, seen)
        }
        break
      case 'options':
        for (const group of parseOptionsGroups(block.items)) {
          for (const option of group.options) {
            collectFromBlocks(option.blocks, moduleTitle, resources, seen)
          }
        }
        break
    }
  }
}

export function collectPrettyOfferResources(
  modules: Array<PublicPrettyOfferModule>,
): Array<PrettyOfferResource> {
  const resources: Array<PrettyOfferResource> = []
  const seen = new Set<string>()

  const sortedModules = [...modules].sort((a, b) => a.sort_order - b.sort_order)

  for (const module of sortedModules) {
    if (module.hero_media_url && module.hero_media_type === 'image') {
      addResource(resources, seen, {
        id: `${module.id}-hero`,
        name: module.hero_media_caption?.trim() || `${module.title} hero image`,
        url: module.hero_media_url,
        kind: 'image',
        moduleTitle: module.title,
      })
    }

    if (
      module.hero_media_url &&
      module.hero_media_type === 'video' &&
      isStorageMediaPath(module.hero_media_url)
    ) {
      addResource(resources, seen, {
        id: `${module.id}-hero-video`,
        name: module.hero_media_caption?.trim() || `${module.title} hero video`,
        url: module.hero_media_url,
        kind: 'video',
        moduleTitle: module.title,
      })
    }

    collectFromBlocks(module.blocks ?? [], module.title, resources, seen)
  }

  return resources
}

export async function downloadPrettyOfferResource(
  resource: Pick<PrettyOfferResource, 'url' | 'name'>,
): Promise<void> {
  const response = await fetch(resource.url)
  if (!response.ok) throw new Error('Download failed')

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = getFilenameFromResourceUrl(resource.url, resource.name)
  document.body.appendChild(anchor)
  anchor.click()
  URL.revokeObjectURL(objectUrl)
  document.body.removeChild(anchor)
}

export async function downloadAllPrettyOfferResources(
  resources: Array<PrettyOfferResource>,
): Promise<void> {
  for (const resource of resources) {
    try {
      await downloadPrettyOfferResource(resource)
    } catch {
      window.open(resource.url, '_blank', 'noopener,noreferrer')
    }
    await new Promise((resolve) => window.setTimeout(resolve, 350))
  }
}
