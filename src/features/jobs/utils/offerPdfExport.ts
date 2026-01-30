// src/features/jobs/utils/offerPdfExport.ts
import jsPDF from 'jspdf'
import type { OfferDetail } from '../types'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDateRange = (
  start?: string | null,
  end?: string | null,
): string => {
  if (!start && !end) return '—'
  if (start && !end) return formatDate(start)
  if (!start && end) return formatDate(end)
  const startLabel = formatDate(start)
  const endLabel = formatDate(end)
  if (startLabel === endLabel) return startLabel
  return `${startLabel} – ${endLabel}`
}

const formatDateTimeRange = (
  start?: string | null,
  end?: string | null,
): string => {
  if (!start && !end) return '—'
  if (start && !end) return `Start: ${formatDateTime(start)}`
  if (!start && end) return `End: ${formatDateTime(end)}`
  const startLabel = `Start: ${formatDateTime(start)}`
  const endLabel = `End: ${formatDateTime(end)}`
  if (startLabel === endLabel) return startLabel
  return `${startLabel}\n${endLabel}`
}

const formatVehicleCategory = (
  category:
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
    | undefined,
): string => {
  if (!category) return 'Vehicle'
  const map: Record<string, string> = {
    passenger_car_small: 'Passenger Car - Small',
    passenger_car_medium: 'Passenger Car - Medium',
    passenger_car_big: 'Passenger Car - Big',
    van_small: 'Van - Small',
    van_medium: 'Van - Medium',
    van_big: 'Van - Big',
    C1: 'C1',
    C1E: 'C1E',
    C: 'C',
    CE: 'CE',
  }
  return map[category] || category
}

const calculateDays = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 1
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

const safeText = (value?: string | null): string =>
  value && value.trim() !== '' ? value : '—'

const formatHours = (hours?: number | null): string | null => {
  if (hours === null || hours === undefined) return null
  const rounded = Math.round(hours * 10) / 10
  return `${rounded}h`
}

const BRAND_COLOR_MAP: Record<string, { r: number; g: number; b: number }> = {
  gray: { r: 113, g: 113, b: 122 },
  gold: { r: 173, g: 127, b: 49 },
  bronze: { r: 152, g: 116, b: 86 },
  brown: { r: 140, g: 107, b: 78 },
  yellow: { r: 179, g: 117, b: 11 },
  amber: { r: 179, g: 92, b: 14 },
  orange: { r: 190, g: 84, b: 13 },
  tomato: { r: 192, g: 59, b: 45 },
  red: { r: 199, g: 46, b: 62 },
  ruby: { r: 192, g: 44, b: 80 },
  pink: { r: 190, g: 50, b: 120 },
  plum: { r: 135, g: 70, b: 150 },
  purple: { r: 111, g: 80, b: 176 },
  violet: { r: 104, g: 89, b: 185 },
  iris: { r: 91, g: 98, b: 192 },
  indigo: { r: 79, g: 70, b: 229 },
  blue: { r: 41, g: 98, b: 200 },
  cyan: { r: 14, g: 116, b: 144 },
  teal: { r: 12, g: 122, b: 118 },
  jade: { r: 12, g: 115, b: 87 },
  green: { r: 19, g: 119, b: 66 },
  grass: { r: 46, g: 120, b: 56 },
  mint: { r: 25, g: 128, b: 114 },
  lime: { r: 121, g: 143, b: 30 },
  sky: { r: 38, g: 110, b: 172 },
}

const getBrandColor = (accent?: string | null) => {
  if (!accent) return BRAND_COLOR_MAP.indigo
  const key = accent.toLowerCase()
  return BRAND_COLOR_MAP[key] ?? BRAND_COLOR_MAP.indigo
}

const tintColor = (
  color: { r: number; g: number; b: number },
  ratio: number,
) => {
  const mix = (channel: number) => Math.round(255 - (255 - channel) * ratio)
  return {
    r: mix(color.r),
    g: mix(color.g),
    b: mix(color.b),
  }
}

/**
 * Export an offer as PDF
 */
export async function exportOfferAsPDF(offer: OfferDetail): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  const lineHeight = 5
  const brandColor = getBrandColor(offer.company?.accent_color)
  const brandTint = tintColor(brandColor, 0.08)
  const brandSoft = tintColor(brandColor, 0.04)
  let yPos = margin

  // Helper to add new page if needed
  const ensureSpace = (requiredSpace: number, onNewPage?: () => void) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      if (onNewPage) onNewPage()
    }
  }

  const addSectionHeader = (title: string) => {
    ensureSpace(12)
    doc.setFillColor(brandTint.r, brandTint.g, brandTint.b)
    doc.rect(margin, yPos - 3, contentWidth, 8, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40)
    doc.text(title, margin + 2, yPos + 2)
    yPos += 9
    doc.setTextColor(20)
  }

  const addKeyValue = (label: string, value: string) => {
    const labelWidth = 40
    const valueWidth = contentWidth - labelWidth
    const lines = doc.splitTextToSize(value, valueWidth)
    ensureSpace(lines.length * lineHeight + 2)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(110)
    doc.text(label, margin, yPos)
    doc.setTextColor(30)
    lines.forEach((line: string, idx: number) => {
      doc.text(line, margin + labelWidth, yPos + idx * lineHeight)
    })
    yPos += lines.length * lineHeight + 1
  }

  const drawTableHeader = (
    columns: Array<{ label: string; width: number; align?: 'left' | 'right' }>,
    skipCheck = false,
  ) => {
    if (!skipCheck) {
      ensureSpace(8)
    }
    doc.setFillColor(brandSoft.r, brandSoft.g, brandSoft.b)
    doc.rect(margin, yPos - 3, contentWidth, 7, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40)
    let xPos = margin
    columns.forEach((col) => {
      const textX = col.align === 'right' ? xPos + col.width - 1 : xPos + 1
      doc.text(col.label, textX, yPos + 2, { align: col.align || 'left' })
      xPos += col.width
    })
    yPos += 7
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30)
  }

  const drawTableRow = (
    cells: Array<{ text: string; width: number; align?: 'left' | 'right' }>,
    headerColumns?: Array<{
      label: string
      width: number
      align?: 'left' | 'right'
    }>,
  ) => {
    const rowLineHeight = 5
    const lineGroups = cells.map((cell) =>
      doc.splitTextToSize(cell.text || '—', cell.width - 2),
    )
    const maxLines = Math.max(1, ...lineGroups.map((lines) => lines.length))
    const rowHeight = maxLines * rowLineHeight + 5
    ensureSpace(rowHeight + 4, () => {
      if (headerColumns) {
        drawTableHeader(headerColumns, true)
      }
    })
    let xPos = margin
    lineGroups.forEach((lines, index) => {
      const cell = cells[index]
      lines.forEach((line, lineIndex) => {
        const textX = cell.align === 'right' ? xPos + cell.width - 1 : xPos + 1
        doc.text(line, textX, yPos + lineIndex * rowLineHeight, {
          align: cell.align || 'left',
        })
      })
      xPos += cell.width
    })
    yPos += rowHeight
  }

  const companyName = offer.company?.name ?? 'Company'
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text(companyName, margin, yPos)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110)
  doc.text(`Offer v${offer.version_number}`, pageWidth - margin, yPos, {
    align: 'right',
  })
  yPos += 6

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text(offer.title || 'Offer', margin, yPos)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110)
  doc.text(`Status: ${offer.status}`, pageWidth - margin, yPos, {
    align: 'right',
  })
  yPos += 6

  if (offer.company?.address) {
    doc.setFontSize(9)
    doc.setTextColor(110)
    const addressLines = doc.splitTextToSize(offer.company.address, 90)
    addressLines.forEach((line: string, idx: number) => {
      doc.text(line, margin, yPos + idx * lineHeight)
    })
    yPos += addressLines.length * lineHeight
  }

  yPos += 4
  yPos += 6

  addSectionHeader('Offer Details')
  addKeyValue('Type', offer.offer_type === 'technical' ? 'Technical' : 'Pretty')
  addKeyValue('Created', formatDate(offer.created_at))
  if (offer.job_title) {
    addKeyValue('Job', offer.job_title)
  }
  addKeyValue('Days of use', `${offer.days_of_use}`)
  addKeyValue('VAT', `${offer.vat_percent}%`)
  // Line pricing status is internal-only, omit from PDF.

  if (offer.customer || offer.customer_contact || offer.project_lead) {
    yPos += 2
    addSectionHeader('Contacts')
    const gap = 8
    const colWidth = (contentWidth - gap) / 2
    const leftX = margin
    const rightX = margin + colWidth + gap
    const startY = yPos
    let leftY = yPos
    let rightY = yPos
    const rowHeight = lineHeight + 1

    const drawContactLine = (
      x: number,
      y: number,
      label: string,
      value?: string | null,
    ) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(110)
      doc.text(label, x, y)
      doc.setTextColor(30)
      const lines = doc.splitTextToSize(safeText(value), colWidth - 22)
      lines.forEach((line: string, idx: number) => {
        doc.text(line, x + 22, y + idx * lineHeight)
      })
      return lines.length * lineHeight + 1
    }

    if (offer.customer) {
      leftY += drawContactLine(leftX, leftY, 'Customer', offer.customer.name)
      leftY += drawContactLine(leftX, leftY, 'Email', offer.customer.email)
      leftY += drawContactLine(leftX, leftY, 'Phone', offer.customer.phone)
      if (offer.customer.address) {
        leftY += drawContactLine(
          leftX,
          leftY,
          'Address',
          offer.customer.address,
        )
      }
    }

    if (offer.customer_contact) {
      rightY += drawContactLine(
        rightX,
        rightY,
        'Contact',
        offer.customer_contact.name,
      )
      rightY += drawContactLine(
        rightX,
        rightY,
        'Contact email',
        offer.customer_contact.email,
      )
      rightY += drawContactLine(
        rightX,
        rightY,
        'Contact phone',
        offer.customer_contact.phone,
      )
    }

    if (offer.project_lead) {
      rightY += rowHeight
      rightY += drawContactLine(
        rightX,
        rightY,
        'Project lead',
        offer.project_lead.display_name,
      )
      rightY += drawContactLine(
        rightX,
        rightY,
        'Lead email',
        offer.project_lead.email,
      )
      rightY += drawContactLine(
        rightX,
        rightY,
        'Lead phone',
        offer.project_lead.phone,
      )
    }

    yPos = Math.max(leftY, rightY)
    if (yPos === startY) {
      yPos += lineHeight
    }
  }

  if (offer.groups && offer.groups.length > 0) {
    yPos += 4
    addSectionHeader('Equipment')
    const equipmentColumns = offer.show_price_per_line
      ? [
          { label: 'Item', width: 90 },
          { label: 'Qty', width: 15, align: 'right' as const },
          { label: 'Unit', width: 30, align: 'right' as const },
          { label: 'Line total', width: 35, align: 'right' as const },
        ]
      : [
          { label: 'Item', width: 140 },
          { label: 'Qty', width: 30, align: 'right' as const },
        ]
    drawTableHeader(equipmentColumns)

    for (const group of offer.groups) {
      const groupTotal = (group.items || []).reduce((sum, item) => {
        return sum + (item.total_price ?? item.unit_price * item.quantity)
      }, 0)
      ensureSpace(10, () => drawTableHeader(equipmentColumns, true))
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30)
      doc.text(group.group_name, margin, yPos)
      if (offer.show_price_per_line) {
        doc.text(formatCurrency(groupTotal), pageWidth - margin, yPos, {
          align: 'right',
        })
      }
      yPos += 5
      doc.setFont('helvetica', 'normal')

      if (group.items && group.items.length > 0) {
        for (const item of group.items) {
          const baseName = item.group
            ? `${item.group.name} (Group)`
            : item.item?.name || 'Unknown Item'
          const meta = item.group
            ? null
            : [item.item?.brand?.name, item.item?.model]
                .filter(Boolean)
                .join(' ')
          const itemName = meta ? `${baseName} (${meta})` : baseName
          const qty = `${item.quantity}`
          const unitPrice = formatCurrency(item.unit_price)
          const total = formatCurrency(
            item.total_price ?? item.unit_price * item.quantity,
          )

          if (offer.show_price_per_line) {
            drawTableRow(
              [
                { text: itemName, width: 90 },
                { text: qty, width: 15, align: 'right' },
                { text: unitPrice, width: 30, align: 'right' },
                { text: total, width: 35, align: 'right' },
              ],
              equipmentColumns,
            )
          } else {
            drawTableRow(
              [
                { text: itemName, width: 140 },
                { text: qty, width: 30, align: 'right' },
              ],
              equipmentColumns,
            )
          }
        }
      } else {
        drawTableRow(
          [{ text: 'No items in this group', width: contentWidth }],
          equipmentColumns,
        )
      }
      yPos += 2
    }
  }

  if (offer.crew_items && offer.crew_items.length > 0) {
    yPos += 4
    addSectionHeader('Crew')
    const crewColumns = [
      { label: 'Role', width: 55 },
      { label: 'Count', width: 12, align: 'right' },
      { label: 'Dates', width: 45 },
      { label: 'Rate', width: 30, align: 'right' },
      { label: 'Total', width: 28, align: 'right' },
    ]
    drawTableHeader(crewColumns)

    for (const crew of offer.crew_items) {
      const days = calculateDays(crew.start_date, crew.end_date)
      const hoursLabel = formatHours(crew.hours_per_day)
      const bookedHours =
        crew.hours_per_day !== null && crew.hours_per_day !== undefined
          ? Math.round(crew.hours_per_day * days * 10) / 10
          : null
      const roleLabel = crew.role_category
        ? `${crew.role_title} - ${crew.role_category}`
        : crew.role_title
      let rateLabel = `${formatCurrency(crew.daily_rate)} x ${days} day`
      if (crew.billing_type === 'hourly' && crew.hourly_rate !== null) {
        const hoursPart = hoursLabel ? `${hoursLabel}/day` : 'hours/day'
        rateLabel = `Hourly: ${formatCurrency(crew.hourly_rate)}/h x ${hoursPart} x ${days} day`
      } else if (hoursLabel) {
        rateLabel = `${formatCurrency(crew.daily_rate)} x ${days} day (${hoursLabel}/day)`
      }
      const totalHoursLabel =
        bookedHours !== null ? ` (${bookedHours}h booked)` : ''
      drawTableRow(
        [
          { text: roleLabel, width: 55 },
          { text: `${crew.crew_count}`, width: 12, align: 'right' },
          {
            text: formatDateTimeRange(crew.start_date, crew.end_date),
            width: 45,
          },
          { text: `${rateLabel}${totalHoursLabel}`, width: 30, align: 'right' },
          { text: formatCurrency(crew.total_price), width: 28, align: 'right' },
        ],
        crewColumns,
      )
    }
  }

  if (offer.transport_items && offer.transport_items.length > 0) {
    yPos += 4
    addSectionHeader('Transport')
    const transportColumns = [
      { label: 'Vehicle', width: 55 },
      { label: 'Dates', width: 45 },
      { label: 'Rate', width: 35, align: 'right' },
      { label: 'Total', width: 35, align: 'right' },
    ]
    drawTableHeader(transportColumns)

    for (const transport of offer.transport_items) {
      const days = calculateDays(transport.start_date, transport.end_date)
      const distanceIncrement =
        offer.company_expansion?.vehicle_distance_increment ?? 150
      const effectiveDailyRate =
        transport.daily_rate ??
        offer.company_expansion?.vehicle_daily_rate ??
        null
      const effectiveDistanceRate =
        transport.distance_rate ??
        offer.company_expansion?.vehicle_distance_rate ??
        null
      const vehicleName = formatVehicleCategory(
        transport.vehicle_category ?? null,
      )
      const dailyRateLabel =
        effectiveDailyRate !== null
          ? `Daily: ${formatCurrency(effectiveDailyRate)} / day`
          : 'Daily: —'
      const distanceRateLabel =
        effectiveDistanceRate !== null
          ? `Distance: ${formatCurrency(effectiveDistanceRate)} / ${distanceIncrement} km`
          : 'Distance: —'
      const rateParts = [dailyRateLabel, distanceRateLabel]
      drawTableRow(
        [
          { text: vehicleName, width: 55 },
          {
            text: formatDateRange(transport.start_date, transport.end_date),
            width: 45,
          },
          { text: rateParts.join('\n'), width: 35, align: 'right' },
          {
            text: formatCurrency(transport.total_price),
            width: 35,
            align: 'right',
          },
        ],
        transportColumns,
      )
    }
  }

  if (offer.pretty_sections && offer.pretty_sections.length > 0) {
    yPos += 4
    addSectionHeader('Content Sections')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30)

    for (const section of offer.pretty_sections.sort(
      (a, b) => a.sort_order - b.sort_order,
    )) {
      ensureSpace(18)
      if (section.title) {
        doc.setFont('helvetica', 'bold')
        doc.text(section.title, margin, yPos)
        yPos += 5
      }
      if (section.content) {
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(section.content, contentWidth)
        lines.forEach((line: string) => {
          ensureSpace(6)
          doc.text(line, margin, yPos)
          yPos += lineHeight
        })
        yPos += 3
      }
      yPos += 4
    }
  }

  yPos += 6
  const subtotalBlockHeight = 9 + 3 * 5 + 6
  ensureSpace(subtotalBlockHeight)
  addSectionHeader('Subtotals')
  const subtotalX = margin + 100

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30)
  doc.text('Equipment', margin, yPos)
  doc.text(formatCurrency(offer.equipment_subtotal), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 5

  doc.text('Crew', margin, yPos)
  doc.text(formatCurrency(offer.crew_subtotal), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 5

  doc.text('Transport', margin, yPos)
  doc.text(formatCurrency(offer.transport_subtotal), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 6

  const totalsLineCount = 4 + (offer.discount_percent > 0 ? 1 : 0) + 1
  const totalsBlockHeight = 9 + totalsLineCount * 5 + 8
  ensureSpace(totalsBlockHeight)
  addSectionHeader('Totals & Adjustments')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30)
  doc.text('Total Before Discount', margin, yPos)
  doc.text(formatCurrency(offer.total_before_discount), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 5

  if (offer.discount_percent > 0) {
    const discountAmount =
      offer.total_before_discount - offer.total_after_discount
    doc.text(`Discount (${offer.discount_percent}%)`, margin, yPos)
    doc.text(`-${formatCurrency(discountAmount)}`, subtotalX, yPos, {
      align: 'right',
    })
    yPos += 5
  }

  doc.text('Total After Discount', margin, yPos)
  doc.text(formatCurrency(offer.total_after_discount), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 5

  const vatAmount = offer.total_with_vat - offer.total_after_discount
  doc.text(`VAT (${offer.vat_percent}%)`, margin, yPos)
  doc.text(formatCurrency(vatAmount), subtotalX, yPos, { align: 'right' })
  yPos += 7

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Total With VAT', margin, yPos)
  doc.text(formatCurrency(offer.total_with_vat), subtotalX, yPos, {
    align: 'right',
  })

  const filename = `${offer.title.replace(/[^a-z0-9]/gi, '_')}_v${offer.version_number}.pdf`
  doc.save(filename)
}
