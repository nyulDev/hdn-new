import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, Save, CalendarIcon, RefreshCw } from 'lucide-react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  remainingQty: number
  qty: number
  unit: string
  note: string
  itemNote: string
}

const parseQuantity = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatDate = (value: unknown) => {
  if (!value) return new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const date = new Date(`${String(value)}T00:00:00`)
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
  const ttbContentRef = useRef<HTMLDivElement>(null)
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
            noPo?: string
          }
        >
        const draft = drafts[quotationNoQuo]
        setSelectedQuantities(draft?.quantities ?? {})
        setNotes(draft?.notes ?? {})
        setTtbDate(draft?.date ?? toInputDate(data.formInfo?.tanggal))
        setLocation(draft?.location ?? data.formInfo?.supplyLocation ?? '')
        setInvoiceNoPo(draft?.noPo ?? '')
      } catch {
        setSelectedQuantities({})
        setNotes({})
        setTtbDate(toInputDate(data.formInfo?.tanggal))
        setLocation(data.formInfo?.supplyLocation ?? '')
      }
      const draftNoPo = (() => {
        try {
          const drafts = JSON.parse(
            window.localStorage.getItem(ttbStorageKey) || '{}'
          ) as Record<string, { noPo?: string }>
          const noPo = drafts[quotationNoQuo]?.noPo?.trim()
          return noPo || undefined
        } catch {
          return undefined
        }
      })()
      setInvoiceNoPo(
        [
          draftNoPo,
          invoiceFormInfo.noPo,
          invoiceFormInfo.noPO,
          data.formInfo?.noPo,
          data.formInfo?.noPO,
        ]
          .map((value) => String(value ?? '').trim())
          .find(Boolean) ?? ''
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
  const ttbNumber =
    formInfo.noTtb || (formInfo.noQuo || 'XXXX').replace(/(-\d{4})$/, '-TTB$1')
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
  // Ambil qty TTB tersimpan sebelumnya untuk hitung sisa
  const savedTtbQuantities: Record<string, number> = (() => {
    try {
      const noQuo = String(quotation?.formInfo?.noQuo ?? noQuoInput).trim()
      const drafts = JSON.parse(
        window.localStorage.getItem(ttbStorageKey) || '{}'
      ) as Record<string, { quantities?: Record<string, number> }>
      return drafts[noQuo]?.quantities ?? {}
    } catch {
      return {}
    }
  })()

  const ttbRows: TtbRow[] = items.map((item, index) => {
    const itemKey = getItemKey(item, index)
    const quotationQty = parseQuantity(item.qty)
    const savedQty = savedTtbQuantities[itemKey] ?? 0
    const remainingQty = Math.max(quotationQty - savedQty, 0)
    const qty = Math.min(
      Math.max(selectedQuantities[itemKey] ?? remainingQty, 0),
      remainingQty
    )

    return {
      id: index + 1,
      itemKey,
      description: item.description || item.nama || item.name || '-',
      code: item.code || item.pn || '-',
      quotationQty,
      remainingQty,
      qty,
      unit: item.unit || item.satuan || '',
      note: notes[itemKey] ?? '',
      itemNote: item.note || '',
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
        noPo: invoiceNoPo,
      }
      window.localStorage.setItem(ttbStorageKey, JSON.stringify(drafts))
      alert('TTB berhasil disimpan.')
    } catch {
      alert('TTB tidak dapat disimpan di browser.')
    }
  }

  const handleDownloadPdf = async () => {
    if (!ttbContentRef.current) return
    try {
      const clone = ttbContentRef.current.cloneNode(true) as HTMLElement
      clone.style.cssText =
        'position:fixed;top:0;left:0;width:794px;z-index:-9999;background:#ffffff;padding:16px;'

      // Sembunyikan elemen bertanda data-pdf-hide
      clone.querySelectorAll<HTMLElement>('[data-pdf-hide]').forEach((el) => {
        el.style.display = 'none'
      })
      // Tampilkan elemen bertanda data-pdf-show
      clone.querySelectorAll<HTMLElement>('[data-pdf-show]').forEach((el) => {
        el.style.display = 'inline'
      })
      // Hapus border wrapper utama
      clone.style.border = 'none'
      clone.style.boxShadow = 'none'
      // Hapus border semua input (termasuk catatan)
      clone.querySelectorAll<HTMLElement>('input, textarea').forEach((el) => {
        el.style.border = 'none'
        el.style.outline = 'none'
        el.style.boxShadow = 'none'
        el.style.background = 'transparent'
      })

      document.body.appendChild(clone)

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      })

      document.body.removeChild(clone)

      const imgData = canvas.toDataURL('image/jpeg', 0.98)
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const contentWidth = pageWidth - margin * 2
      const imgHeightMm = (canvas.height * contentWidth) / canvas.width
      const pageContentHeight = pageHeight - margin * 2

      if (imgHeightMm <= pageContentHeight) {
        pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeightMm)
      } else {
        const pageHeightPx = Math.floor((pageContentHeight / contentWidth) * canvas.width)
        let yPx = 0
        while (yPx < canvas.height) {
          if (yPx > 0) pdf.addPage()
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvas.width
          sliceCanvas.height = Math.min(pageHeightPx, canvas.height - yPx)
          const ctx = sliceCanvas.getContext('2d')!
          ctx.drawImage(canvas, 0, yPx, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height)
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.98)
          const sliceHeightMm = (sliceCanvas.height * contentWidth) / canvas.width
          pdf.addImage(sliceData, 'JPEG', margin, margin, contentWidth, sliceHeightMm)
          yPx += pageHeightPx
        }
      }

      const noQuo = String(formInfo.noQuo ?? noQuoInput).trim()
      pdf.save(noQuo ? `TTB-${noQuo}.pdf` : 'TTB.pdf')
    } catch (err) {
      console.error('Download PDF error:', err)
      alert(`Gagal membuat PDF: ${err instanceof Error ? err.message : String(err)}`)
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
            <Button
              variant='outline'
              size='sm'
              className='h-10 gap-1.5'
              onClick={() => {
                setNoQuoInput('')
                setQuotation(null)
                setSelectedQuantities({})
                setNotes({})
                setTtbDate('')
                setLocation('')
                setInvoiceNoPo('')
                setInvoiceNoRfs('')
              }}
            >
              <RefreshCw className='h-4 w-4' />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {quotation ? (
        <div ref={ttbContentRef} className='mx-auto max-w-7xl border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:w-full print:max-w-none print:border-0 print:p-0 print:shadow-none'>
          <div data-pdf-hide className='mb-4 flex justify-end gap-2 print:hidden'>
            <Button onClick={handleSaveTtb}>
              <Save className='h-4 w-4' />
              Simpan TTB
            </Button>
            <Button variant='outline' onClick={() => void handleDownloadPdf()}>
              <Download className='h-4 w-4' />
              Download PDF
            </Button>
          </div>

          <div className='relative border-b border-slate-200 pb-4'>
            {/* Baris atas: Nama perusahaan tengah + Logo kanan */}
            <div className='flex items-start justify-between'>
              <div className='w-24' />{/* spacer kiri agar nama tetap tengah */}
              <div className='text-center'>
                <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
                  <span className='text-[#21ae43] text-4xl md:text-5xl'>H</span>
                  <span className='text-[#004d91]'>ALUAN </span>
                  <span className='text-[#21ae43] text-4xl md:text-5xl'>D</span>
                  <span className='text-[#004d91]'>AYA </span>
                  <span className='text-[#21ae43] text-4xl md:text-5xl'>N</span>
                  <span className='text-[#004d91]'>IAGA, PT.</span>
                </h1>
                <p className='mt-1 text-xs text-slate-500'>
                  NPWP : 073.121.453.2-012.000
                </p>
              </div>
              <img
                src='/images/logotok.png'
                alt='Logo Haluan Daya Niaga'
                className='h-16 w-16 object-contain'
              />
            </div>
            {/* Baris bawah: Alamat kiri, Workshop kanan */}
            <div className='mt-3 flex items-start justify-between text-xs text-slate-600'>
              <div>
                <p className='font-semibold text-slate-900'>
                  Gd. One Pacific Place, Level 11-SCBD
                </p>
                <p>Jl. Jend. Sudirman Kav. 52-53, Jak-Sel 12190</p>
                <p>WhatsApp : +62 811-821-723</p>
                <p>Email : sales@haluan.id / haluan.group@yahoo.co.id</p>
                <p>Website : www.haluan-group.net</p>
              </div>
              <div className='text-right'>
                <p className='font-semibold text-slate-900'>Workshop:</p>
                <p>Cinere Residence H1 No. 5</p>
                <p>Depok Limo Jawa Barat 16515</p>
              </div>
            </div>
            {/* TANDA TERIMA BARANG */}
            <div className='mt-3 px-2 py-1 text-center'>
              <h1 className='text-xl font-black tracking-[0.06em] text-red-600 uppercase md:text-2xl print:text-lg print:tracking-[0.04em]'>
                TANDA TERIMA BARANG
              </h1>
            </div>
          </div>

          <div className='mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-[1fr_365px] print:grid-cols-[1fr_365px]'>
            <div className='border border-slate-700 p-3'>
              <p className='font-semibold'>Dikirimkan ke:</p>
              <p className='mt-1 pl-12 font-semibold'>{formInfo.pt || '-'}</p>
              <span className='flex items-center pl-12'>
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder='Masukkan lokasi...'
                  className='h-6 border-0 border-b border-dashed border-slate-400 px-0 text-sm shadow-none focus-visible:ring-0 print:hidden'
                  aria-label='Lokasi pengiriman'
                />
                <span className='hidden print:inline'>{location || '-'}</span>
              </span>
              <p className='pl-12'>{formInfo.kapal || '-'}</p>
              <p className='pl-12'>{noRfs}</p>
            </div>
            <div className='grid grid-cols-[1fr_2fr] border border-slate-700 text-center'>
              <div className='flex flex-col items-center justify-center border-r border-slate-700 p-2'>
                <p className='font-bold'>Tanggal</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      data-pdf-hide
                      variant='ghost'
                      className='mt-1 h-7 gap-1 px-2 text-xs font-normal print:hidden'
                    >
                      <CalendarIcon className='h-3 w-3 text-muted-foreground' />
                      {ttbDate
                        ? formatDate(ttbDate)
                        : 'Pilih tanggal'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='center'>
                    <Calendar
                      mode='single'
                      selected={ttbDate ? new Date(`${ttbDate}T00:00:00`) : undefined}
                      onSelect={(date) => {
                        if (date) setTtbDate(date.toLocaleDateString('sv-SE'))
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span data-pdf-show className='mt-1 hidden text-sm print:inline'>{formatDate(ttbDate)}</span>
              </div>
              <div className='flex flex-col items-center justify-center p-2'>
                <p className='font-bold'>No.</p>
                <p className='mt-1 text-center text-xs'>{ttbNumber}</p>
              </div>
              <div className='col-span-2 border-t border-slate-700 p-2 text-left'>
                <label className='font-semibold' htmlFor='ttb-no-po'>
                  No. PO:
                </label>{' '}
                <Input
                  id='ttb-no-po'
                  data-pdf-hide
                  value={invoiceNoPo}
                  onChange={(event) => setInvoiceNoPo(event.target.value)}
                  placeholder='Ketik No. PO'
                  className='inline-flex h-6 w-48 border-0 border-b border-dashed border-slate-400 px-1 text-xs shadow-none focus-visible:ring-0 print:hidden'
                  aria-label='Nomor PO'
                />
                <span className='hidden print:inline'>
                  {invoiceNoPo || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className='mt-6 overflow-hidden border border-slate-200'>
            <table className='w-full border-collapse text-left text-xs'>
              <thead className='bg-slate-100 text-slate-800'>
                <tr>
                  <th data-pdf-hide className='w-10 border border-slate-200 px-1 py-2 print:hidden'>
                    Pilih
                  </th>
                  <th className='w-10 border border-slate-200 px-1 py-2'>No</th>
                  <th className='border border-slate-200 px-3 py-2'>CODE</th>
                  <th className='min-w-64 border border-slate-200 px-3 py-2'>
                    Uraian
                  </th>
                  <th className='w-24 border border-slate-200 px-1 py-2 text-center'>
                    Quantity
                  </th>
                  <th className='w-20 border border-slate-200 px-1 py-2 text-center'>
                    Satuan
                  </th>
                  <th className='border border-slate-200 px-3 py-2 text-center'>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {ttbRows.length > 0 ? (
                  ttbRows.map((row) => (
                    <tr key={row.id} className='align-top'>
                      <td data-pdf-hide className='w-10 border border-slate-200 px-1 py-2 text-center print:hidden'>
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
                      <td className='border border-slate-200 px-3 py-2 whitespace-nowrap'>
                        {row.code}
                      </td>
                      <td className='min-w-64 border border-slate-200 px-3 py-2'>
                        <div>{row.description}</div>
                        {row.itemNote && (
                          <div className='mt-0.5 text-xs italic text-red-500'>{row.itemNote}</div>
                        )}
                      </td>
                      <td className='w-24 border border-slate-200 px-1 py-2 text-center'>
                        <Input
                          data-pdf-hide
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
                          className='mx-auto h-8 w-20 text-center'
                          aria-label={`Qty ${row.description}`}
                        />
                        <span data-pdf-show className='hidden text-sm font-medium'>
                          {row.qty}
                        </span>
                        <span data-pdf-hide className='mt-1 block text-xs text-slate-500 print:hidden'>
                          Sisa: {row.remainingQty} / {row.quotationQty}
                        </span>
                      </td>
                      <td className='w-20 border border-slate-200 px-1 py-2 text-center'>
                        {row.unit || '-'}
                      </td>
                      <td className='border border-slate-200 px-3 py-2 text-center'>
                        <Input
                          data-pdf-hide
                          value={row.note}
                          onChange={(event) =>
                            handleNoteChange(row.itemKey, event.target.value)
                          }
                          placeholder='Catatan'
                          className='h-8 min-w-32 text-center print:hidden'
                          aria-label={`Notes ${row.description}`}
                        />
                        <span data-pdf-show className='hidden print:inline'>{row.note}</span>
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
