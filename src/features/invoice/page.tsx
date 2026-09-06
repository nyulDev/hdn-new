import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { getCustomers, type Customer } from '@/lib/api/customers'
import { getEstimasiByNoQuo, getEstimasiList } from '@/lib/api/estimasi'
import { createInvoice, getInvoices } from '@/lib/api/invoice'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)

const parseQuotationNumber = (value: unknown) => {
  const text = String(value ?? '')
  const parsed = parseFloat(
    text.replace(/,/g, '').replace(/\./g, (match, offset, source) => {
      const rest = source.slice(offset + 1)
      return /^\d{3}(\.|,|$)/.test(rest) ? '' : match
    })
  )

  return Number.isFinite(parsed) ? parsed : 0
}

type InvoiceRow = {
  id: number
  itemKey: string
  quotationQty: number
  remainingQty: number
  pn: string
  description: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
}

export function InvoicePage() {
  const [noQuoInput, setNoQuoInput] = useState('')
  const [noPo, setNoPo] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotationList, setQuotationList] = useState<
    { id: number; noQuo: string }[]
  >([])
  const [loadedInvoice, setLoadedInvoice] = useState<Record<
    string,
    any
  > | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<
    Awaited<ReturnType<typeof getInvoices>>
  >([])
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getEstimasiList()
      .then(setQuotationList)
      .catch(() => setQuotationList([]))
  }, [])

  useEffect(() => {
    void getCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]))
  }, [])

  useEffect(() => {
    void getInvoices()
      .then(setInvoices)
      .catch(() => setInvoices([]))
  }, [])

  const handleLoadQuotation = async (selectedNoQuo = noQuoInput) => {
    const noQuo = selectedNoQuo.trim()

    if (!noQuo) {
      alert('No. Quo wajib diisi terlebih dahulu')
      return
    }

    setLoading(true)

    try {
      const data = await getEstimasiByNoQuo(noQuo)
      setLoadedInvoice(data)
      setSelectedQuantities({})
      setNoPo(data.formInfo?.noPo ?? data.formInfo?.noPO ?? '')
      setLocation(data.formInfo?.supplyLocation || 'PLTU Suralaya')
      setNoQuoInput(data.formInfo?.noQuo ?? noQuo)
    } catch (error) {
      setLoadedInvoice(null)
      setLocation('')
      alert('Gagal menarik data quotation: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const quotationRange = parseQuotationNumber(
    loadedInvoice?.formInfo?.quotationRange
  )
  const quotationItems = loadedInvoice?.items ?? []
  const getItemKey = (item: any, index: number) =>
    String(
      item?.itemKey ||
        item?.code ||
        item?.id ||
        item?.description ||
        item?.nama ||
        `index-${index}`
    )
  const invoicedQuantities = invoices
    .filter((invoice) => invoice.noQuo === loadedInvoice?.formInfo?.noQuo)
    .flatMap((invoice) => invoice.items ?? [])
    .reduce<Record<string, number>>((totals, item) => {
      const key = getItemKey(item, item?.index ?? 0)
      totals[key] = (totals[key] ?? 0) + parseQuotationNumber(item?.qty)
      return totals
    }, {})
  const invoiceRows: InvoiceRow[] = quotationItems.map(
    (item: any, index: number) => {
      const quotationQty = parseQuotationNumber(item?.qty)
      const itemKey = getItemKey(item, index)
      const remainingQty = Math.max(
        quotationQty - (invoicedQuantities[itemKey] ?? 0),
        0
      )
      const qty = Math.min(
        Math.max(selectedQuantities[itemKey] ?? remainingQty, 0),
        remainingQty
      )
      const quotationUnitPrice = String(item?.unitPriceQuo ?? '').trim()
      const unitPrice = quotationUnitPrice
        ? parseQuotationNumber(quotationUnitPrice)
        : quotationRange === 0
          ? 0
          : (parseQuotationNumber(item?.unitPrice) * quotationRange) / 100
      const amount = qty * unitPrice

      return {
        id: index + 1,
        itemKey,
        quotationQty,
        remainingQty,
        pn: item?.pn || '-',
        description: item?.description || item?.nama || item?.name || 'Item',
        unit: item?.unit || item?.satuan || '-',
        qty,
        unitPrice,
        amount,
      }
    }
  )

  const subtotal = invoiceRows.reduce((sum, row) => sum + row.amount, 0)
  const discount = Number(loadedInvoice?.costs?.discountPct ?? 0)
  const discountAmount = subtotal * (discount / 100)
  const totalAfterDiscount = subtotal - discountAmount
  const ppnPct = Number(loadedInvoice?.formInfo?.quotationPpnPct ?? 12)
  const ppn = totalAfterDiscount * (ppnPct / 100)
  const totalInvoice = totalAfterDiscount + ppn
  const invoiceNo = loadedInvoice
    ? `${(loadedInvoice.formInfo?.noQuo || 'XXX').replace(/\s+/g, '')}-INV-${new Date().getFullYear()}`
    : 'XXX-INV-2026'
  const customer = customers.find(
    (item) => item.pt === loadedInvoice?.formInfo?.pt
  )

  const handleQuantityChange = (itemKey: string, value: string) => {
    const quantity = parseQuotationNumber(value)
    setSelectedQuantities((current) => ({ ...current, [itemKey]: quantity }))
  }

  const handleItemToggle = (itemKey: string, checked: boolean) => {
    const row = invoiceRows.find((item) => item.itemKey === itemKey)
    setSelectedQuantities((current) => ({
      ...current,
      [itemKey]: checked ? (row?.remainingQty ?? 0) : 0,
    }))
  }

  const handleSaveInvoice = async () => {
    if (!loadedInvoice || invoiceRows.every((row) => row.qty === 0)) {
      alert('Masukkan qty invoice terlebih dahulu')
      return
    }

    setSaving(true)
    try {
      await createInvoice({
        noQuo: loadedInvoice.formInfo?.noQuo ?? noQuoInput,
        judul: loadedInvoice.judul ?? 'Invoice',
        customerName: loadedInvoice.formInfo?.pt ?? '',
        amount: totalInvoice,
        status: 'belum_dibayar',
        formInfo: {
          ...(loadedInvoice.formInfo ?? {}),
          noPo,
          supplyLocation: location,
        },
        items: invoiceRows
          .filter((row) => row.qty > 0)
          .map((row) => ({
            ...quotationItems[row.id - 1],
            itemKey: row.itemKey,
            description: row.description,
            unit: row.unit,
            qty: row.qty,
          })),
        costs: loadedInvoice.costs ?? {},
      })
      const refreshedInvoices = await getInvoices()
      setInvoices(refreshedInvoices)
      setSelectedQuantities({})
      alert('Invoice berhasil disimpan. Sisa qty sudah diperbarui.')
    } catch (error) {
      alert('Gagal menyimpan invoice: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-6 p-1'>
      <div className='flex items-center justify-between gap-4 print:hidden'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Invoice</h1>
          <p className='text-sm text-muted-foreground'>
            Pilih No. Quo untuk menampilkan invoice preview
          </p>
        </div>
      </div>

      <Card className='print:hidden'>
        <CardHeader>
          <CardTitle>No. Quo</CardTitle>
          <CardDescription>
            Pilih nomor quotation yang sudah tersimpan untuk menampilkan invoice
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-col gap-3 md:flex-row'>
            <Input
              value={noQuoInput}
              onChange={(event) => {
                const selectedNoQuo = event.target.value
                setNoQuoInput(selectedNoQuo)
                if (
                  quotationList.some(
                    (quotation) => quotation.noQuo === selectedNoQuo
                  )
                ) {
                  void handleLoadQuotation(selectedNoQuo)
                } else if (!selectedNoQuo.trim()) {
                  setLoadedInvoice(null)
                }
              }}
              list='invoice-quotation-numbers'
              placeholder='Search No. Quo...'
              disabled={loading}
              className='h-10 w-56 text-sm'
            />
            <datalist id='invoice-quotation-numbers'>
              {quotationList
                .filter((quotation) => quotation.noQuo)
                .map((quotation) => (
                  <option key={quotation.id} value={quotation.noQuo} />
                ))}
            </datalist>
          </div>
        </CardContent>
      </Card>

      {loadedInvoice ? (
        <div className='rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:border-0 print:p-0 print:shadow-none'>
          <div className='mb-4 flex justify-end gap-2 print:hidden'>
            <Button onClick={() => void handleSaveInvoice()} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Invoice'}
            </Button>
            <Button variant='outline' onClick={() => window.print()}>
              <Printer className='h-4 w-4' />
              Print
            </Button>
          </div>
          <div className='mb-6 flex items-start justify-between gap-4'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
                <span className='text-[#21ae43]'>H</span>
                <span className='text-[#004d91]'>ALUAN </span>
                <span className='text-[#21ae43]'>D</span>
                <span className='text-[#004d91]'>AYA </span>
                <span className='text-[#21ae43]'>N</span>
                <span className='text-[#004d91]'>IAGA, PT.</span>
              </h1>
              <p className='text-sm font-medium text-[#4b5563]'>
                <span className='text-[#21ae43]'>
                  Marine - Oil & Gas - Mining Services
                </span>
              </p>
              <p className='mt-1 font-mono text-xs text-[#6b7280]'>
                N P W P : 0 7 3 . 1 2 1 . 4 5 3 . 2 - 0 1 2 . 0 0 0
              </p>
              <p className='mt-1 font-mono text-xs text-[#6b7280]'>
                WEBSITE : www.haluan-group.net
              </p>
            </div>
            <img
              src='/images/logotok.png'
              alt='Logo Haluan Daya Niaga'
              className='h-20 w-20 object-contain'
            />
          </div>

          <div className='flex flex-col items-center justify-center border-b border-slate-300 pb-3'>
            <h3 className='text-5xl font-black tracking-wide text-red-600 uppercase'>
              INVOICE
            </h3>
          </div>

          <div className='mt-6 grid gap-4 md:grid-cols-[1.4fr_0.9fr]'>
            <div className='space-y-2 text-sm'>
              <p>
                <span className='font-semibold'>PT. Coba Coba</span>
              </p>
              <p>Attn. {customer?.kontak || '-'}</p>
              <p>
                Reference : {loadedInvoice.formInfo?.noRfs || 'RFS-XXXX-XXX'}
              </p>
              <p>MV. Kapal Api</p>
              <p>Terms : 30 calendar days</p>
              <p>Due Date : Fri 2 Oct 2026</p>
            </div>

            <div className='space-y-2 text-sm'>
              <div className='grid grid-cols-[120px_1fr] gap-2'>
                <span className='font-semibold'>NO</span>
                <span>: {invoiceNo}</span>
                <span className='font-semibold'>NO. PO</span>
                <span>
                  :{' '}
                  <Input
                    value={noPo}
                    onChange={(event) => setNoPo(event.target.value)}
                    placeholder='Ketik No. PO'
                    className='inline-flex h-8 w-44 print:hidden'
                    aria-label='No. PO'
                  />
                  <span className='hidden print:inline'>{noPo || '-'}</span>
                </span>
                <span className='font-semibold'>CUSTOMER ID</span>
                <span>: {loadedInvoice.formInfo?.customerId || '093'}</span>
                <span className='font-semibold'>DATE</span>
                <span>
                  :{' '}
                  {new Date().toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className='font-semibold'>PAGE</span>
                <span>: 1</span>
                <span className='font-semibold'>LOCATION</span>
                <span>
                  :{' '}
                  <Input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder='Masukkan lokasi'
                    className='inline-flex h-8 w-40 print:hidden'
                    aria-label='Lokasi invoice'
                  />
                  <span className='hidden print:inline'>{location || '-'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className='mt-6 overflow-hidden border border-slate-300'>
            <table className='w-full border-collapse text-left text-sm'>
              <thead className='bg-slate-200 text-slate-800'>
                <tr>
                  <th className='w-12 border border-slate-300 px-1 py-2 print:hidden'>
                    Pilih
                  </th>
                  <th className='w-10 border border-slate-300 px-1 py-2'>No</th>
                  <th className='border border-slate-300 px-3 py-2'>Code</th>
                  <th className='min-w-64 border border-slate-300 px-3 py-2'>
                    Description
                  </th>
                  <th className='w-24 border border-slate-300 px-1 py-2 text-right'>
                    Quantity
                  </th>
                  <th className='w-20 border border-slate-300 px-1 py-2'>
                    Satuan
                  </th>
                  <th className='border border-slate-300 px-3 py-2 text-right'>
                    Unit Price
                  </th>
                  <th className='border border-slate-300 px-3 py-2 text-right'>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.length > 0 ? (
                  invoiceRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`align-top ${row.qty === 0 ? 'print:hidden' : ''}`}
                    >
                      <td className='w-12 border border-slate-300 px-1 py-2 text-center print:hidden'>
                        <Checkbox
                          checked={row.qty > 0}
                          disabled={row.remainingQty === 0}
                          onCheckedChange={(checked) =>
                            handleItemToggle(row.itemKey, checked === true)
                          }
                          aria-label={`Pilih ${row.description}`}
                        />
                      </td>
                      <td className='w-10 border border-slate-300 px-1 py-2'>
                        {row.id}
                      </td>
                      <td className='border border-slate-300 px-3 py-2'>
                        {row.pn}
                      </td>
                      <td className='min-w-64 border border-slate-300 px-3 py-2'>
                        {row.description}
                      </td>
                      <td className='w-24 border border-slate-300 px-1 py-2 text-right'>
                        <Input
                          type='number'
                          min={0}
                          max={row.remainingQty}
                          step='any'
                          value={row.qty}
                          onChange={(event) =>
                            handleQuantityChange(
                              row.itemKey,
                              event.target.value
                            )
                          }
                          className='ml-auto h-9 w-20 text-right'
                          aria-label={`Qty ${row.description}`}
                        />
                        <span className='mt-1 block text-xs text-slate-500'>
                          Sisa: {row.remainingQty} / {row.quotationQty}
                        </span>
                      </td>
                      <td className='w-20 border border-slate-300 px-1 py-2'>
                        {row.unit}
                      </td>
                      <td className='border border-slate-300 px-3 py-2 text-right'>
                        {formatCurrency(row.unitPrice)}
                      </td>
                      <td className='border border-slate-300 px-3 py-2 text-right'>
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className='border border-slate-300 px-3 py-6 text-center text-slate-500'
                    >
                      Tidak ada item untuk invoice ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className='mt-6 flex justify-end'>
            <div className='w-full max-w-md space-y-2 text-sm'>
              <div className='flex justify-between'>
                <span>Sub Total :</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className='flex justify-between'>
                <span>Discount :</span>
                <span>{formatCurrency(discountAmount)}</span>
              </div>
              <div className='flex justify-between border-t border-slate-300 pt-2 font-semibold'>
                <span>Total after discount :</span>
                <span>{formatCurrency(totalAfterDiscount)}</span>
              </div>
              <div className='flex justify-between'>
                <span>DPP :</span>
                <span>{formatCurrency(totalAfterDiscount)}</span>
              </div>
              <div className='flex justify-between'>
                <span>PPN {ppnPct}% :</span>
                <span>{formatCurrency(ppn)}</span>
              </div>
              <div className='mt-3 flex justify-between border border-slate-300 bg-slate-100 px-3 py-2 text-base font-bold'>
                <span>TOTAL INVOICE MUST BE PAID :</span>
                <span>{formatCurrency(totalInvoice)}</span>
              </div>
            </div>
          </div>

          <div className='mt-10 border-t border-slate-300 pt-6'>
            <div className='flex items-start justify-between gap-8 text-sm'>
              <div>
                <p className='font-semibold uppercase'>REMIT TO:</p>
                <p>BANK SYARIAH INDONESIA - CINERE BRANCH</p>
                <p>A/C NO. 7089 - 555 - 994</p>
                <p>A/C NAME: PT. HALUAN DAYA NIAGA</p>
                <p className='mt-8 font-semibold uppercase'>
                  ASSOCIATION MEMBER:
                </p>
                <div className='mt-2 flex items-center gap-3'>
                  {['4.png', '5.png', '6.png'].map((fileName) => (
                    <img
                      key={fileName}
                      src={`/images/${fileName}`}
                      alt={`Association member ${fileName.replace('.png', '')}`}
                      className='h-12 w-auto object-contain'
                    />
                  ))}
                </div>
              </div>
              <div className='text-right'>
                <p className='font-semibold uppercase'>PT. HALUAN DAYA NIAGA</p>
                <p className='invisible' aria-hidden='true'>
                  A/C NO. 7089 - 555 - 994
                </p>
                <p className='invisible' aria-hidden='true'>
                  A/C NAME: PT. HALUAN DAYA NIAGA
                </p>
                <p className='mt-8 font-semibold uppercase'>IRFAN</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='rounded-md border border-dashed p-6 text-sm text-muted-foreground'>
          Belum ada data quotation yang ditarik.
        </div>
      )}
    </div>
  )
}
