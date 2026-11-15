export type ParsedCompanyAddress = {
  address_line: string
  zip_code: string
  city: string
  country: string
}

const DEFAULT_COUNTRY = 'Norway'

/** Parse company address stored as comma-separated "line, zip, city, country". */
export function parseCompanyAddress(
  addr: string | null | undefined,
): ParsedCompanyAddress {
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
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 4) {
    return {
      address_line: parts[0] || '',
      zip_code: parts[1] || '',
      city: parts[2] || '',
      country: parts[3] || DEFAULT_COUNTRY,
    }
  }
  if (parts.length === 1) {
    return {
      address_line: parts[0] || '',
      zip_code: '',
      city: '',
      country: DEFAULT_COUNTRY,
    }
  }
  return {
    address_line: addr,
    zip_code: '',
    city: '',
    country: DEFAULT_COUNTRY,
  }
}

/** Join address parts back to the CSV form stored on companies.address. */
export function formatCompanyAddress(parts: {
  address_line: string
  zip_code: string
  city: string
  country: string
}): string {
  return [
    parts.address_line.trim(),
    parts.zip_code.trim(),
    parts.city.trim(),
    parts.country.trim() || DEFAULT_COUNTRY,
  ]
    .filter(Boolean)
    .join(', ')
}
