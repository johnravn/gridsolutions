import { createColumnLayoutItems } from './columnLayoutStorage'
import type {
  PrettyCategoryType,
  PrettyModuleBlockType,
  PrettyModuleType,
  PrettyOfferModule,
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
  PrettyOfferModuleTimelineItem,
  PrettyOfferPricingBasis,
  PrettyOfferPricingBasisSplit,
  PrettyPricingBasisType,
} from '../../../types'

export type LocalBlockItem = PrettyOfferModuleBlockItem & {
  id: string
}

export type LocalTimelineItem = PrettyOfferModuleTimelineItem & {
  id: string
}

export type LocalContentBlock = Omit<PrettyOfferModuleBlock, 'items'> & {
  id: string
  items: Array<LocalBlockItem>
}

export type LocalPrettyModule = Omit<
  PrettyOfferModule,
  'content_blocks' | 'media' | 'blocks' | 'timeline_items'
> & {
  module_type: PrettyModuleType
  content_blocks: Array<LocalContentBlock>
  timeline_items: Array<LocalTimelineItem>
}

export type LocalPricingBasisSplit = PrettyOfferPricingBasisSplit & {
  id: string
}

export type LocalPricingBasis = Omit<PrettyOfferPricingBasis, 'splits'> & {
  id: string
  splits: Array<LocalPricingBasisSplit>
  /** Editor-only: which job subcontractor this basis represents */
  source_job_subcontractor_id?: string | null
}

export function createTempId(prefix: string): string {
  return `temp-${prefix}-${crypto.randomUUID()}`
}

export function createEmptyModule(sortOrder: number): LocalPrettyModule {
  return {
    id: createTempId('module'),
    offer_id: '',
    module_type: 'standard',
    title: '',
    subtitle: null,
    tagline: null,
    story_heading_1: null,
    story_body_1: null,
    story_heading_2: null,
    story_body_2: null,
    hero_media_type: 'image',
    hero_media_url: null,
    hero_media_caption: null,
    sort_order: sortOrder,
    display_price: null,
    show_price: false,
    computed_cost: 0,
    content_blocks: [],
    timeline_items: [],
  }
}

export function createEmptyTimelineModule(sortOrder: number): LocalPrettyModule {
  return {
    ...createEmptyModule(sortOrder),
    module_type: 'timeline',
    title: 'Program timeline',
    hero_media_type: null,
    hero_media_url: null,
  }
}

export function createEmptyBlockItem(
  blockId: string,
  sortOrder: number,
): LocalBlockItem {
  return {
    id: createTempId('block-item'),
    block_id: blockId,
    label: '',
    summary: null,
    detail: null,
    sort_order: sortOrder,
  }
}

export function createEmptyContentBlock(
  moduleId: string,
  sortOrder: number,
  blockType: PrettyModuleBlockType,
): LocalContentBlock {
  const id = createTempId('block')
  const base: LocalContentBlock = {
    id,
    module_id: moduleId,
    block_type: blockType,
    sort_order: sortOrder,
    text_content: null,
    url: null,
    link_title: null,
    caption: null,
    items: [],
  }

  if (blockType === 'simple_list' || blockType === 'interactive_list') {
    base.items = [createEmptyBlockItem(id, 0)]
  }

  if (blockType === 'gallery' || blockType === 'file_upload') {
    base.items = [createEmptyBlockItem(id, 0)]
  }

  if (blockType === 'column_layout') {
    base.caption = '2'
    base.items = createColumnLayoutItems(id, 2)
  }

  return base
}

export function createEmptyPricingBasis(
  sortOrder: number,
  basisType: PrettyPricingBasisType,
): LocalPricingBasis {
  const titles: Record<PrettyPricingBasisType, string> = {
    technical: 'Offer basis',
    subcontractor: 'Subcontractor quote',
    custom: 'Custom basis',
  }
  return {
    id: createTempId('basis'),
    offer_id: '',
    basis_type: basisType,
    title: titles[basisType],
    sort_order: sortOrder,
    source_technical_offer_id: null,
    source_offer_basis_id: null,
    job_subcontractor_quote_id: null,
    apply_subcontractor_markup: true,
    splits: [],
  }
}

export function createEmptySplit(
  basisId: string,
  moduleId: string,
  sortOrder: number,
): LocalPricingBasisSplit {
  return {
    id: createTempId('split'),
    basis_id: basisId,
    module_id: moduleId,
    title: '',
    amount: 0,
    sort_order: sortOrder,
    category_type: null,
    category_key: null,
  }
}

export const BASIS_TYPE_LABELS: Record<PrettyPricingBasisType, string> = {
  technical: 'Offer basis',
  subcontractor: 'Subcontractor basis',
  custom: 'Custom',
}

export const CATEGORY_TYPE_LABELS: Record<PrettyCategoryType, string> = {
  equipment_group: 'Equipment group',
  crew_category: 'Crew role',
  transport_group: 'Transport group',
}

export const BLOCK_TYPE_LABELS: Record<PrettyModuleBlockType, string> = {
  subtitle: 'Subtitle',
  description: 'Description',
  simple_list: 'Simple list',
  interactive_list: 'Interactive list',
  gallery: 'Image gallery',
  video: 'Video',
  link: 'Link',
  column_layout: 'Column layout',
  file_upload: 'File upload',
}

export const MODULE_TYPE_LABELS: Record<PrettyModuleType, string> = {
  standard: 'Standard',
  timeline: 'Program timeline',
}

export const COLUMN_LAYOUT_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'column_layout',
])

export const NESTED_ADDABLE_BLOCK_TYPES: Array<PrettyModuleBlockType> = [
  'subtitle',
  'description',
  'simple_list',
  'interactive_list',
  'gallery',
  'video',
  'link',
  'file_upload',
]

export const TOP_LEVEL_ADDABLE_BLOCK_TYPES: Array<PrettyModuleBlockType> = [
  ...NESTED_ADDABLE_BLOCK_TYPES,
  'column_layout',
]

export const LIST_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'simple_list',
  'interactive_list',
])

export const GALLERY_BLOCK_TYPES = new Set<PrettyModuleBlockType>(['gallery'])

export const FILE_UPLOAD_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'file_upload',
])

export const VIDEO_BLOCK_TYPES = new Set<PrettyModuleBlockType>(['video'])

export const MEDIA_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'video',
  'link',
])

export const TEXT_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'subtitle',
  'description',
])
