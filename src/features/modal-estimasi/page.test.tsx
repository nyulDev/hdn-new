import {
  RouterProvider,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { DirectionProvider } from '@/context/direction-provider'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ModalEstimasi } from './page'

vi.mock('@/lib/api/customers', () => ({
  getCustomers: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/api/estimasi', () => ({
  saveEstimasi: vi.fn(),
  getEstimasiList: vi.fn().mockResolvedValue([]),
  getEstimasiByNoQuo: vi.fn(),
  updateEstimasi: vi.fn(),
  updateEstimasiByNoQuo: vi.fn(),
  deleteEstimasi: vi.fn(),
}))

describe('ModalEstimasi quotation mode', () => {
  const renderWithRouter = async (ui: React.ReactElement) => {
    const rootRoute = createRootRoute({
      component: () => ui,
    })

    const router = createRouter({
      routeTree: rootRoute,
      context: {},
    })

    return render(<RouterProvider router={router} />)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the percentage estimate field in quotation mode', async () => {
    const { getByText } = await renderWithRouter(
      <DirectionProvider>
        <ThemeProvider>
          <LayoutProvider>
            <SearchProvider>
              <SidebarProvider defaultOpen>
                <ModalEstimasi quotationMode />
              </SidebarProvider>
            </SearchProvider>
          </LayoutProvider>
        </ThemeProvider>
      </DirectionProvider>
    )

    await expect.element(getByText(/Persentase Estimasi/i)).toBeInTheDocument()
  })

  it('asks for confirmation before deleting a loaded quotation', async () => {
    const { getEstimasiByNoQuo, getEstimasiList } =
      await import('@/lib/api/estimasi')

    vi.mocked(getEstimasiList).mockResolvedValue([
      {
        id: 1,
        noQuo: 'TEST-001',
        judul: 'TEST',
        createdAt: '2026-09-02T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
      },
    ])
    vi.mocked(getEstimasiByNoQuo).mockResolvedValue({
      id: 1,
      noQuo: 'TEST-001',
      judul: 'TEST',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
      formInfo: {
        tanggal: '2026-09-02',
        pt: 'PT TEST',
        kapal: 'KAPAL',
        dept: 'HDN',
        noQuo: 'TEST-001',
        noRfs: '',
        supplyLocation: 'JAKARTA',
        sktd: false,
        revisi: '0',
      },
      items: [],
      costs: {
        otherCosts: [],
      },
    })

    const { getByRole, getByText } = await renderWithRouter(
      <DirectionProvider>
        <ThemeProvider>
          <LayoutProvider>
            <SearchProvider>
              <SidebarProvider defaultOpen>
                <ModalEstimasi />
              </SidebarProvider>
            </SearchProvider>
          </LayoutProvider>
        </ThemeProvider>
      </DirectionProvider>
    )

    const input = getByRole('textbox', { name: /Search No. Quo/i })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await input.fill('TEST-001')

    await expect
      .element(getByRole('button', { name: /Hapus/i }))
      .toBeInTheDocument()

    await getByRole('button', { name: /Hapus/i }).click()

    await expect
      .element(getByText(/Apakah Anda yakin ingin menghapus/i))
      .toBeInTheDocument()
  })
})
