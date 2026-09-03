import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@test/render'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider'
import type { BookingInvoiceLine } from '../../api/invoiceQueries'
import InvoiceDescriptionTemplateEditor, {
  INVOICE_LINE_HIGHLIGHT_HOLD_MS,
} from './InvoiceDescriptionTemplateEditor'

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const equipmentLine: BookingInvoiceLine = {
  id: 'eq-1',
  type: 'equipment',
  description: 'Wireless vocal mic',
  quantity: 1,
  unitPrice: 100,
  totalPrice: 100,
  vatPercent: 25,
  timePeriodId: 'tp-1',
  timePeriodTitle: 'Main period',
  startAt: '2026-01-15T08:00:00.000Z',
  endAt: '2026-01-15T18:00:00.000Z',
  brandName: 'Shure',
  model: 'SM58',
  itemName: 'Wireless vocal mic',
}

const crewLine: BookingInvoiceLine = {
  ...equipmentLine,
  id: 'crew-1',
  type: 'crew',
  description: 'Crew - Sound engineer - per hour',
  roleLabel: 'Sound engineer',
  unit: 'hour',
  itemName: null,
  brandName: null,
  model: null,
}

function renderEditor() {
  return renderWithProviders(
    <AppToastProvider>
      <InvoiceDescriptionTemplateEditor
        companyId="co-1"
        lines={[equipmentLine, crewLine]}
        manualOverrides={new Set()}
        onApply={vi.fn()}
      />
    </AppToastProvider>,
  )
}

describe('InvoiceDescriptionTemplateEditor', () => {
  it('uses Other instead of All lines, with type-specific add fields', async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(screen.getByRole('button', { name: /Other/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /All lines/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Equipment/ }))
    const itemNameChip = screen.getByRole('button', { name: 'Item name' })
    expect(
      within(itemNameChip.parentElement as HTMLElement).getByRole('button', {
        name: 'Remove token',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Add/ }))
    const equipmentMenu = await screen.findByRole('menu')
    expect(
      within(equipmentMenu).getByRole('menuitem', { name: 'Item name' }),
    ).toBeInTheDocument()
    expect(
      within(equipmentMenu).getByRole('menuitem', { name: 'Brand' }),
    ).toBeInTheDocument()
    expect(
      within(equipmentMenu).getByRole('menuitem', { name: 'Model' }),
    ).toBeInTheDocument()
    expect(
      within(equipmentMenu).queryByRole('menuitem', { name: 'Crew' }),
    ).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /^Crew/ }))
    await user.click(screen.getByRole('button', { name: /Add/ }))
    const crewMenu = await screen.findByRole('menu')
    expect(
      within(crewMenu).getByRole('menuitem', { name: 'Role' }),
    ).toBeInTheDocument()
    expect(
      within(crewMenu).getByRole('menuitem', { name: 'Crew name' }),
    ).toBeInTheDocument()
    expect(
      within(crewMenu).getByRole('menuitem', { name: 'Date' }),
    ).toBeInTheDocument()
    expect(
      within(crewMenu).getByRole('menuitem', { name: 'Time' }),
    ).toBeInTheDocument()
    expect(
      within(crewMenu).queryByRole('menuitem', { name: 'Brand' }),
    ).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /^Transport/ }))
    await user.click(screen.getByRole('button', { name: /Add/ }))
    const transportMenu = await screen.findByRole('menu')
    expect(
      within(transportMenu).getByRole('menuitem', { name: 'Transport name' }),
    ).toBeInTheDocument()
  })
})

describe('invoice line highlights', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fades highlights after 5 seconds and can show them again', () => {
    const onHighlightChange = vi.fn()
    renderWithProviders(
      <AppToastProvider>
        <InvoiceDescriptionTemplateEditor
          companyId="co-1"
          lines={[equipmentLine, crewLine]}
          manualOverrides={new Set()}
          onApply={vi.fn()}
          onHighlightChange={onHighlightChange}
        />
      </AppToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Apply pattern/ }))
    const afterApply = onHighlightChange.mock.calls.at(-1)?.[0] as Set<string>
    expect(afterApply.size).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /Hide highlights \(5s\)/ }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(INVOICE_LINE_HIGHLIGHT_HOLD_MS)
    })
    const afterFade = onHighlightChange.mock.calls.at(-1)?.[0] as Set<string>
    expect(afterFade.size).toBe(0)
    expect(
      screen.getByRole('button', { name: 'Highlight lines' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Highlight lines' }))
    expect(
      screen.getByRole('button', { name: /Hide highlights \(5s\)/ }),
    ).toBeInTheDocument()
    const afterToggle = onHighlightChange.mock.calls.at(-1)?.[0] as Set<string>
    expect(afterToggle.size).toBeGreaterThan(0)
  })
})
