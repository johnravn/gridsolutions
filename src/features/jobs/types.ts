// src/features/jobs/types.ts

export type UUID = string

/* ---------- Job core ---------- */

export type JobStatus =
  | 'draft'
  | 'planned'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'invoiced'
  | 'paid'

export type InvoiceBasis = 'offer' | 'bookings'

export type JobListRow = {
  id: UUID
  company_id: UUID
  title: string
  jobnr: number | null
  status: JobStatus
  start_at: string | null
  end_at: string | null
  customer_contact_id: UUID | null
  archived: boolean
  recurring_job_id?: UUID | null
  customer?: {
    id: UUID
    name: string | null
  } | null
  customer_user?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null
  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
  recurring_job?: {
    id: UUID
    title: string
  } | null
}

/* ---------- Recurring jobs ---------- */

export type RecurringJobListRow = {
  id: UUID
  company_id: UUID
  title: string
  description: string | null
  archived: boolean
  job_count: number
  customer?: {
    id: UUID
    name: string | null
  } | null
  customer_user?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null
  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
    avatar_url: string | null
  } | null
  customer_contact?: {
    id: UUID
    name: string
    email: string | null
    phone: string | null
  } | null
}

export type RecurringJobDetail = RecurringJobListRow & {
  project_lead_user_id: UUID | null
  customer_id: UUID | null
  customer_user_id: UUID | null
  customer_contact_id: UUID | null
  jobs: Array<JobListRow>
}

export type RecurringJobTemplateCrewRole = {
  title: string
  needed_count: number
  role_category: string | null
}

export type RecurringJobTemplate = {
  id: UUID
  recurring_job_id: UUID
  company_id: UUID
  name: string
  title: string
  description: string | null
  status: JobStatus
  duration_hours: number
  start_time: string | null
  crew_roles: Array<RecurringJobTemplateCrewRole>
  sort_order: number
}

export type RecurringJobCrewEntry = {
  user_id: UUID
  display_name: string | null
  email: string
  avatar_url: string | null
  bookings: Array<{
    job_id: UUID
    job_title: string
    jobnr: number | null
    role_title: string | null
    start_at: string | null
    end_at: string | null
    status: string
  }>
}

export type RecurringJobInvoiceEntry = {
  job_id: UUID
  job_title: string
  jobnr: number | null
  status: JobStatus
  invoice_count: number
  last_invoice_at: string | null
}

export type RecurringJobBookingSummary = {
  job_id: UUID
  job_title: string
  jobnr: number | null
  equipment_count: number
  crew_count: number
  transport_count: number
}

export type JobsPageSelection =
  | { kind: 'job'; id: UUID }
  | { kind: 'recurring_job'; id: UUID }
  | null

export type AddressListRow = {
  id: UUID
  company_id: UUID
  name: string | null
  address_line: string
  zip_code: string
  city: string
  country: string
  deleted: boolean
  is_personal: boolean
}

export type JobDetail = {
  id: UUID
  company_id: UUID
  title: string
  jobnr: number | null
  description: string | null
  status: JobStatus
  start_at: string | null
  end_at: string | null
  load_in_at: string | null
  load_out_at: string | null
  archived: boolean
  invoice_basis: InvoiceBasis | null
  recurring_job_id: UUID | null

  project_lead_user_id: UUID | null
  customer_id: UUID | null
  customer_user_id: UUID | null
  customer_contact_id: UUID | null
  job_address_id: UUID | null

  customer?: {
    id: UUID
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
    vat_number: string | null
    conta_customer_id?: number | null
    conta_days_until_payment_reminder?: number | null
  } | null

  customer_user?: {
    user_id: UUID
    display_name: string | null
    email: string
    phone: string | null
  } | null

  project_lead?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null

  recurring_job?: {
    id: UUID
    title: string
  } | null

  customer_contact?: {
    user_id: UUID
    name: string | null
    email: string | null
    phone: string | null
    title: string | null
  } | null

  address?: {
    id: UUID
    name: string
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

/* ---------- Equipment tab ---------- */

export type ExternalReqStatus = 'planned' | 'requested' | 'confirmed'

export type InventoryItemKind = 'stock' | 'subrental'

export type ItemLite = {
  id: string
  name: string
  category_id?: string | null
  brand_id?: string | null
  model?: string | null
  total_quantity?: number | null
  active?: boolean
  item_kind?: InventoryItemKind
  notes?: string | null

  // Joined relations (optional)
  category?: {
    id: string
    name: string
  } | null

  brand?: {
    id: string
    name: string
  } | null

  // Optional price info if joined in your query
  price?: number | null
}

/**
 * Supabase may type nested single relations as an array when the FK
 * isn't inferred. Allow both shapes so UI can normalize.
 */
export type ReservedItemRow = {
  id: UUID
  time_period_id: UUID
  item_id: UUID
  quantity: number
  source_group_id: UUID | null
  source_kind: 'direct' | 'group'
  status: BookingStatus
  external_status: ExternalReqStatus | null
  external_note: string | null
  forced: boolean
  subcontractor_id?: UUID | null
  start_at: string | null // line override (ISO) - nullable => inherits header
  end_at: string | null // line override (ISO)
  item:
    | { id: UUID; name: string; item_kind?: InventoryItemKind }
    | Array<{ id: UUID; name: string; item_kind?: InventoryItemKind }>
  subcontractor?:
    | { id: UUID; name: string }
    | Array<{ id: UUID; name: string }>
    | null
  source_group?:
    | {
        id: UUID
        name: string
        category_id?: UUID | null
        category?: { name: string } | null
      }
    | Array<{
        id: UUID
        name: string
        category_id?: UUID | null
        category?: { name: string } | null
      }>
    | null
}

export type TimePeriodStatus =
  | 'tentative'
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'

export type TimePeriodLite = {
  id: UUID
  job_id: UUID | null
  company_id: UUID
  title: string | null
  start_at: string // ISO
  end_at: string // ISO
  category?: 'program' | 'equipment' | 'crew' | 'transport' | null
  program_group?: string | null
}

/* ---------- Crew tab ---------- */

export type BookingStatus = 'planned' | 'confirmed' | 'canceled'

// Legacy type for backward compatibility
export type CrewReqStatus = BookingStatus

export type ReservedCrewRow = {
  id: UUID
  time_period_id: UUID
  user_id: UUID | null
  notes: string | null
  placeholder_name?: string | null
  status: BookingStatus
  forced?: boolean
  start_at: string | null
  end_at: string | null
  user?: {
    user_id: UUID
    display_name: string | null
    email: string
  } | null
}

/* ---------- Transport tab ---------- */

export type ReservedVehicleRow = {
  id: UUID
  time_period_id: UUID
  vehicle_id: UUID
  status: BookingStatus
  forced?: boolean
  external_status: ExternalReqStatus | null
  external_note: string | null
  vehicle?: {
    id: UUID
    name: string
    image_path: string | null
    external_owner_id: UUID | null
  } | null
  time_period?: {
    id: UUID
    title: string | null
    notes: string | null
    start_at: string
    end_at: string
  } | null
}

/* ---------- Offers system ---------- */

export type OfferType = 'technical' | 'pretty'
export type OfferStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'superseded'

export type PrettySectionType =
  | 'hero'
  | 'problem'
  | 'solution'
  | 'benefits'
  | 'testimonial'

export type JobOffer = {
  id: UUID
  job_id: UUID
  company_id: UUID
  offer_type: OfferType
  version_number: number
  offernr: number | null
  status: OfferStatus
  access_token: string
  title: string
  days_of_use: number
  discount_percent: number
  vat_percent: number
  show_price_per_line: boolean
  equipment_subtotal: number
  crew_subtotal: number
  transport_subtotal: number
  total_before_discount: number
  total_after_discount: number
  total_with_vat: number
  based_on_offer_id: UUID | null
  locked: boolean
  created_at: string
  updated_at: string
  bookings_synced_at: string | null
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  accepted_by_name: string | null
  accepted_by_email: string | null
  accepted_by_phone: string | null
  rejected_at: string | null
  rejected_by_name: string | null
  rejected_by_phone: string | null
  rejection_comment: string | null
  revision_requested_at: string | null
  revision_requested_by_name: string | null
  revision_requested_by_phone: string | null
  revision_comment: string | null
  sent_via_email_at?: string | null
  sent_via_email_to?: string | null
  email_provider_message_id?: string | null
  delivered_via_email_at?: string | null
  copied_from_job_id?: UUID | null
  copied_from_offer_id?: UUID | null
  source_technical_offer_id?: UUID | null
  offer_basis_id: UUID
  pretty_use_customer_accent?: boolean
  pretty_use_customer_background?: boolean
  pretty_intro_text?: string | null
  pretty_subcontractor_markup_percent?: number | null
}

export type PrettyModuleHeroMediaType = 'image' | 'video'

export type OfferBasis = {
  id: UUID
  job_id: UUID
  company_id: UUID
  title: string
  days_of_use: number
  discount_percent: number
  vat_percent: number
  bookings_synced_at: string | null
  created_at: string
  updated_at: string
}

export type OfferBasisDetail = OfferBasis & {
  groups: Array<OfferEquipmentGroup & { items: Array<OfferEquipmentItem> }>
  crew_items: Array<OfferCrewItem>
  transport_groups: Array<
    OfferTransportGroup & { items: Array<OfferTransportItem> }
  >
  transport_items: Array<OfferTransportItem>
  offers?: Array<JobOffer>
}

export type OfferEquipmentGroup = {
  id: UUID
  offer_basis_id: UUID
  group_name: string
  sort_order: number
  created_at: string
}

export type OfferEquipmentItem = {
  id: UUID
  offer_group_id: UUID
  item_id: UUID | null
  group_id: UUID | null
  quantity: number
  unit_price: number
  total_price: number
  is_internal: boolean
  sort_order: number
  /** Free-text description for custom/one-off lines when item_id and group_id are both null. */
  custom_line_description?: string | null
  custom_line_brand?: string | null
  custom_line_model?: string | null
  // Joined relation
  item?: {
    id: UUID
    name: string
    item_kind?: InventoryItemKind
    brand?: { id: UUID; name: string } | null
    model?: string | null
  } | null
  group?: {
    id: UUID
    name: string
    item_kind?: InventoryItemKind
  } | null
  /** Nested contents when this line is a group (item group / bundle). Supports nested groups. */
  group_contents?: Array<GroupContentEntry>
}

/** One entry in group_contents: either an item or a nested group with its own items. */
export type GroupContentEntry =
  | {
      type: 'item'
      name: string
      brand_name?: string | null
      model?: string | null
      quantity: number
    }
  | {
      type: 'group'
      name: string
      quantity: number
      items: Array<GroupContentEntry>
    }

export type OfferCrewItem = {
  id: UUID
  offer_basis_id: UUID
  role_title: string
  role_category?: string | null
  crew_count: number
  start_date: string
  end_date: string
  daily_rate: number
  hourly_rate?: number | null
  hours_per_day?: number | null
  billing_type?: 'daily' | 'hourly' | null
  total_price: number
  sort_order: number
}

export type OfferTransportItem = {
  id: UUID
  offer_basis_id: UUID
  transport_group_id?: UUID
  vehicle_name: string
  vehicle_id: UUID | null
  vehicle_category:
    | 'passenger_car_small'
    | 'passenger_car_medium'
    | 'passenger_car_big'
    | 'van_small'
    | 'van_medium'
    | 'van_big'
    | 'C1'
    | 'C1E'
    | 'C'
    | 'CE'
    | null
  distance_km: number | null
  start_date: string
  end_date: string
  days_used?: number | null
  daily_rate_count?: number | null
  daily_rate: number
  distance_rate?: number | null
  total_price: number
  is_internal: boolean
  sort_order: number
  // Joined relation
  vehicle?: {
    id: UUID
    name: string
    external_owner_id?: UUID | null
  } | null
}

export type OfferTransportGroup = {
  id: UUID
  offer_basis_id: UUID
  group_name: string
  sort_order: number
  created_at: string
}

export type OfferPrettySection = {
  id: UUID
  offer_id: UUID
  section_type: PrettySectionType
  title: string | null
  content: string | null
  image_url: string | null
  sort_order: number
}

export type PrettyPricingBasisType = 'technical' | 'subcontractor' | 'custom'
export type PrettyCategoryType =
  | 'equipment_group'
  | 'crew_category'
  | 'transport_group'
export type PrettyModuleMediaType = 'image' | 'video' | 'link'

export type PrettyModuleType = 'standard' | 'timeline'

export type PrettyModuleBlockType =
  | 'subtitle'
  | 'description'
  | 'simple_list'
  | 'interactive_list'
  | 'gallery'
  | 'video'
  | 'link'
  | 'column_layout'
  | 'file_upload'

export type PrettyOfferModuleTimelineItem = {
  id: UUID
  module_id: UUID
  sort_order: number
  label: string
  summary: string | null
  detail: string | null
  start_at?: string | null
  end_at?: string | null
}

export type PrettyOfferModuleBlockItem = {
  id: UUID
  block_id: UUID
  sort_order: number
  label: string
  summary: string | null
  detail: string | null
  url?: string | null
  start_at?: string | null
  end_at?: string | null
}

export type PrettyOfferModuleBlock = {
  id: UUID
  module_id: UUID
  block_type: PrettyModuleBlockType
  sort_order: number
  text_content: string | null
  url: string | null
  link_title: string | null
  caption: string | null
  items?: Array<PrettyOfferModuleBlockItem>
}

export type PrettyOfferModuleMedia = {
  id: UUID
  module_id: UUID
  media_type: PrettyModuleMediaType
  url: string
  title: string | null
  caption: string | null
  sort_order: number
}

export type JobSubcontractorQuote = {
  id: UUID
  job_id: UUID
  job_subcontractor_id: UUID
  version_number: number
  total_amount: number
  note: string | null
  pdf_path: string | null
  pdf_filename: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export type PrettyOfferPricingBasisSplit = {
  id: UUID
  basis_id: UUID
  module_id: UUID
  title: string
  amount: number
  sort_order: number
  category_type: PrettyCategoryType | null
  category_key: string | null
}

export type PrettyOfferPricingBasis = {
  id: UUID
  offer_id: UUID
  basis_type: PrettyPricingBasisType
  title: string
  sort_order: number
  source_technical_offer_id: UUID | null
  source_offer_basis_id: UUID | null
  job_subcontractor_quote_id: UUID | null
  apply_subcontractor_markup?: boolean
  splits?: Array<PrettyOfferPricingBasisSplit>
}

export type PrettyOfferModule = {
  id: UUID
  offer_id: UUID
  module_type?: PrettyModuleType
  title: string
  subtitle: string | null
  tagline?: string | null
  story_heading_1?: string | null
  story_body_1?: string | null
  story_heading_2?: string | null
  story_body_2?: string | null
  hero_media_type?: PrettyModuleHeroMediaType | null
  hero_media_url?: string | null
  hero_media_caption?: string | null
  sort_order: number
  display_price: number | null
  show_price: boolean
  computed_cost: number
  timeline_items?: Array<PrettyOfferModuleTimelineItem>
  content_blocks?: Array<PrettyOfferModuleBlock>
  /** Customer-facing blocks from public_offer_get */
  blocks?: Array<PrettyOfferModuleBlock>
  /** @deprecated use content_blocks */
  media?: Array<PrettyOfferModuleMedia>
}

/** Customer-visible module shape returned by public_offer_get */
export type PublicPrettyOfferModule = {
  id: UUID
  module_type?: PrettyModuleType
  title: string
  tagline?: string | null
  story_heading_1?: string | null
  story_body_1?: string | null
  story_heading_2?: string | null
  story_body_2?: string | null
  hero_media_type?: PrettyModuleHeroMediaType | null
  hero_media_url?: string | null
  hero_media_caption?: string | null
  sort_order: number
  display_price: number | null
  computed_cost?: number
  show_price: boolean
  timeline_items?: Array<PrettyOfferModuleTimelineItem>
  blocks: Array<PrettyOfferModuleBlock>
}

export type PrettyOfferDetail = OfferDetail & {
  modules?: Array<PrettyOfferModule>
  pricing_bases?: Array<PrettyOfferPricingBasis>
}

// Detail with joined relations
export type OfferDetail = JobOffer & {
  groups?: Array<OfferEquipmentGroup & { items: Array<OfferEquipmentItem> }>
  crew_items?: Array<OfferCrewItem>
  transport_items?: Array<OfferTransportItem>
  transport_groups?: Array<
    OfferTransportGroup & { items: Array<OfferTransportItem> }
  >
  pretty_sections?: Array<OfferPrettySection>
  modules?: Array<PrettyOfferModule>
  pricing_bases?: Array<PrettyOfferPricingBasis>
  job_title?: string | null
  job_start_at?: string | null
  job_end_at?: string | null
  job_address?: string | null
  company_terms?: {
    type: 'pdf' | 'text' | null
    text: string | null
    pdf_path: string | null
  }
  company_expansion?: {
    vehicle_daily_rate: number | null
    vehicle_distance_rate: number | null
    vehicle_distance_increment: number | null
    rental_factor_config?: unknown | null
  }
  customer?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
    logo_path: string | null
    accent_color?: string | null
    accent_color_custom?: string | null
  }
  customer_contact?: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
  }
  project_lead?: {
    user_id: string
    display_name: string | null
    email: string
    phone: string | null
  }
  company?: {
    id: string
    name: string
    address: string | null
    logo_light_path: string | null
    logo_dark_path: string | null
    accent_color?: string | null
  }
}

// Acceptance data
export type OfferAcceptance = {
  first_name: string
  last_name: string
  phone: string
  terms_accepted: boolean
}

// Rejection data
export type OfferRejection = {
  first_name: string
  last_name: string
  phone: string
  comment: string
}

// Revision request data
export type OfferRevisionRequest = {
  first_name: string
  last_name: string
  phone: string
  comment: string
}
