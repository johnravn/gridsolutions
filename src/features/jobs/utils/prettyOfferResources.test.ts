import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectPrettyOfferResources,
  getFilenameFromResourceUrl,
  isPdfResourceUrl,
} from './prettyOfferResources'
import type { PublicPrettyOfferModule } from '../types'

const getPublicUrlMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (...args: unknown[]) => getPublicUrlMock(...args),
      }),
    },
  },
}))

describe('getFilenameFromResourceUrl', () => {
  it('extracts filename from storage URLs', () => {
    expect(
      getFilenameFromResourceUrl(
        'https://cdn.example.com/pretty_offer_media/co/offer/spec.pdf',
      ),
    ).toBe('spec.pdf')
  })
})

describe('isPdfResourceUrl', () => {
  it('detects pdf resources', () => {
    expect(isPdfResourceUrl('https://example.com/file.pdf')).toBe(true)
    expect(isPdfResourceUrl('https://example.com/file.jpg')).toBe(false)
  })
})

describe('collectPrettyOfferResources', () => {
  beforeEach(() => {
    getPublicUrlMock.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }))
  })

  const module: PublicPrettyOfferModule = {
    id: 'mod-1',
    title: 'Lighting',
    sort_order: 0,
    display_price: null,
    show_price: false,
    hero_media_type: 'image',
    hero_media_url: 'co/offer/hero.jpg',
    hero_media_caption: 'Hero shot',
    blocks: [
      {
        id: 'block-gallery',
        module_id: 'mod-1',
        block_type: 'gallery',
        sort_order: 0,
        text_content: null,
        url: null,
        link_title: null,
        caption: null,
        items: [
          {
            id: 'img-1',
            block_id: 'block-gallery',
            sort_order: 0,
            label: '',
            summary: 'Stage photo',
            detail: null,
            url: 'co/offer/stage.jpg',
          },
        ],
      },
      {
        id: 'block-files',
        module_id: 'mod-1',
        block_type: 'file_upload',
        sort_order: 1,
        text_content: 'Specs',
        url: null,
        link_title: null,
        caption: 'Technical documents',
        items: [
          {
            id: 'file-1',
            block_id: 'block-files',
            sort_order: 0,
            label: 'Rigging plan',
            summary: null,
            detail: null,
            url: 'co/offer/rigging.pdf',
          },
        ],
      },
      {
        id: 'block-video',
        module_id: 'mod-1',
        block_type: 'video',
        sort_order: 2,
        text_content: null,
        url: 'co/offer/clip.mp4',
        link_title: 'Showreel',
        caption: null,
        items: [],
      },
      {
        id: 'block-embed',
        module_id: 'mod-1',
        block_type: 'video',
        sort_order: 3,
        text_content: null,
        url: 'https://www.youtube.com/watch?v=abc',
        link_title: 'YouTube',
        caption: null,
        items: [],
      },
    ],
  }

  it('collects hero, gallery, uploaded video, and file resources', () => {
    const resources = collectPrettyOfferResources([module])
    expect(resources).toHaveLength(4)
    expect(resources.map((resource) => resource.kind)).toEqual([
      'image',
      'image',
      'file',
      'video',
    ])
    expect(
      resources.find((resource) => resource.name === 'Rigging plan'),
    ).toMatchObject({
      kind: 'file',
      moduleTitle: 'Lighting',
    })
  })

  it('deduplicates identical URLs', () => {
    const duplicateModule: PublicPrettyOfferModule = {
      ...module,
      hero_media_url: null,
      hero_media_type: null,
      blocks: [
        {
          id: 'block-gallery',
          module_id: 'mod-1',
          block_type: 'gallery',
          sort_order: 0,
          text_content: null,
          url: null,
          link_title: null,
          caption: null,
          items: [
            {
              id: 'img-1',
              block_id: 'block-gallery',
              sort_order: 0,
              label: '',
              summary: null,
              detail: null,
              url: 'co/offer/shared.jpg',
            },
            {
              id: 'img-2',
              block_id: 'block-gallery',
              sort_order: 1,
              label: '',
              summary: null,
              detail: null,
              url: 'co/offer/shared.jpg',
            },
          ],
        },
      ],
    }

    expect(collectPrettyOfferResources([duplicateModule])).toHaveLength(1)
  })
})
