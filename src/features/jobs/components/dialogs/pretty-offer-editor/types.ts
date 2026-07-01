import type {
  PrettyAllocationMode,
  PrettyCategoryType,
  PrettyModuleBasisType,
  PrettyModuleBlockType,
  PrettyOfferModule,
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
  PrettyOfferModuleCategoryMapping,
  PrettyOfferModuleManualField,
  PrettyOfferSubcontractorAllocation,
  PrettyOfferSubcontractorQuote,
} from '../../../types'

export type LocalManualField = PrettyOfferModuleManualField & {
  id: string
}

export type LocalCategoryMapping = PrettyOfferModuleCategoryMapping & {
  id: string
}

export type LocalBlockItem = PrettyOfferModuleBlockItem & {
  id: string
}

export type LocalContentBlock = Omit<PrettyOfferModuleBlock, 'items'> & {
  id: string
  items: Array<LocalBlockItem>
}

export type LocalPrettyModule = Omit<
  PrettyOfferModule,
  'manual_fields' | 'category_mappings' | 'content_blocks' | 'media'
> & {
  manual_fields: Array<LocalManualField>
  category_mappings: Array<LocalCategoryMapping>
  content_blocks: Array<LocalContentBlock>
}

export type LocalSubcontractorAllocation =
  PrettyOfferSubcontractorAllocation & {
    id: string
  }

export type LocalSubcontractorQuote = Omit<
  PrettyOfferSubcontractorQuote,
  'allocations'
> & {
  allocations: Array<LocalSubcontractorAllocation>
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
    basis_type: 'manual',
    display_price: null,
    show_price: false,
    computed_cost: 0,
    manual_fields: [],
    category_mappings: [],
    content_blocks: [],
  }
}

export function createEmptyManualField(
  moduleId: string,
  sortOrder: number,
): LocalManualField {
  return {
    id: createTempId('field'),
    module_id: moduleId,
    label: '',
    value: '',
    sort_order: sortOrder,
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

export function createEmptyQuote(sortOrder: number): LocalSubcontractorQuote {
  return {
    id: createTempId('quote'),
    offer_id: '',
    vendor_name: '',
    note: '',
    total_amount: 0,
    customer_id: null,
    pdf_path: null,
    pdf_filename: null,
    mime_type: null,
    size_bytes: null,
    sort_order: sortOrder,
    allocations: [],
  }
}

export function createEmptyAllocation(
  quoteId: string,
  moduleId: string,
  mode: PrettyAllocationMode = 'percent',
): LocalSubcontractorAllocation {
  return {
    id: createTempId('alloc'),
    quote_id: quoteId,
    module_id: moduleId,
    allocation_mode: mode,
    allocation_value: 0,
  }
}

export const BASIS_TYPE_LABELS: Record<PrettyModuleBasisType, string> = {
  manual: 'Manual inputs',
  subcontractor: 'Subcontractor quotes',
  technical: 'Technical offer categories',
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
