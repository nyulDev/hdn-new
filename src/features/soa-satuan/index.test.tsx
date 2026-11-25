import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { getEstimasiList } from '@/lib/api/estimasi'
import { getInvoices, type InvoiceRecord } from '@/lib/api/invoice'
import { SoaSatuan } from './index'

vi.mock('@/lib/api/invoice', () => ({
  getInvoices: vi.fn(),
  updateInvoice: vi.fn(),
}))

vi.mock('@/lib/api/estimasi', () => ({
  getEstimasiList: vi.fn(),
}))

vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
}))

vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => null,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => null,
}))

describe('SOA Satuan PT filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deduplicates PT names with casing and whitespace differences', async () => {
    const invoices: InvoiceRecord[] = [
      {
        id: 1,
        noQuo: 'Q-1',
        judul: 'Invoice 1',
        customerName: 'PT Contoh',
        amount: 100,
        status: 'belum_dibayar',
        formInfo: {
          pt: 'PT Contoh',
          noQuo: 'Q-1',
          tanggal: '2026-01-01',
          kapal: 'MV One',
        },
        items: [],
        costs: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        noQuo: 'Q-2',
        judul: 'Invoice 2',
        customerName: ' pt   contoh ',
        amount: 200,
        status: 'belum_dibayar',
        formInfo: {
          pt: ' pt   contoh ',
          noQuo: 'Q-2',
          tanggal: '2026-01-02',
          kapal: 'MV Two',
        },
        items: [],
        costs: {},
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 3,
        noQuo: 'Q-3',
        judul: 'Invoice 3',
        customerName: 'PT Lain',
        amount: 50,
        status: 'belum_dibayar',
        formInfo: {
          pt: 'PT Lain',
          noQuo: 'Q-3',
          tanggal: '2026-01-03',
          kapal: 'MV Three',
        },
        items: [],
        costs: {},
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
    ]

    vi.mocked(getInvoices).mockResolvedValue(invoices)
    vi.mocked(getEstimasiList).mockResolvedValue(
      invoices.map((invoice, index) => ({
        id: index + 1,
        judul: invoice.judul,
        noQuo: invoice.noQuo,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      }))
    )

    const screen = await render(<SoaSatuan />)
    const filter = screen.getByRole('combobox', { name: 'Filter PT' })

    await expect
      .element(screen.getByRole('option', { name: 'PT Contoh' }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('option', { name: 'PT Lain' }))
      .toBeInTheDocument()
    await userEvent.selectOptions(filter, 'PT Contoh')
    await expect
      .element(screen.getByText(/Total 2 invoices/))
      .toBeInTheDocument()
  })
})
