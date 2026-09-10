import { useEffect, useState } from 'react'
import { CheckCircle2, Printer, Save } from 'lucide-react'
import { getEstimasiByNoQuo, getEstimasiList } from '@/lib/api/estimasi'
import { getInvoiceByNoQuo } from '@/lib/api/invoice'
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

type TtbQuotation = {
  judul?: string
  formInfo?: Record<string, any>
  items?: Array<Record<string, any>>
}

type TtbRow = {
  id: number
  itemKey: string
  description: string
  code: string
  quotationQty: number
  qty: number
  unit: string
  note: string
}

const parseQuantity = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatDate = (value: unknown) => {
  if (!value) return new Date().toLocaleDateString('id-ID')
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

const toInputDate = (value: unknown) => {
  if (!value) return new Date().toISOString().slice(0, 10)
  const date = new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toISOString().slice(0, 10)
}

export function TtbPage() {
  const [noQuoInput, setNoQuoInput] = useState('')
  const [quotationList, setQuotationList] = useState<
    { id: number; noQuo: string }[]
  >([])
  const [quotation, setQuotation] = useState<TtbQuotation | null>(null)
  const [invoiceNoPo, setInvoiceNoPo] = useState('')
  const [invoiceNoRfs, setInvoiceNoRfs] = useState('')
  const [ttbDate, setTtbDate] = useState('')
  const [location, setLocation] = useState('')
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const ttbStorageKey = 'ttb-drafts'

  useEffect(() => {
    void getEstimasiList()
      .then(setQuotationList)
      .catch(() => setQuotationList([]))
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
      const quotationNoQuo = String(data.formInfo?.noQuo ?? noQuo).trim()
      let invoiceFormInfo: Record<string, any> = {}

      try {
        const invoice = await getInvoiceByNoQuo(quotationNoQuo)
        invoiceFormInfo = invoice.formInfo ?? {}
      } catch {
        invoiceFormInfo = {}
      }

      setQuotation(data)
      try {
        const drafts = JSON.parse(
          window.localStorage.getItem(ttbStorageKey) || '{}'
        ) as Record<
          string,
          {
            quantities?: Record<string, number>
            notes?: Record<string, string>
            date?: string
            location?: string
          }
        >
        const draft = drafts[quotationNoQuo]
        setSelectedQuantities(draft?.quantities ?? {})
        setNotes(draft?.notes ?? {})
        setTtbDate(draft?.date ?? toInputDate(data.formInfo?.tanggal))
        setLocation(draft?.location ?? data.formInfo?.supplyLocation ?? '')
      } catch {
        setSelectedQuantities({})
        setNotes({})
        setTtbDate(toInputDate(data.formInfo?.tanggal))
        setLocation(data.formInfo?.supplyLocation ?? '')
      }
      setInvoiceNoPo(
        invoiceFormInfo.noPo ??
          invoiceFormInfo.noPO ??
          data.formInfo?.noPo ??
          data.formInfo?.noPO ??
          ''
      )
      setInvoiceNoRfs(invoiceFormInfo.noRfs ?? '')
      setNoQuoInput(data.formInfo?.noQuo ?? noQuo)
    } catch (error) {
      setQuotation(null)
      setInvoiceNoPo('')
      setInvoiceNoRfs('')
      setSelectedQuantities({})
      setNotes({})
      setTtbDate('')
      setLocation('')
      alert('Gagal menarik data quotation: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const formInfo = quotation?.formInfo ?? {}
  const items = quotation?.items ?? []
  const ttbNumber = formInfo.noTtb || `TTB-${formInfo.noQuo || 'XXXX'}`
  const noRfs = invoiceNoRfs || formInfo.noRfs || formInfo.noRFS || '-'
  const getItemKey = (item: Record<string, any>, index: number) =>
    String(
      item.itemKey ||
        item.code ||
        item.pn ||
        item.id ||
        item.description ||
        `index-${index}`
    )
  const ttbRows: TtbRow[] = items.map((item, index) => {
    const itemKey = getItemKey(item, index)
    const quotationQty = parseQuantity(item.qty)
    const qty = Math.min(
      Math.max(selectedQuantities[itemKey] ?? quotationQty, 0),
      quotationQty
    )

    return {
      id: index + 1,
      itemKey,
      description: item.description || item.nama || item.name || '-',
      code: item.code || item.pn || '-',
      quotationQty,
      qty,
      unit: item.unit || item.satuan || '',
      note: notes[itemKey] ?? item.note ?? '',
    }
  })

  const handleQuantityChange = (itemKey: string, value: string) => {
    setSelectedQuantities((current) => ({
      ...current,
      [itemKey]: parseQuantity(value),
    }))
  }

  const handleItemToggle = (row: TtbRow, checked: boolean) => {
    setSelectedQuantities((current) => ({
      ...current,
      [row.itemKey]: checked ? row.quotationQty : 0,
    }))
  }

  const handleNoteChange = (itemKey: string, value: string) => {
    setNotes((current) => ({ ...current, [itemKey]: value }))
  }

  const handleSaveTtb = () => {
    const quotationNoQuo = String(formInfo.noQuo ?? noQuoInput).trim()
    if (!quotationNoQuo) return

    try {
      const drafts = JSON.parse(
        window.localStorage.getItem(ttbStorageKey) || '{}'
      ) as Record<string, unknown>
      drafts[quotationNoQuo] = {
        quantities: selectedQuantities,
        notes,
        date: ttbDate,
        location,
      }
      window.localStorage.setItem(ttbStorageKey, JSON.stringify(drafts))
      alert('TTB berhasil disimpan.')
    } catch {
      alert('TTB tidak dapat disimpan di browser.')
    }
  }

  return (
    <div className='space-y-6 p-1'>
      <div className='flex items-center justify-between gap-4 print:hidden'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>TTB</h1>
          <p className='text-sm text-muted-foreground'>
            Pilih No. Quo untuk menampilkan tanda terima barang
          </p>
        </div>
      </div>

      <Card className='print:hidden'>
        <CardHeader>
          <CardTitle>No. Quo</CardTitle>
          <CardDescription>
            Pilih nomor quotation yang sudah tersimpan untuk menampilkan TTB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col gap-3 md:flex-row'>
            <Input
              value={noQuoInput}
              onChange={(event) => {
                const value = event.target.value
                setNoQuoInput(value)
                if (quotationList.some((item) => item.noQuo === value)) {
                  void handleLoadQuotation(value)
                } else if (!value.trim()) {
                  setQuotation(null)
                }
              }}
              list='ttb-quotation-numbers'
              placeholder='Search No. Quo...'
              disabled={loading}
              className='h-10 w-56 text-sm'
            />
            <datalist id='ttb-quotation-numbers'>
              {quotationList
                .filter((item) => item.noQuo)
                .map((item) => (
                  <option key={item.id} value={item.noQuo} />
                ))}
            </datalist>
          </div>
        </CardContent>
      </Card>

      {quotation ? (
        <div className='mx-auto max-w-7xl border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:w-full print:max-w-none print:border-0 print:p-0 print:shadow-none'>
          <div className='mb-4 flex justify-end gap-2 print:hidden'>
            <Button onClick={handleSaveTtb}>
              <Save className='h-4 w-4' />
              Simpan TTB
            </Button>
            <Button variant='outline' onClick={() => window.print()}>
              <Printer className='h-4 w-4' />
              Print
            </Button>
          </div>

          <div className='relative flex items-start justify-center border-b border-slate-200 pb-4'>
            <div className='text-center'>
              <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
                <span className='text-[#21ae43]'>H</span>
                <span className='text-[#004d91]'>ALUAN </span>
                <span className='text-[#21ae43]'>D</span>
                <span className='text-[#004d91]'>AYA </span>
                <span className='text-[#21ae43]'>N</span>
                <span className='text-[#004d91]'>IAGA, PT.</span>
              </h1>
              <p className='text-sm font-medium text-[#21ae43]'>
                Marine - Oil & Gas - Mining Services
              </p>
              <p className='mt-1 text-xs text-slate-500'>
                NPWP : 073.121.453.2-012.000
              </p>
            </div>
            <img
              src='/images/logotok.png'
              alt='Logo Haluan Daya Niaga'
              className='absolute top-0 right-0 h-24 w-24 object-contain'
            />
          </div>

          <div className='grid gap-6 border-b border-slate-300 py-4 text-xs text-slate-600 md:grid-cols-[1fr_1fr_365px] print:grid-cols-[1fr_1fr_280px] print:gap-4 print:text-[10px]'>
            <div>
              <p className='font-semibold text-slate-900'>
                Gd. One Pacific Place, Level 11-SCBD
              </p>
              <p>Jl. Jend. Sudirman Kav. 52-53, Jak-Sel 12190</p>
              <p>Ph./Fax. 021-21275897-7538093</p>
              <p>Email : sales@haluan.id / haluan.group@yahoo.co.id</p>
              <p>Website : www.haluan-group.net</p>
            </div>
            <div className='justify-self-center text-center'>
              <p className='font-semibold text-slate-900'>Workshop:</p>
              <p>Cinere Residence H1 No. 5</p>
              <p>Depok Regency Jawa Barat 16515</p>
            </div>
            <div className='self-center border-2 border-slate-700 px-2 py-1 text-center'>
              <h2 className='text-2xl font-black tracking-[0.08em] text-red-600 uppercase md:text-3xl print:text-lg print:tracking-[0.04em]'>
                TANDA TERIMA BARANG
              </h2>
            </div>
          </div>

          <div className='mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-[1fr_365px] print:grid-cols-[1fr_365px]'>
            <div className='border border-slate-700 p-3'>
              <p className='font-semibold'>Dikirimkan ke:</p>
              <p className='mt-1 pl-12 font-semibold'>{formInfo.pt || '-'}</p>
              <p className='pl-12'>{location || '-'}</p>
              <p className='pl-12'>{formInfo.kapal || '-'}</p>
              <p className='pl-12'>{noRfs}</p>
            </div>
            <div className='grid grid-cols-2 border border-slate-700 text-center'>
              <div className='border-r border-slate-700 p-2'>
                <p className='font-bold'>Tanggal</p>
                <Input
                  type='date'
                  value={ttbDate}
                  onChange={(event) => setTtbDate(event.target.value)}
                  className='mt-1 h-7 w-full border-0 p-0 text-center text-xs print:hidden'
                  aria-label='Tanggal TTB'
                />
                <span className='hidden text-xs print:inline'>
                  {formatDate(ttbDate)}
                </span>
              </div>
              <div className='p-2'>
                <p className='font-bold'>No.</p>
                <p className='mt-2 text-xs'>{ttbNumber}</p>
              </div>
              <div className='col-span-2 border-t border-slate-700 p-2 text-left'>
                <span className='font-semibold'>No. PO:</span>{' '}
                {invoiceNoPo || '-'}
              </div>
            </div>
          </div>

          <div className='mt-6 overflow-hidden border border-slate-200'>
            <table className='w-full border-collapse text-left text-xs'>
              <thead className='bg-slate-100 text-slate-800'>
                <tr>
                  <th className='w-10 border border-slate-200 px-1 py-2 print:hidden'>
                    Pilih
                  </th>
                  <th className='w-10 border border-slate-200 px-1 py-2'>No</th>
                  <th className='border border-slate-200 px-3 py-2'>CODE</th>
                  <th className='min-w-64 border border-slate-200 px-3 py-2'>
                    Uraian
                  </th>
                  <th className='w-24 border border-slate-200 px-1 py-2 text-right'>
                    Quantity
                  </th>
                  <th className='w-20 border border-slate-200 px-1 py-2'>
                    Satuan
                  </th>
                  <th className='border border-slate-200 px-3 py-2'>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {ttbRows.length > 0 ? (
                  ttbRows.map((row) => (
                    <tr key={row.id} className='align-top'>
                      <td className='w-10 border border-slate-200 px-1 py-2 text-center print:hidden'>
                        <Checkbox
                          checked={row.qty > 0}
                          onCheckedChange={(checked) =>
                            handleItemToggle(row, checked === true)
                          }
                          aria-label={`Pilih ${row.description}`}
                        />
                      </td>
                      <td className='w-10 border border-slate-200 px-1 py-2'>
                        {row.id}
                      </td>
                      <td className='border border-slate-200 px-3 py-2'>
                        {row.code}
                      </td>
                      <td className='min-w-64 border border-slate-200 px-3 py-2'>
                        {row.description}
                      </td>
                      <td className='w-24 border border-slate-200 px-1 py-2 text-right'>
                        <Input
                          type='number'
                          min={0}
                          max={row.quotationQty}
                          step='any'
                          value={row.qty}
                          onChange={(event) =>
                            handleQuantityChange(
                              row.itemKey,
                              event.target.value
                            )
                          }
                          className='ml-auto h-8 w-20 text-right'
                          aria-label={`Qty ${row.description}`}
                        />
                        <span className='mt-1 block text-xs text-slate-500 print:hidden'>
                          Maks: {row.quotationQty}
                        </span>
                      </td>
                      <td className='w-20 border border-slate-200 px-1 py-2'>
                        {row.unit || '-'}
                      </td>
                      <td className='border border-slate-200 px-3 py-2'>
                        <Input
                          value={row.note}
                          onChange={(event) =>
                            handleNoteChange(row.itemKey, event.target.value)
                          }
                          placeholder='Catatan'
                          className='h-8 min-w-32'
                          aria-label={`Notes ${row.description}`}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className='border border-slate-200 px-3 py-6 text-center text-slate-500'
                    >
                      Tidak ada item untuk TTB ini
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className='mt-8 grid gap-8 border-t border-slate-200 pt-6 md:grid-cols-[220px_1fr_300px] md:items-end print:grid-cols-[220px_1fr_300px] print:items-end'>
            <div className='min-w-48 text-left text-sm'>
              <p className='font-semibold'>Diterima Oleh,</p>
              <div className='mt-14 w-24 border-b border-slate-700' />
            </div>
            <div className='flex items-center justify-center gap-6'>
              <img
                src='/images/4nbg.png'
                alt='Logo 4'
                className='h-24 w-auto object-contain'
              />
              <img
                src='/images/51.png'
                alt='Logo 51'
                className='h-24 w-auto object-contain'
              />
            </div>
            <div className='overflow-hidden border-2 border-slate-800'>
              <div className='bg-green-600 px-4 py-2 text-center text-3xl font-black text-white'>
                CHECKED
              </div>
              <div className='space-y-4 bg-slate-50 p-3 text-green-600'>
                <div className='flex items-center gap-2'>
                  <CheckCircle2 className='h-5 w-5 shrink-0' />
                  <span className='font-medium'>BY</span>
                  <span className='h-5 flex-1 border-b-2 border-green-500' />
                </div>
                <div className='flex items-center gap-2'>
                  <CheckCircle2 className='h-5 w-5 shrink-0' />
                  <span className='font-medium'>DATE</span>
                  <span className='h-5 flex-1 border-b-2 border-green-500' />
                </div>
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
