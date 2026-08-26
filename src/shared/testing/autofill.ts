/**
 * Shared helpers for dev/testing auto-fill buttons.
 * Combinatorial word banks yield hundreds of unique variations per form.
 *
 * Flip to `true` to show Auto-fill controls in create dialogs again.
 */
export const SHOW_AUTOFILL_BUTTONS = false

export function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export function pickRandomFrom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null
  return pickRandom(items)
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability
}

export function shuffle<T>(items: readonly T[]): Array<T> {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickRandomSubset<T>(
  items: readonly T[],
  minCount: number,
  maxCount: number,
): Array<T> {
  if (items.length === 0) return []
  const count = Math.min(
    items.length,
    randomInt(minCount, Math.max(minCount, maxCount)),
  )
  return shuffle(items).slice(0, count)
}

export function randomRegistrationNo(): string {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  return `${letters[randomInt(0, letters.length - 1)]}${letters[randomInt(0, letters.length - 1)]}${randomInt(10000, 99999)}`
}

const ITEM_BASE_NAMES = [
  'XLR Cable',
  'HDMI Cable',
  'DMX Cable',
  'Power Cable',
  'USB-C Cable',
  'Ethernet Cable',
  'SDI Cable',
  'Speaker Cable',
  'Fiber Cable',
  'Multicore',
  'Microphone',
  'DI Box',
  'Wireless Mic',
  'In-Ear Monitor',
  'Headset Mic',
  'Shotgun Mic',
  'Audio Interface',
  'Mixer',
  'Amplifier',
  'Speaker',
  'Subwoofer',
  'Stage Monitor',
  'LED Par',
  'Moving Head',
  'Follow Spot',
  'Dimmer Pack',
  'Fog Machine',
  'Haze Machine',
  'Gobo Holder',
  'Color Gel',
  'Light Stand',
  'Truss Section',
  'Projector',
  'Video Switcher',
  'Camera',
  'Tripod',
  'Gaffer Tape',
  'Cable Ramp',
  'Power Distro',
  'UPS Battery',
] as const

const ITEM_LENGTHS = [
  '1m',
  '2m',
  '3m',
  '5m',
  '10m',
  '15m',
  '20m',
  '25m',
] as const
const ITEM_SIZES = ['Mini', 'Compact', 'Standard', 'Pro', 'Tour'] as const

const ITEM_BRANDS = [
  'Neutrik',
  'Mogami',
  'Canare',
  'Shure',
  'Sennheiser',
  'Yamaha',
  'Behringer',
  'Audio-Technica',
  'Rode',
  'Manfrotto',
  'Aputure',
  'Chauvet',
  'Martin',
  'ROBE',
  'Blackmagic',
  'Sony',
  'Panasonic',
  'Sennheiser',
  'DPA',
  'Electro-Voice',
] as const

const ITEM_MODELS = [
  'Pro',
  'Standard',
  'Premium',
  'Elite',
  'X1',
  'X2',
  'MKII',
  '2024',
  'Classic',
  'Plus',
  'Ultra',
  'Tour Edition',
  'Studio',
  'Live',
] as const

const ITEM_NOTE_TEMPLATES = [
  'Test item for inventory management',
  'Used for production testing',
  'Standard equipment item',
  'Backup item in stock',
  'Primary equipment',
  'Reserve stock item',
  'Touring spare kept on shelf',
  'Checked before every dispatch',
  'Requires firmware update on receipt',
  'Store in dry cabinet',
] as const

const ITEM_NICKNAME_TAGS = [
  'audio',
  'video',
  'lighting',
  'cable',
  'mic',
  'xlr',
  'hdmi',
  'dmx',
  'backup',
  'tour',
  'rental',
  'spare',
  'rig',
  'foh',
  'mon',
] as const

const GROUP_PREFIXES = [
  'Stage Box',
  'PA System',
  'Lighting Rig',
  'Video Production',
  'Sound Recording',
  'Streaming',
  'Conference AV',
  'Stage Monitor',
  'Wireless Mic',
  'DJ Setup',
  'Band Backline',
  'Hybrid Event',
  'Corporate Presentation',
  'Outdoor PA',
  'Broadcast Kit',
  'Podcast Studio',
  'IMAG Package',
  'FOH Console',
  'Monitor World',
  'Backline Bundle',
] as const

const GROUP_SUFFIXES = [
  'Basic',
  'Standard',
  'Premium',
  'Compact',
  'Tour',
  'Venue',
  'Studio',
  'Event',
  'Package',
  'Bundle',
] as const

const GROUP_DESCRIPTION_TEMPLATES = [
  'Complete {name} setup for live events',
  'Standard {name} configuration for small venues',
  'Professional {name} package with spare cabling',
  'Turnkey {name} bundle ready for dispatch',
  'Modular {name} kit for flexible rigging',
  'Backup {name} configuration kept in warehouse',
] as const

const VEHICLE_MAKES = [
  'Mercedes',
  'Ford',
  'Volkswagen',
  'Iveco',
  'Renault',
  'Peugeot',
  'Fiat',
  'Toyota',
  'Nissan',
  'Opel',
  'Volvo',
  'MAN',
] as const

const VEHICLE_MODELS = [
  'Sprinter',
  'Transit',
  'Crafter',
  'Daily',
  'Master',
  'Boxer',
  'Ducato',
  'Hiace',
  'NV400',
  'Movano',
  'Vito',
  'TGE',
] as const

const VEHICLE_NOTE_TEMPLATES = [
  'Test vehicle for fleet management',
  'Standard company transport vehicle',
  'Backup vehicle in fleet rotation',
  'Primary cargo vehicle for touring',
  'Reserve vehicle for peak season',
  'Recently serviced and road-ready',
  'Assigned to warehouse runs',
  'Used for crew transport on jobs',
] as const

export type ItemAutofillResult = {
  name: string
  brandName: string
  model: string
  notes: string
  nicknames: string
  totalQuantity: number
  price: number
  allowIndividualBooking: boolean
  active: boolean
  itemKind: 'stock' | 'subrental'
}

export function generateItemAutofill(): ItemAutofillResult {
  const baseName = pickRandom(ITEM_BASE_NAMES)
  const lengthRoll = randomBool(0.55)
  const sizeRoll = randomBool(0.35)
  const nameParts = [
    baseName,
    lengthRoll ? pickRandom(ITEM_LENGTHS) : '',
    sizeRoll ? pickRandom(ITEM_SIZES) : '',
  ].filter(Boolean)
  const name = nameParts.join(' ')
  const brandName = pickRandom(ITEM_BRANDS)
  const model = pickRandom(ITEM_MODELS)
  const notes = pickRandom(ITEM_NOTE_TEMPLATES)
  const nicknameTags = pickRandomSubset(ITEM_NICKNAME_TAGS, 2, 5)
  const nicknames = [
    ...nicknameTags,
    baseName.toLowerCase(),
    brandName.toLowerCase(),
    model.toLowerCase(),
  ]
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(', ')
  const isStock = randomBool(0.7)

  return {
    name,
    brandName,
    model,
    notes,
    nicknames,
    totalQuantity: isStock ? randomInt(1, 80) : 0,
    price: randomInt(50, 25000) / 10,
    allowIndividualBooking: randomBool(0.55),
    active: randomBool(0.85),
    itemKind: isStock ? 'stock' : 'subrental',
  }
}

export type GroupAutofillResult = {
  name: string
  description: string
  price: number
  active: boolean
  itemKind: 'stock' | 'subrental'
}

export function generateGroupAutofill(): GroupAutofillResult {
  const prefix = pickRandom(GROUP_PREFIXES)
  const suffix = pickRandom(GROUP_SUFFIXES)
  const channelSuffix = randomBool(0.4) ? ` ${randomInt(4, 32)}ch` : ''
  const name = `${prefix}${channelSuffix} ${suffix}`
  const template = pickRandom(GROUP_DESCRIPTION_TEMPLATES)
  const description = template.replace('{name}', name)
  const isStock = randomBool(0.7)

  return {
    name,
    description,
    price: randomInt(500, 50000) / 10,
    active: randomBool(0.85),
    itemKind: isStock ? 'stock' : 'subrental',
  }
}

export type GroupPartAutofillInput = {
  id: string
  name: string
  type: 'item' | 'group'
  current_price: number | null
}

export type GroupPartAutofillResult = {
  item_id: string | null
  child_group_id: string | null
  item_name: string
  quantity: number
  unit_price: number | null
  part_type: 'item' | 'group'
}

export function generateGroupPartsAutofill(
  pickerItems: readonly GroupPartAutofillInput[],
): Array<GroupPartAutofillResult> {
  const selected = pickRandomSubset(pickerItems, 1, 4)
  return selected.map((item) => ({
    item_id: item.type === 'item' ? item.id : null,
    child_group_id: item.type === 'group' ? item.id : null,
    item_name: item.name,
    quantity: randomInt(1, 6),
    unit_price: item.current_price,
    part_type: item.type,
  }))
}

export type VehicleAutofillResult = {
  name: string
  registrationNo: string
  fuel: 'diesel' | 'petrol' | 'electric'
  vehicleCategory:
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
  ownerType: 'company' | 'partner' | 'person'
  externalOwnerId: string | null
  ownerUserId: string | null
  notes: string
}

const VEHICLE_CATEGORIES: Array<VehicleAutofillResult['vehicleCategory']> = [
  'passenger_car_small',
  'passenger_car_medium',
  'passenger_car_big',
  'van_small',
  'van_medium',
  'van_big',
  'C1',
  'C1E',
  'C',
  'CE',
]

export function generateVehicleAutofill(options: {
  partners: ReadonlyArray<{ id: string }>
  crew: ReadonlyArray<{ user_id: string }>
}): VehicleAutofillResult {
  const make = pickRandom(VEHICLE_MAKES)
  const model = pickRandom(VEHICLE_MODELS)
  const variant = randomBool(0.3)
    ? ` ${pickRandom(['LWB', 'SWB', '4x4', 'Electric'])}`
    : ''
  const name = `${make} ${model}${variant}`

  let ownerType: VehicleAutofillResult['ownerType'] = 'company'
  if (randomBool(0.35) && options.partners.length > 0) {
    ownerType = 'partner'
  } else if (randomBool(0.25) && options.crew.length > 0) {
    ownerType = 'person'
  }

  const partner =
    ownerType === 'partner' ? pickRandomFrom(options.partners) : null
  const crewMember =
    ownerType === 'person' ? pickRandomFrom(options.crew) : null

  if (ownerType === 'partner' && !partner) ownerType = 'company'
  if (ownerType === 'person' && !crewMember) ownerType = 'company'

  return {
    name,
    registrationNo: randomRegistrationNo(),
    fuel: pickRandom(['diesel', 'petrol', 'electric'] as const),
    vehicleCategory: pickRandom(VEHICLE_CATEGORIES),
    ownerType,
    externalOwnerId: ownerType === 'partner' ? (partner?.id ?? null) : null,
    ownerUserId: ownerType === 'person' ? (crewMember?.user_id ?? null) : null,
    notes: pickRandom(VEHICLE_NOTE_TEMPLATES),
  }
}

const CUSTOMER_NAME_PREFIXES = [
  'Nordic',
  'Fjell',
  'Fjord',
  'Arctic',
  'Coastal',
  'Urban',
  'Polar',
  'Summit',
  'Harbor',
  'Valley',
  'Aurora',
  'Bluepine',
  'Northwind',
  'Skog',
  'Strand',
] as const

const CUSTOMER_NAME_CORES = [
  'Events',
  'Productions',
  'Media',
  'AV',
  'Sound',
  'Lighting',
  'Stage',
  'Broadcast',
  'Studios',
  'Live',
  'Rental',
  'Tech',
  'Crew',
  'Venue',
  'Festival',
] as const

const CUSTOMER_NAME_SUFFIXES = [
  'AS',
  'ASA',
  'Group',
  'Labs',
  'Co',
  'Solutions',
  'Services',
  'Norway',
] as const

const CUSTOMER_STREETS = [
  'Storgata',
  'Kirkegata',
  'Industriveien',
  'Havnegata',
  'Parkveien',
  'Bjørnstjerne Bjørnsons gate',
  'Karl Johans gate',
  'Torggata',
  'Skovveien',
  'Bryggen',
  'Nedre Slottsgate',
  'Grensen',
] as const

/** Real Norwegian postcodes so zip→city lookup stays consistent in the form. */
const CUSTOMER_LOCATIONS = [
  { zip: '0150', city: 'Oslo' },
  { zip: '0361', city: 'Oslo' },
  { zip: '5003', city: 'Bergen' },
  { zip: '7011', city: 'Trondheim' },
  { zip: '4006', city: 'Stavanger' },
  { zip: '9008', city: 'Tromsø' },
  { zip: '3015', city: 'Drammen' },
  { zip: '1606', city: 'Fredrikstad' },
  { zip: '2815', city: 'Gjøvik' },
  { zip: '8006', city: 'Bodø' },
  { zip: '4611', city: 'Kristiansand' },
  { zip: '6002', city: 'Ålesund' },
] as const

export type CustomerAutofillResult = {
  name: string
  vatNumber: string
  addressLine: string
  zipCode: string
  city: string
  country: string
  isPartner: boolean
}

function randomNorwegianVat(): string {
  const digits = String(randomInt(100_000_000, 999_999_999))
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

export function generateCustomerAutofill(): CustomerAutofillResult {
  const name = [
    pickRandom(CUSTOMER_NAME_PREFIXES),
    pickRandom(CUSTOMER_NAME_CORES),
    pickRandom(CUSTOMER_NAME_SUFFIXES),
  ].join(' ')
  const location = pickRandom(CUSTOMER_LOCATIONS)
  const streetNo = randomInt(1, 120)
  const addressLine = `${pickRandom(CUSTOMER_STREETS)} ${streetNo}`

  return {
    name,
    vatNumber: randomNorwegianVat(),
    addressLine,
    zipCode: location.zip,
    city: location.city,
    country: 'Norway',
    isPartner: randomBool(0.35),
  }
}

/** Minimum unique combinations each generator should support. */
export const AUTOFILL_MIN_VARIATIONS = 200
