import { useEffect, useMemo, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { getCustomers, type Customer } from '@/lib/api/customers'
import {
  getEstimasiByNoQuo,
  getEstimasiList,
  type EstimasiFull,
} from '@/lib/api/estimasi'
import { getInvoices, type InvoiceRecord } from '@/lib/api/invoice'
import {
  getActualModalSubtotal,
  getModalSubtotal,
  getQuotationAfterDiscount,
  parseQuotationNumber,
} from '@/lib/profit'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const formatCurrency = (value: number) =>
  `Rp ${Math.round(value).toLocaleString('id-ID')}`

const formatDate = (value: unknown) => {
  if (!value) return '-'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('id-ID')
}

const getInvoiceNumber = (invoice: InvoiceRecord) => {
  const storedNumber =
    invoice.formInfo?.noInvoice ?? invoice.formInfo?.invoiceNo
  if (storedNumber) return String(storedNumber)

  const noQuo = String(
    invoice.formInfo?.noQuo ?? invoice.noQuo ?? 'XXX'
  ).replace(/\s+/g, '')
  return noQuo.replace(/(-\d{4})$/, '-INV$1')
}

const normalizeCustomerValue = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()

const getInvoiceCustomer = (invoice: InvoiceRecord, customers: Customer[]) => {
  const customerValues = [
    invoice.formInfo?.customerId,
    invoice.formInfo?.customer,
    invoice.formInfo?.pt,
    invoice.customerName,
    invoice.judul,
  ]
    .map(normalizeCustomerValue)
    .filter(Boolean)

  return customers.find((customer) =>
    [customer.id, customer.pt, customer.namaKapal]
      .map(normalizeCustomerValue)
      .some((value) => customerValues.includes(value))
  )
}

type SalesRow = {
  id: number
  date: string
  customer: string
  invoiceNumber: string
  totalAfterDiscount: number
  ppn: number
  modalRequested: number
  actualPurchase: number
  grossProfit: number
  marketingFee: number
  hsiShare: number
  socialAid: number
  netProfit: number
}

const toSalesRow = (
  invoice: InvoiceRecord,
  quotation: EstimasiFull | undefined,
  customers: Customer[],
  index: number
): SalesRow => {
  const quotationData = quotation ?? invoice
  const totalAfterDiscount = getQuotationAfterDiscount(quotationData)
  const ppnPct = parseQuotationNumber(
    quotationData.formInfo?.quotationPpnPct ?? 12
  )
  const ppn = totalAfterDiscount * (ppnPct / 100)
  const modalRequested = getModalSubtotal(quotationData)
  const actualPurchase = getActualModalSubtotal(invoice)
  const grossProfit = totalAfterDiscount - actualPurchase
  const marketingFee = Math.max(grossProfit, 0) * 0.1
  const hsiShare = modalRequested * 0.08
  const customer = getInvoiceCustomer(invoice, customers)
  const socialAid = customer?.bansos ? totalAfterDiscount * 0.05 : 0
  const netProfit = grossProfit - marketingFee - hsiShare - socialAid

  return {
    id: index + 1,
    date: String(invoice.formInfo?.tanggal ?? invoice.createdAt),
    customer: String(
      invoice.formInfo?.pt ?? invoice.customerName ?? invoice.judul ?? '-'
    ),
    invoiceNumber: getInvoiceNumber(invoice),
    totalAfterDiscount,
    ppn,
    modalRequested,
    actualPurchase,
    grossProfit,
    marketingFee,
    hsiShare,
    socialAid,
    netProfit,
  }
}

export function Penjualan() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [quotations, setQuotations] = useState<Record<string, EstimasiFull>>({})
  const [activeQuotationNumbers, setActiveQuotationNumbers] =
    useState<Set<string> | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadSalesData = async () => {
      const [invoiceResult, quotationResult, customerResult] =
        await Promise.allSettled([
          getInvoices(),
          getEstimasiList(),
          getCustomers(),
        ])

      if (invoiceResult.status === 'rejected') {
        setError('Data penjualan belum dapat dimuat.')
        setLoading(false)
        return
      }

      setInvoices(invoiceResult.value)
      if (customerResult.status === 'fulfilled') {
        setCustomers(customerResult.value)
      }

      if (quotationResult.status === 'rejected') {
        setLoading(false)
        return
      }

      const quotationList = quotationResult.value
      setActiveQuotationNumbers(
        new Set(quotationList.map((quotation) => quotation.noQuo))
      )

      const quotationResults = await Promise.allSettled(
        quotationList.map((quotation) => getEstimasiByNoQuo(quotation.noQuo))
      )
      const quotationEntries = quotationResults.flatMap((result, index) =>
        result.status === 'fulfilled'
          ? [[quotationList[index].noQuo, result.value] as const]
          : []
      )
      setQuotations(Object.fromEntries(quotationEntries))
      setLoading(false)
    }

    void loadSalesData()
  }, [])

  const rows = useMemo(
    () =>
      invoices
        .filter(
          (invoice) =>
            activeQuotationNumbers === null ||
            activeQuotationNumbers.has(
              String(invoice.formInfo?.noQuo ?? invoice.noQuo ?? '')
            )
        )
        .map((invoice, index) =>
          toSalesRow(
            invoice,
            quotations[String(invoice.formInfo?.noQuo ?? invoice.noQuo ?? '')],
            customers,
            index
          )
        )
        .filter((row) => {
          const query = search.trim().toLowerCase()
          if (!query) return true
          return `${row.customer} ${row.invoiceNumber} ${row.date}`
            .toLowerCase()
            .includes(query)
        }),
    [activeQuotationNumbers, customers, invoices, quotations, search]
  )

  return (
    <>
      <Header>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid className='px-2 py-6 sm:px-3 lg:px-4'>
        <div className='mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Report Penjualan
            </h1>
            <p className='mt-0.5 text-sm text-muted-foreground'>
              Total {rows.length} records ({rows.length} total)
            </p>
          </div>
          <label className='relative block w-full sm:w-84'>
            <SearchIcon className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Cari customer atau no. invoice...'
              aria-label='Cari customer atau nomor invoice'
              className='h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm shadow-sm transition outline-none focus:border-ring focus:ring-2 focus:ring-ring/20'
            />
          </label>
        </div>

        <div className='overflow-x-auto rounded-lg border bg-background shadow-sm'>
          <table className='w-full min-w-385 border-collapse text-sm'>
            <thead>
              <tr className='border-b bg-muted/30 text-left font-semibold'>
                <th className='w-12 px-2 py-4'>No</th>
                <th className='w-28 px-2 py-4'>Tanggal</th>
                <th className='w-44 px-2 py-4'>Customer</th>
                <th className='w-56 px-2 py-4'>No. Invoice</th>
                <th className='px-2 py-4 text-right'>Total After Disc.</th>
                <th className='px-2 py-4 text-right'>PPN</th>
                <th className='px-2 py-4 text-right'>Pengajuan Modal</th>
                <th className='px-2 py-4 text-right'>Pembelian Aktual</th>
                <th className='px-2 py-4 text-right'>Gross Profit</th>
                <th className='px-2 py-4 text-right'>Marketing Fee (10%)</th>
                <th className='px-2 py-4 text-right'>Bagi Hasil HSI (8%)</th>
                <th className='px-2 py-4 text-right'>Bansos (5%)</th>
                <th className='px-2 py-4 text-right text-red-600'>
                  Net Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={13}
                    className='px-4 py-10 text-center text-muted-foreground'
                  >
                    Memuat data penjualan...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={13}
                    className='px-4 py-10 text-center text-destructive'
                  >
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className='px-4 py-10 text-center text-muted-foreground'
                  >
                    Belum ada data penjualan.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.invoiceNumber}
                    className='border-b last:border-0 hover:bg-muted/20'
                  >
                    <td className='px-2 py-4'>{row.id}</td>
                    <td className='px-2 py-4 whitespace-nowrap'>
                      {formatDate(row.date)}
                    </td>
                    <td className='px-2 py-4 font-medium whitespace-normal'>
                      {row.customer}
                    </td>
                    <td className='px-2 py-4 whitespace-nowrap'>
                      {row.invoiceNumber}
                    </td>
                    <td className='px-2 py-4 text-right whitespace-nowrap'>
                      {formatCurrency(row.totalAfterDiscount)}
                    </td>
                    <td className='px-2 py-4 text-right whitespace-nowrap'>
                      {formatCurrency(row.ppn)}
                    </td>
                    <td className='px-2 py-4 text-right whitespace-nowrap'>
                      {formatCurrency(row.modalRequested)}
                    </td>
                    <td className='px-2 py-4 text-right whitespace-nowrap'>
                      {formatCurrency(row.actualPurchase)}
                    </td>
                    <td className='px-2 py-4 text-right font-semibold whitespace-nowrap'>
                      {formatCurrency(row.grossProfit)}
                    </td>
                    <td className='px-2 py-4 text-right font-semibold whitespace-nowrap'>
                      {formatCurrency(row.marketingFee)}
                    </td>
                    <td className='px-2 py-4 text-right font-semibold whitespace-nowrap'>
                      {formatCurrency(row.hsiShare)}
                    </td>
                    <td className='px-2 py-4 text-right font-semibold whitespace-nowrap'>
                      {formatCurrency(row.socialAid)}
                    </td>
                    <td className='px-2 py-4 text-right font-semibold whitespace-nowrap text-red-600'>
                      {formatCurrency(row.netProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Main>
    </>
  )
}
