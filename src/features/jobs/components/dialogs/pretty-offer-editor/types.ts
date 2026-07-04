import type {
  PrettyCategoryType,
  PrettyModuleBlockType,
  PrettyOfferModule,
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
  PrettyOfferPricingBasis,
  PrettyOfferPricingBasisSplit,
  PrettyPricingBasisType,
} from '../../../types'

export type LocalBlockItem = PrettyOfferModuleBlockItem & {
  id: string
}

export type LocalContentBlock = Omit<PrettyOfferModuleBlock, 'items'> & {
  id: string
  items: Array<LocalBlockItem>
}

export type LocalPrettyModule = Omit<
  PrettyOfferModule,
  'content_blocks' | 'media' | 'blocks'
> & {
  content_blocks: Array<LocalContentBlock>
}

export type LocalPricingBasisSplit = PrettyOfferPricingBasisSplit & {
  id: string
}

export type LocalPricingBasis = Omit<PrettyOfferPricingBasis, 'splits'> & {
  id: string
  splits: Array<LocalPricingBasisSplit>
}

export function createTempId(prefix: string): string {
  return `temp-${prefix}-${crypto.randomUUID()}`
}

export function createEmptyModule(sortOrder: number): LocalPrettyModule {
  return {
    id: createTempId('module'),
    offer_id: '',
    title: '',
    subtitle: null,
    sort_order: sortOrder,
    display_price: null,
    show_price: false,
    computed_cost: 0,
    content_blocks: [],
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

  if (blockType === 'gallery') {
    base.items = [createEmptyBlockItem(id, 0)]
  }

  return base
}

export function createEmptyPricingBasis(
  sortOrder: number,
  basisType: PrettyPricingBasisType,
): LocalPricingBasis {
  const titles: Record<PrettyPricingBasisType, string> = {
    technical: 'Technical offer',
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
    job_subcontractor_quote_id: null,
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
  technical: 'Internal technical offer',
  subcontractor: 'Subcontractor basis',
  custom: 'Custom',
}

export const CATEGORY_TYPE_LABELS: Record<PrettyCategoryType, string> = {
  equipment_group: 'Equipment group',
  crew_category: 'Crew category',
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
  timeline: 'Program timeline',
}

export const LIST_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'simple_list',
  'interactive_list',
])

export const TIMELINE_BLOCK_TYPES = new Set<PrettyModuleBlockType>(['timeline'])

export const GALLERY_BLOCK_TYPES = new Set<PrettyModuleBlockType>(['gallery'])

export const VIDEO_BLOCK_TYPES = new Set<PrettyModuleBlockType>(['video'])

export const MEDIA_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'video',
  'link',
])

export const TEXT_BLOCK_TYPES = new Set<PrettyModuleBlockType>([
  'subtitle',
  'description',
])
