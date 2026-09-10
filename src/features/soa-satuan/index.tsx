import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getEstimasiList } from '@/lib/api/estimasi'
import {
  getInvoices,
  updateInvoice,
  type InvoiceRecord,
} from '@/lib/api/invoice'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const formatCurrency = (value: number) =>
  `${Math.round(value).toLocaleString('id-ID')} IDR`

const formatDate = (value: Date | string | undefined) => {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('id-ID')
}

const formatLongDate = (value: Date) =>
  value.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

const formatInputDate = (value: Date | string | undefined) => {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const getInvoiceNumber = (invoice: InvoiceRecord) => {
  const rfsNumber = invoice.formInfo?.noRfs ?? invoice.formInfo?.noRFS
  if (rfsNumber) return String(rfsNumber)

  const storedNumber =
    invoice.formInfo?.noInvoice ?? invoice.formInfo?.invoiceNo
  if (storedNumber) return String(storedNumber)

  const noQuo = String(
    invoice.formInfo?.noQuo ?? invoice.noQuo ?? 'XXX'
  ).replace(/\s+/g, '')
  const year =
    new Date(invoice.createdAt).getFullYear() || new Date().getFullYear()
  return `${noQuo}-INV-${year}`
}

type AgingRow = {
  invoiceId: number
  id: number
  invoiceDate: Date
  invoiceNumber: string
  poNumber: string
  customer: string
  vessel: string
  terms: number
  dueDate: Date
  amount: number
  aging030: number
  aging3160: number
  aging61: number
  paymentDate?: Date
  paymentDateInput: string
  isPaid: boolean
}

const getAgingBuckets = (invoiceDate: Date, referenceDate: Date) => {
  const invoiceDay = new Date(invoiceDate)
  invoiceDay.setHours(0, 0, 0, 0)
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)
  const invoiceAge = Math.max(
    0,
    Math.floor((today.getTime() - invoiceDay.getTime()) / 86400000) + 1
  )

  return {
    aging030: invoiceAge <= 30 ? invoiceAge : 0,
    aging3160: invoiceAge > 30 && invoiceAge <= 60 ? invoiceAge : 0,
    aging61: invoiceAge > 60 ? invoiceAge : 0,
  }
}

const toAgingRow = (
  invoice: InvoiceRecord,
  index: number,
  referenceDate: Date
): AgingRow => {
  const invoiceDate = new Date(
    String(invoice.formInfo?.tanggal ?? invoice.createdAt)
  )
  const safeInvoiceDate = Number.isNaN(invoiceDate.getTime())
    ? new Date(invoice.createdAt)
    : invoiceDate
  const terms = Number(invoice.formInfo?.paymentTerms ?? 30) || 30
  const dueDate = invoice.formInfo?.dueDate
    ? new Date(String(invoice.formInfo.dueDate))
    : addDays(safeInvoiceDate, terms)
  const paymentDate = invoice.formInfo?.paymentDate
    ? new Date(String(invoice.formInfo.paymentDate))
    : undefined
  const isPaid = invoice.status === 'lunas'
  const buckets = getAgingBuckets(safeInvoiceDate, referenceDate)

  return {
    id: index + 1,
    invoiceId: invoice.id,
    invoiceDate: safeInvoiceDate,
    invoiceNumber: getInvoiceNumber(invoice),
    poNumber: String(invoice.formInfo?.noPo ?? invoice.formInfo?.noPO ?? '-'),
    customer: String(
      invoice.formInfo?.pt ?? invoice.customerName ?? invoice.judul ?? '-'
    ),
    vessel: String(invoice.formInfo?.kapal ?? 'MV. -'),
    terms,
    dueDate,
    amount: Number(invoice.amount) || 0,
    ...buckets,
    paymentDate:
      paymentDate && !Number.isNaN(paymentDate.getTime())
        ? paymentDate
        : undefined,
    paymentDateInput: formatInputDate(paymentDate),
    isPaid,
  }
}

export function SoaSatuan() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [selectedPt, setSelectedPt] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeQuotationNumbers, setActiveQuotationNumbers] =
    useState<Set<string> | null>(null)
  const [paymentDates, setPaymentDates] = useState<Record<number, string>>({})
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<number | null>(
    null
  )

  useEffect(() => {
    const originalTitle = document.title
    const clearPrintTitle = () => {
      document.title = ''
    }
    const restorePrintTitle = () => {
      document.title = originalTitle
    }

    window.addEventListener('beforeprint', clearPrintTitle)
    window.addEventListener('afterprint', restorePrintTitle)

    return () => {
      window.removeEventListener('beforeprint', clearPrintTitle)
      window.removeEventListener('afterprint', restorePrintTitle)
      document.title = originalTitle
    }
  }, [])

  useEffect(() => {
    const loadAgingData = async () => {
      const [invoiceResult, quotationResult] = await Promise.allSettled([
        getInvoices(),
        getEstimasiList(),
      ])

      if (
        invoiceResult.status === 'rejected' ||
        quotationResult.status === 'rejected'
      ) {
        setError('Data aging report belum dapat dimuat.')
        setLoading(false)
        return
      }

      setInvoices(invoiceResult.value)
      setActiveQuotationNumbers(
        new Set(quotationResult.value.map((quotation) => quotation.noQuo))
      )
      setLoading(false)
    }

    void loadAgingData()
  }, [])

  const referenceDate = useMemo(() => new Date(), [])
  const allRows = useMemo(
    () =>
      invoices
        .filter(
          (invoice) =>
            activeQuotationNumbers !== null &&
            activeQuotationNumbers.has(
              String(invoice.formInfo?.noQuo ?? invoice.noQuo ?? '')
            )
        )
        .map((invoice, index) => toAgingRow(invoice, index, referenceDate)),
    [activeQuotationNumbers, invoices, referenceDate]
  )
  const customers = useMemo(
    () => [...new Set(allRows.map((row) => row.customer))].sort(),
    [allRows]
  )
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allRows.filter((row) => {
      const matchesPt = selectedPt === 'all' || row.customer === selectedPt
      const matchesSearch =
        !query ||
        `${row.invoiceNumber} ${row.vessel} ${row.customer}`
          .toLowerCase()
          .includes(query)
      return matchesPt && matchesSearch
    })
  }, [allRows, search, selectedPt])
  const printRows = useMemo(() => rows.filter((row) => !row.isPaid), [rows])
  const printTotalAmount = printRows.reduce(
    (total, row) => total + row.amount,
    0
  )
  const totalAmount = rows.reduce((total, row) => total + row.amount, 0)

  const handlePaymentDateChange = (invoiceId: number, value: string) => {
    setPaymentDates((current) => ({ ...current, [invoiceId]: value }))
  }

  const handleMarkAsPaid = async (invoice: InvoiceRecord) => {
    const paymentDate = paymentDates[invoice.id]
    if (!paymentDate) {
      toast.error('Pilih tanggal pembayaran terlebih dahulu.')
      return
    }

    setUpdatingInvoiceId(invoice.id)
    try {
      const updatedInvoice = await updateInvoice(invoice.id, {
        status: 'lunas',
        formInfo: {
          ...invoice.formInfo,
          paymentDate,
        },
      })
      setInvoices((current) =>
        current.map((item) => (item.id === invoice.id ? updatedInvoice : item))
      )
      toast.success('Invoice berhasil dikonfirmasi lunas.')
    } catch (updateError) {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : 'Invoice gagal dikonfirmasi lunas.'
      )
    } finally {
      setUpdatingInvoiceId(null)
    }
  }

  return (
    <>
      <Header className='print:hidden'>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid className='px-2 py-6 sm:px-3 lg:px-4'>
        <div className='rounded-xl border bg-background p-4 shadow-sm print:border-0 print:p-0 print:shadow-none'>
          <div className='mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between print:hidden'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <h1 className='text-xl font-bold tracking-tight'>Aging Report</h1>
              <select
                value={selectedPt}
                onChange={(event) => setSelectedPt(event.target.value)}
                aria-label='Filter PT'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:w-64'
              >
                <option value='all'>Filter PT</option>
                {customers.map((customer) => (
                  <option key={customer} value={customer}>
                    {customer}
                  </option>
                ))}
              </select>
            </div>
            <p className='text-sm text-muted-foreground lg:-translate-x-8'>
              Total {rows.length} invoices | {formatCurrency(totalAmount)}
            </p>
            <div className='flex w-full gap-2 lg:w-auto print:hidden'>
              <label className='relative min-w-0 flex-1 lg:w-72'>
                <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Cari invoice, kapal, atau customer...'
                  aria-label='Cari invoice, kapal, atau customer'
                  className='h-9 w-full rounded-md border bg-background pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20'
                />
              </label>
              <button
                type='button'
                onClick={() => {
                  document.title = ''
                  window.print()
                }}
                className='inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-emerald-500 px-3 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400'
              >
                <Download className='size-4' />
                <span className='hidden whitespace-nowrap xl:inline'>
                  Download PDF Laporan (Filter PT)
                </span>
                <span className='xl:hidden'>PDF</span>
              </button>
            </div>
          </div>

          <div className='hidden print:block print:text-black'>
            <div className='flex items-start justify-between pb-1'>
              <div>
                <h2 className='text-[22px] leading-none font-bold text-[#004d91]'>
                  <span className='text-[#21ae43]'>H</span>ALUAN{' '}
                  <span className='text-[#21ae43]'>D</span>AYA{' '}
                  <span className='text-[#21ae43]'>N</span>IAGA, PT.
                </h2>
                <p className='text-[9px] font-semibold tracking-[0.35em] text-[#21ae43]'>
                  www.haluan-group.com
                </p>
              </div>
              <img
                src='/images/logotok.png'
                alt='Logo Haluan Daya Niaga'
                className='h-20 w-20 object-contain'
              />
            </div>

            <div className='mt-10 grid grid-cols-[1.2fr_1fr_170px] border border-red-500 text-[10px]'>
              <div className='border-r border-red-500 text-center'>
                <p className='font-semibold uppercase'>Date</p>
                <p>{formatLongDate(referenceDate)}</p>
              </div>
              <div className='border-r border-red-500 text-center'>
                <p className='font-semibold uppercase'>Customer</p>
                <p>{selectedPt === 'all' ? 'ALL CUSTOMER' : selectedPt}</p>
              </div>
              <div className='flex items-center justify-center text-center text-[14px] font-bold italic'>
                Statement of Account
              </div>
            </div>

            <table className='mt-3 w-full table-fixed border-collapse text-[10px]'>
              <thead>
                <tr className='border-y border-red-500 text-center font-semibold'>
                  <th
                    rowSpan={2}
                    className='w-[12%] border-r border-slate-300 p-1 text-[9px]'
                  >
                    INV. DATE
                  </th>
                  <th
                    rowSpan={2}
                    className='w-[17%] border-r border-slate-300 p-1'
                  >
                    INVOICE NO
                  </th>
                  <th
                    rowSpan={2}
                    className='w-[9%] border-r border-slate-300 p-1'
                  >
                    TERMS (DAYS)
                  </th>
                  <th
                    rowSpan={2}
                    className='w-[17%] border-r border-slate-300 p-1'
                  >
                    DUE DATE
                  </th>
                  <th
                    rowSpan={2}
                    className='w-[14%] border-r border-slate-300 p-1'
                  >
                    AMOUNT
                  </th>
                  <th
                    colSpan={3}
                    className='border-b border-red-500 p-1 whitespace-nowrap'
                  >
                    DUE DATE (DAYS)
                  </th>
                  <th
                    rowSpan={2}
                    className='w-[14%] border-l border-slate-300 p-1'
                  >
                    PAYMENT DATE
                  </th>
                </tr>
                <tr className='text-center font-semibold'>
                  <th className='w-[5%] border-r border-white bg-[#ffcaca] p-1 whitespace-nowrap'>
                    0 - 30
                  </th>
                  <th className='w-[5%] border-r border-white bg-[#fff59d] p-1 whitespace-nowrap'>
                    31 - 60
                  </th>
                  <th className='w-[5%] bg-[#ff8f8f] p-1 whitespace-nowrap'>
                    &gt; 61
                  </th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((row) => (
                  <tr
                    key={`print-${row.invoiceNumber}`}
                    className='border-b border-slate-300 text-center'
                  >
                    <td className='p-1'>{formatDate(row.invoiceDate)}</td>
                    <td className='p-1'>{row.invoiceNumber}</td>
                    <td className='p-1'>{row.terms}</td>
                    <td className='p-1'>{formatDate(row.dueDate)}</td>
                    <td className='p-1 text-right'>
                      {Math.round(row.amount).toLocaleString('id-ID')}
                    </td>
                    <td className='border-r border-white bg-[#ffcaca] p-1'>
                      {row.aging030 || ''}
                    </td>
                    <td className='border-r border-white bg-[#fff59d] p-1'>
                      {row.aging3160 || ''}
                    </td>
                    <td className='bg-[#ff8f8f] p-1'>{row.aging61 || ''}</td>
                    <td className='p-1'>
                      {row.paymentDateInput ? formatDate(row.paymentDate) : ''}
                    </td>
                  </tr>
                ))}
                <tr className='font-bold'>
                  <td colSpan={4} className='p-2 text-right'>
                    TOTAL
                  </td>
                  <td className='p-2 text-right'>
                    {Math.round(printTotalAmount).toLocaleString('id-ID')}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className='overflow-x-auto print:hidden'>
            <table className='w-full min-w-350 border-collapse text-sm'>
              <thead>
                <tr className='border-b text-left font-medium'>
                  <th className='px-2 py-3'>No</th>
                  <th className='px-2 py-3 whitespace-nowrap'>INV Date</th>
                  <th className='px-2 py-3 whitespace-nowrap'>Invoice No</th>
                  <th className='px-2 py-3 whitespace-nowrap'>PO NO</th>
                  <th className='px-2 py-3 whitespace-nowrap'>Nama Kapal</th>
                  <th className='px-2 py-3 whitespace-nowrap'>Terms (Days)</th>
                  <th className='px-2 py-3 whitespace-nowrap'>Due Date</th>
                  <th className='px-2 py-3 text-right'>Amount</th>
                  <th className='px-2 py-3 text-right whitespace-nowrap'>
                    0-30 Days
                  </th>
                  <th className='px-2 py-3 text-right whitespace-nowrap'>
                    31-60 Days
                  </th>
                  <th className='px-2 py-3 text-right whitespace-nowrap'>
                    61+ Days
                  </th>
                  <th className='px-2 py-3 whitespace-nowrap'>Payment Date</th>
                  <th className='px-2 py-3 text-right'>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={13}
                      className='px-4 py-10 text-center text-muted-foreground'
                    >
                      Memuat aging report...
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
                      Belum ada invoice untuk ditampilkan.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const invoice = invoices.find(
                      (item) => item.id === row.invoiceId
                    )
                    const paymentDate =
                      paymentDates[row.invoiceId] ?? row.paymentDateInput

                    return (
                      <tr
                        key={row.invoiceNumber}
                        className='border-b last:border-0'
                      >
                        <td className='px-2 py-3'>{row.id}</td>
                        <td className='px-2 py-3 whitespace-nowrap'>
                          {formatDate(row.invoiceDate)}
                        </td>
                        <td className='px-2 py-3 whitespace-nowrap'>
                          {row.invoiceNumber}
                        </td>
                        <td className='px-2 py-3 whitespace-nowrap'>
                          {row.poNumber}
                        </td>
                        <td className='px-2 py-3 whitespace-nowrap'>
                          {row.vessel}
                        </td>
                        <td className='px-2 py-3'>{row.terms}</td>
                        <td className='px-2 py-3 whitespace-nowrap'>
                          {formatDate(row.dueDate)}
                        </td>
                        <td className='px-2 py-3 text-right font-semibold whitespace-nowrap'>
                          {formatCurrency(row.amount)}
                        </td>
                        <td className='px-2 py-3 text-right'>
                          {row.aging030 || 0}
                        </td>
                        <td className='px-2 py-3 text-right'>
                          {row.aging3160 || 0}
                        </td>
                        <td className='px-2 py-3 text-right'>
                          {row.aging61 || 0}
                        </td>
                        <td className='px-2 py-3 whitespace-nowrap'>
                          <input
                            type='date'
                            value={paymentDate}
                            onChange={(event) =>
                              handlePaymentDateChange(
                                row.invoiceId,
                                event.target.value
                              )
                            }
                            disabled={row.isPaid}
                            aria-label={`Tanggal pembayaran ${row.invoiceNumber}`}
                            className='h-8 rounded-md border bg-background px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-70 print:border-0'
                          />
                        </td>
                        <td className='px-2 py-3 text-right'>
                          <span className='inline-flex items-center gap-2 whitespace-nowrap'>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${row.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-600 text-white'}`}
                            >
                              {row.isPaid ? 'Lunas' : 'Belum Lunas'}
                            </span>
                            {row.isPaid ? (
                              <CheckCircle2
                                className='size-4 text-emerald-600'
                                aria-label='Sudah dibayar'
                              />
                            ) : (
                              <button
                                type='button'
                                onClick={() => {
                                  if (invoice) void handleMarkAsPaid(invoice)
                                }}
                                disabled={
                                  !invoice ||
                                  !paymentDate ||
                                  updatingInvoiceId === row.invoiceId
                                }
                                className='rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 print:hidden'
                              >
                                {updatingInvoiceId === row.invoiceId
                                  ? 'Menyimpan...'
                                  : 'Konfirmasi Lunas'}
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Main>
    </>
  )
}
