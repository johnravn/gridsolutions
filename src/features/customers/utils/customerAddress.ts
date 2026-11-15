export type CustomerAddressParts = {
  address_line: string
  zip_code: string
  city: string
  country: string
}

const DEFAULT_COUNTRY = 'Norway'

/**
 * Single-string customer.address ↔ form parts.
 * Knowledge lives here so Add/Edit dialogs stay in sync.
 */
export function parseCustomerAddress(
  addr: string | null | undefined,
): CustomerAddressParts {
  if (!addr) {
    return {
      address_line: '',
      zip_code: '',
      city: '',
      country: DEFAULT_COUNTRY,
    }
  }
  const parts = addr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    address_line: parts[0] || '',
    zip_code: parts[1] || '',
    city: parts[2] || '',
    country: parts[3] || DEFAULT_COUNTRY,
  }
}

export function composeCustomerAddress(
  parts: Pick<
    CustomerAddressParts,
    'address_line' | 'zip_code' | 'city' | 'country'
  >,
): string | null {
  const joined = [parts.address_line, parts.zip_code, parts.city, parts.country]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ')
  return joined || null
}
