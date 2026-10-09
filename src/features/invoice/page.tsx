import { useEffect, useRef, useState } from 'react'
import { Printer, RefreshCw, Download, CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'
import { getCustomers, type Customer } from '@/lib/api/customers'
import { getEstimasiByNoQuo, getEstimasiList } from '@/lib/api/estimasi'
import { createInvoice, getInvoices, updateInvoice } from '@/lib/api/invoice'
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

const getTodayInputDate = () => {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']
const formatInvoiceDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const d = new Date(`${dateStr}T00:00:00`)
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTH_NAMES[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

const calculateDueDate = (dateStr: string, daysToAdd = 30) => {
  if (!dateStr) return '-'
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + daysToAdd)
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTH_NAMES[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

const getTtbNoPo = (noQuo: unknown) => {
  if (typeof window === 'undefined' || !String(noQuo ?? '').trim()) return ''

  try {
    const drafts = JSON.parse(
      window.localStorage.getItem('ttb-drafts') || '{}'
    ) as Record<string, { noPo?: string }>
    return drafts[String(noQuo).trim()]?.noPo ?? ''
  } catch {
    return ''
  }
}

type InvoiceRow = {
  id: number
  itemKey: string
  quotationQty: number
  remainingQty: number
  pn: string
  description: string
  note: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
}

export function InvoicePage() {
  const [noQuoInput, setNoQuoInput] = useState('')
  const [noPo, setNoPo] = useState('')
  const [location, setLocation] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(getTodayInputDate)
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
  const [paymentTerm, setPaymentTerm] = useState('')
  const [pdfPageCount, setPdfPageCount] = useState(1)
  const invoiceContentRef = useRef<HTMLDivElement>(null)

  const handleDownloadPdf = async () => {
    if (!invoiceContentRef.current) return
    try {
      const clone = invoiceContentRef.current.cloneNode(true) as HTMLElement
      clone.style.cssText =
        'position:fixed;top:0;left:0;width:794px;z-index:-9999;background:#ffffff;padding:16px;border:none;outline:none;box-shadow:none;'
      // Remove any yellow outline/border from all child elements
      clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
        el.style.outline = 'none'
        el.style.boxShadow = 'none'
      })
      clone.querySelectorAll<HTMLElement>('[data-pdf-hide]').forEach((el) => {
        el.style.display = 'none'
      })
      // Show pdf-show spans (qty value, tanggal, location plain text)
      clone.querySelectorAll<HTMLElement>('.pdf-show').forEach((el) => {
        el.style.display = 'inline'
        el.style.border = 'none'
        el.style.outline = 'none'
        el.style.boxShadow = 'none'
        el.style.background = 'transparent'
        el.style.padding = '0'
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
      // Calculate actual page count from canvas dimensions
      const pageContentHeight = pageHeight - margin * 2
      const totalPages = Math.max(1, Math.ceil(imgHeightMm / pageContentHeight))
      void totalPages // page count calculated but displayed via estimatedPageCount

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

      const noQuo = String(loadedInvoice?.formInfo?.noQuo ?? loadedInvoice?.noQuo ?? '').trim()
      pdf.save(noQuo ? `Invoice-${noQuo}.pdf` : 'Invoice.pdf')
    } catch (err) {
      console.error('Download PDF error:', err)
      alert(`Gagal membuat PDF: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const [showOriginalQuotation, setShowOriginalQuotation] = useState(false)
  const [selectedSavedInvoiceId, setSelectedSavedInvoiceId] = useState<
    number | null
  >(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null)

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

  useEffect(() => {
    if (!invoiceContentRef.current) return
    let timeoutId: ReturnType<typeof setTimeout>
    const calculatePageCount = () => {
      const el = invoiceContentRef.current
      if (!el) return
      
      const clone = el.cloneNode(true) as HTMLElement
      clone.style.cssText =
        'position:fixed;top:0;left:0;width:794px;z-index:-9999;background:#ffffff;padding:16px;border:none;outline:none;box-shadow:none;visibility:hidden;'
      
      clone.querySelectorAll<HTMLElement>('[data-pdf-hide]').forEach((node) => {
        node.style.display = 'none'
      })
      clone.querySelectorAll<HTMLElement>('.pdf-show').forEach((node) => {
        node.style.display = 'inline'
        node.style.border = 'none'
        node.style.outline = 'none'
        node.style.boxShadow = 'none'
        node.style.background = 'transparent'
        node.style.padding = '0'
      })

      document.body.appendChild(clone)
      
      const contentWidthMm = 194
      const contentHeightMm = 281
      const scrollHeight = clone.scrollHeight
      const scrollWidth = clone.scrollWidth || 794
      const imgHeightMm = (scrollHeight * contentWidthMm) / scrollWidth
      const pages = Math.max(1, Math.ceil(imgHeightMm / contentHeightMm))
      
      setPdfPageCount(pages)
      document.body.removeChild(clone)
    }

    timeoutId = setTimeout(calculatePageCount, 300)
    return () => clearTimeout(timeoutId)
  }, [loadedInvoice, showOriginalQuotation, selectedQuantities, selectedSavedInvoiceId, location, invoiceDate, noPo])


  const activeQuotationNumbers = new Set(
    quotationList.map((quotation) => quotation.noQuo)
  )
  const printableInvoices = invoices.filter((invoice) =>
    activeQuotationNumbers.has(
      String(invoice.formInfo?.noQuo ?? invoice.noQuo ?? '')
    )
  )

  const handleLoadQuotation = async (selectedNoQuo = noQuoInput) => {
    const noQuo = selectedNoQuo.trim()

    if (!noQuo) {
      alert('No. Quo wajib diisi terlebih dahulu')
      return
    }

    setLoading(true)

    try {
      const data = await getEstimasiByNoQuo(noQuo)
      const normalizedNoQuo = String(data.formInfo?.noQuo ?? noQuo).trim()
      const invoiceToEdit = invoices.find(
        (invoice) =>
          String(invoice.formInfo?.noQuo ?? invoice.noQuo ?? '').trim() ===
          normalizedNoQuo
      )
      setSelectedSavedInvoiceId(null)
      setEditingInvoiceId(invoiceToEdit?.id ?? null)
      setLoadedInvoice(data)
      setSelectedQuantities(
        Object.fromEntries(
          (invoiceToEdit?.items ?? []).map((item: any, index: number) => [
            getItemKey(item, index),
            parseQuotationNumber(item?.qty),
          ])
        )
      )
      setNoPo(getTtbNoPo(data.formInfo?.noQuo ?? noQuo))
      setLocation(
        invoiceToEdit?.formInfo?.supplyLocation ||
          data.formInfo?.supplyLocation ||
          'PLTU Suralaya'
      )
      setInvoiceDate(
        invoiceToEdit?.formInfo?.invoiceDate ||
          data.formInfo?.invoiceDate ||
          getTodayInputDate()
      )
      setPaymentTerm(invoiceToEdit?.formInfo?.paymentTerm || '')
      setNoQuoInput(data.formInfo?.noQuo ?? noQuo)
    } catch (error) {
      setLoadedInvoice(null)
      setEditingInvoiceId(null)
      setLocation('')
      alert('Gagal menarik data quotation: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSavedInvoice = (invoiceId: string) => {
    const invoice = invoices.find((item) => item.id === Number(invoiceId))
    if (!invoice) {
      setSelectedSavedInvoiceId(null)
      setEditingInvoiceId(null)
      return
    }

    setEditingInvoiceId(null)
    setSelectedSavedInvoiceId(invoice.id)
    setLoadedInvoice(invoice)
    setSelectedQuantities(
      Object.fromEntries(
        (invoice.items ?? []).map((item: any, index: number) => [
          getItemKey(item, index),
          parseQuotationNumber(item?.qty),
        ])
      )
    )
    setNoQuoInput(invoice.formInfo?.noQuo ?? invoice.noQuo ?? '')
    setNoPo(getTtbNoPo(invoice.formInfo?.noQuo ?? invoice.noQuo))
    setLocation(invoice.formInfo?.supplyLocation || 'PLTU Suralaya')
    setInvoiceDate(
      invoice.formInfo?.invoiceDate ||
        invoice.formInfo?.tanggal ||
        getTodayInputDate()
    )
    setPaymentTerm(invoice.formInfo?.paymentTerm || '')
    setShowOriginalQuotation(false)
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
    .filter(
      (invoice) =>
        selectedSavedInvoiceId === null &&
        invoice.id !== editingInvoiceId &&
        invoice.noQuo === loadedInvoice?.formInfo?.noQuo
    )
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
        selectedSavedInvoiceId !== null
          ? quotationQty
          : quotationQty - (invoicedQuantities[itemKey] ?? 0),
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
        note: item?.note || '',
        unit: item?.unit || item?.satuan || '-',
        qty,
        unitPrice,
        amount,
      }
    }
  )

  const subtotal = invoiceRows.reduce((sum, row) => sum + row.amount, 0)
  const quotationDiscountAmount =
    loadedInvoice?.formInfo?.quotationDiscountAmount
  const discount = Number(
    loadedInvoice?.formInfo?.quotationDiscountPct ??
      loadedInvoice?.costs?.discountPct ??
      0
  )
  const discountAmount =
    quotationDiscountAmount !== undefined &&
    String(quotationDiscountAmount).trim() !== ''
      ? parseQuotationNumber(quotationDiscountAmount)
      : subtotal * (discount / 100)
  const totalAfterDiscount = subtotal - discountAmount
  const ppnPct = Number(loadedInvoice?.formInfo?.quotationPpnPct ?? 12)
  const previewRows = showOriginalQuotation
    ? invoiceRows.map((row) => ({
        ...row,
        qty: row.quotationQty,
        amount: row.quotationQty * row.unitPrice,
      }))
    : invoiceRows
  const previewSubtotal = previewRows.reduce((sum, row) => sum + row.amount, 0)
  const previewDiscountAmount =
    quotationDiscountAmount !== undefined &&
    String(quotationDiscountAmount).trim() !== ''
      ? parseQuotationNumber(quotationDiscountAmount)
      : previewSubtotal * (discount / 100)
  const previewTotalAfterDiscount = previewSubtotal - previewDiscountAmount
  const previewDpp = (11 / 12) * previewTotalAfterDiscount
  const previewPpn = previewDpp * (ppnPct / 100)
  const previewTotalInvoice = previewTotalAfterDiscount + previewPpn
  const estimatedPageCount = pdfPageCount
  const invoiceNo = loadedInvoice
    ? (() => {
        const noQuo = (loadedInvoice.formInfo?.noQuo || 'XXX').replace(
          /\s+/g,
          ''
        )
        const baseInv = noQuo.replace(/(-\d{4})$/, '-INV$1')
        return paymentTerm
          ? noQuo.replace(/(-\d{4})$/, `-${paymentTerm.toUpperCase()}-INV$1`)
          : baseInv
      })()
    : 'XXX-INV-2026'
  const customer = customers.find(
    (item) => item.pt === loadedInvoice?.formInfo?.pt
  )
  const savedInvoiceForReference = invoices
    .filter(
      (invoice) =>
        invoice.formInfo?.noRfs &&
        invoice.formInfo.noRfs === loadedInvoice?.formInfo?.noRfs
    )
    .sort((first, second) =>
      String(second.updatedAt).localeCompare(String(first.updatedAt))
    )[0]
  const savedTotalAfterDiscount =
    savedInvoiceForReference?.formInfo?.invoiceTotalAfterDiscount
  const invoicePreviewTotalAfterDiscount =
    savedTotalAfterDiscount !== undefined &&
    savedTotalAfterDiscount !== null &&
    String(savedTotalAfterDiscount).trim() !== ''
      ? parseQuotationNumber(savedTotalAfterDiscount)
      : totalAfterDiscount
  const invoicePreviewDiscountAmount =
    subtotal - invoicePreviewTotalAfterDiscount
  const invoicePreviewDpp = (11 / 12) * invoicePreviewTotalAfterDiscount
  const invoicePreviewPpn = invoicePreviewDpp * (ppnPct / 100)
  const invoicePreviewTotal = invoicePreviewTotalAfterDiscount + invoicePreviewPpn
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
      const targetNoQuo = loadedInvoice.formInfo?.noQuo ?? noQuoInput
      const existingInvoice = invoices.find(
        (invoice) => invoice.id === editingInvoiceId
      )

      const payload = {
        noQuo: targetNoQuo,
        judul: loadedInvoice.judul ?? 'Invoice',
        customerName: loadedInvoice.formInfo?.pt ?? '',
        amount: invoicePreviewTotal,
        status: existingInvoice?.status ?? 'belum_dibayar',
        formInfo: {
          ...(loadedInvoice.formInfo ?? {}),
          ...(existingInvoice?.formInfo ?? {}),
          noPo,
          invoiceDate,
          paymentTerm,
          invoiceNo: existingInvoice
            ? existingInvoice.formInfo?.invoiceNo || invoiceNo
            : invoiceNo,
          invoiceTotalAfterDiscount: invoicePreviewTotalAfterDiscount,
          quotationTotalAfterDiscount: previewTotalAfterDiscount,
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
      }

      const savedInvoice = existingInvoice
        ? await updateInvoice(existingInvoice.id, payload)
        : await createInvoice(payload)
      setEditingInvoiceId(savedInvoice.id)
      setSelectedQuantities(
        Object.fromEntries(
          payload.items.map((item) => [
            item.itemKey,
            parseQuotationNumber(item.qty),
          ])
        )
      )
      setLoadedInvoice((current) =>
        current
          ? {
              ...current,
              formInfo: {
                ...current.formInfo,
                ...savedInvoice.formInfo,
              },
            }
          : current
      )
      const refreshedInvoices = await getInvoices()
      setInvoices(refreshedInvoices)
      alert(
        existingInvoice
          ? 'Invoice berhasil diperbarui.'
          : 'Invoice berhasil disimpan.'
      )
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
                setSelectedSavedInvoiceId(null)
                setEditingInvoiceId(null)
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
            <select
              value={selectedSavedInvoiceId ?? ''}
              onChange={(event) => handleLoadSavedInvoice(event.target.value)}
              aria-label='Pilih invoice tersimpan untuk cetak ulang'
              className='h-10 w-full rounded-md border bg-background px-3 text-sm md:w-80'
            >
              <option value=''>Cetak ulang invoice tersimpan...</option>
              {printableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.formInfo?.noRfs || invoice.noQuo} -{' '}
                  {invoice.formInfo?.pt || invoice.customerName || '-'}
                </option>
              ))}
            </select>
            <Button
              variant='outline'
              size='sm'
              className='h-10 gap-1.5'
              onClick={() => {
                setNoQuoInput('')
                setLoadedInvoice(null)
                setSelectedSavedInvoiceId(null)
                setEditingInvoiceId(null)
                setSelectedQuantities({})
                setPaymentTerm('')
              }}
            >
              <RefreshCw className='h-4 w-4' />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadedInvoice ? (
        <div ref={invoiceContentRef} className='rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:border-0 print:p-0 print:shadow-none'>
          <div className='mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden' data-pdf-hide>
            <div className='flex items-center gap-4 text-sm font-medium'>
               <span className='text-slate-700'>Term Pembayaran:</span>
               <label className='flex items-center gap-1.5 cursor-pointer text-slate-700'>
                 <input type='radio' name='paymentTerm' value='' checked={paymentTerm === ''} onChange={() => setPaymentTerm('')} className='accent-blue-600 cursor-pointer' /> Full
               </label>
               <label className='flex items-center gap-1.5 cursor-pointer text-slate-700'>
                 <input type='radio' name='paymentTerm' value='1st' checked={paymentTerm === '1st'} onChange={() => setPaymentTerm('1st')} className='accent-blue-600 cursor-pointer' /> 1st
               </label>
               <label className='flex items-center gap-1.5 cursor-pointer text-slate-700'>
                 <input type='radio' name='paymentTerm' value='2nd' checked={paymentTerm === '2nd'} onChange={() => setPaymentTerm('2nd')} className='accent-blue-600 cursor-pointer' /> 2nd
               </label>
               <label className='flex items-center gap-1.5 cursor-pointer text-slate-700'>
                 <input type='radio' name='paymentTerm' value='3rd' checked={paymentTerm === '3rd'} onChange={() => setPaymentTerm('3rd')} className='accent-blue-600 cursor-pointer' /> 3rd
               </label>
            </div>
            <div className='flex justify-end gap-2'>
              {selectedSavedInvoiceId === null && (
                <Button
                  onClick={() => void handleSaveInvoice()}
                  disabled={saving}
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingInvoiceId !== null
                      ? 'Perbarui Invoice'
                      : 'Simpan Invoice'}
                </Button>
              )}
              <Button variant='outline' onClick={() => void handleDownloadPdf()} className='gap-1.5'>
                <Download className='h-4 w-4' />
                Download PDF
              </Button>
              <Button variant='outline' onClick={() => window.print()}>
                <Printer className='h-4 w-4' />
                Print
              </Button>
            </div>
          </div>
          <div className='mb-6 flex items-start justify-between gap-4'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
                <span className='text-[#21ae43] text-4xl md:text-5xl'>H</span>
                <span className='text-[#004d91]'>ALUAN </span>
                <span className='text-[#21ae43] text-4xl md:text-5xl'>D</span>
                <span className='text-[#004d91]'>AYA </span>
                <span className='text-[#21ae43] text-4xl md:text-5xl'>N</span>
                <span className='text-[#004d91]'>IAGA, PT.</span>
              </h1>
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
              {showOriginalQuotation ? 'QUOTATION' : 'INVOICE'}
            </h3>
          </div>

          <div className='relative mt-6 grid items-start gap-4 md:grid-cols-[1.4fr_0.9fr] print:relative'>
            <div className='space-y-2 text-sm'>
              <p>
                <span className='font-semibold'>
                  {loadedInvoice.formInfo?.pt || '-'}
                </span>
              </p>
              <p>Attn. {customer?.kontak || '-'}</p>
              <p>
                Reference : {loadedInvoice.formInfo?.noRfs || 'RFS-XXXX-XXX'}
              </p>
              <p> {loadedInvoice.formInfo?.kapal || '-'}</p>
              <p>Terms : 30 calendar days</p>
              <p>Due Date : {calculateDueDate(invoiceDate)}</p>
            </div>

            <div className='space-y-2 text-sm print:absolute print:top-0 print:right-0 print:w-[260px]'>
              <div className='grid grid-cols-[120px_1fr] gap-2'>
                <span className='font-semibold'>NO</span>
                <span>: {invoiceNo}</span>
                <span className='font-semibold'>NO. PO</span>
                <span className='flex items-center gap-1'>
                  :{' '}
                  <Input
                    value={noPo}
                    readOnly
                    placeholder='No. PO dari TTB'
                    className='inline-flex h-8 w-64 bg-muted print:hidden'
                    data-pdf-hide
                    aria-label='No. PO'
                  />
                  <span className='hidden print:inline pdf-show'>{noPo || '-'}</span>
                </span>
                <span className='font-semibold'>CUSTOMER ID</span>
                <span>: {customer?.id || '-'}</span>
                <span className='font-semibold'>TANGGAL</span>
                <span className='flex items-center gap-1'>
                  :{' '}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-8 gap-1.5 px-2 text-sm font-normal print:hidden'
                        data-pdf-hide
                        aria-label='Pilih tanggal invoice'
                      >
                        <CalendarIcon className='h-3.5 w-3.5 text-muted-foreground' />
                        {formatInvoiceDate(invoiceDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-0' align='start'>
                      <Calendar
                        mode='single'
                        selected={invoiceDate ? new Date(`${invoiceDate}T00:00:00`) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const y = date.getFullYear()
                            const m = String(date.getMonth() + 1).padStart(2, '0')
                            const dd = String(date.getDate()).padStart(2, '0')
                            setInvoiceDate(`${y}-${m}-${dd}`)
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <span className='hidden print:inline pdf-show'>
                    {formatInvoiceDate(invoiceDate)}
                  </span>
                </span>
                <span className='font-semibold'>PAGE</span>
                <span>: {estimatedPageCount}</span>
                <span className='font-semibold'>LOCATION</span>
                <span>
                  :{' '}
                  <Input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder='Masukkan lokasi'
                    className='inline-flex h-8 w-40 print:hidden'
                    data-pdf-hide
                    aria-label='Lokasi invoice'
                  />
                  <span className='hidden print:inline pdf-show'>{location || '-'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className='mt-6 overflow-hidden border border-slate-300'>
            <table className='w-full border-collapse text-left text-sm'>
              <thead className='bg-slate-200 text-slate-800'>
                <tr>
                  <th className='w-12 border border-slate-300 px-1 py-2 print:hidden' data-pdf-hide>
                    Pilih
                  </th>
                  <th className='w-10 border border-slate-300 px-1 py-2'>No</th>
                  <th className='whitespace-nowrap border border-slate-300 px-3 py-2'>Code</th>
                  <th className='min-w-64 border border-slate-300 px-3 py-2'>
                    Description
                  </th>
                  <th className='w-24 border border-slate-300 px-1 py-2 text-center'>
                    Quantity
                  </th>
                  <th className='w-20 border border-slate-300 px-1 py-2 text-center'>
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
                {previewRows.length > 0 ? (
                  previewRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`align-top ${row.qty === 0 ? 'print:hidden' : ''}`}
                    >
                      <td className='w-12 border border-slate-300 px-1 py-2 text-center print:hidden' data-pdf-hide>
                        <Checkbox
                          checked={showOriginalQuotation || row.qty > 0}
                          disabled={
                            showOriginalQuotation || row.remainingQty === 0
                          }
                          onCheckedChange={(checked) =>
                            handleItemToggle(row.itemKey, checked === true)
                          }
                          aria-label={`Pilih ${row.description}`}
                        />
                      </td>
                      <td className='w-10 border border-slate-300 px-1 py-2'>
                        {row.id}
                      </td>
                      <td className='whitespace-nowrap border border-slate-300 px-3 py-2'>
                        {row.pn}
                      </td>
                      <td className='min-w-64 border border-slate-300 px-3 py-2'>
                        <div>{row.description}</div>
                        {row.note && (
                          <div className='mt-0.5 text-xs italic text-red-500'>{row.note}</div>
                        )}
                      </td>
                      <td className='w-24 border border-slate-300 px-1 py-2 text-center'>
                        <Input
                          type='number'
                          min={0}
                          max={
                            showOriginalQuotation
                              ? row.quotationQty
                              : row.remainingQty
                          }
                          step='any'
                          value={row.qty}
                          readOnly={showOriginalQuotation}
                          onChange={(event) =>
                            handleQuantityChange(
                              row.itemKey,
                              event.target.value
                            )
                          }
                          className='mx-auto h-9 w-20 text-center'
                          data-pdf-hide
                          aria-label={`Qty ${row.description}`}
                        />
                        <span className='hidden pdf-show block w-full text-center font-medium'>
                          {row.qty}
                        </span>
                        <span data-pdf-hide className='mt-1 block text-xs text-slate-500'>
                          Sisa: {row.remainingQty} / {row.quotationQty}
                        </span>
                      </td>
                      <td className='w-20 border border-slate-300 px-1 py-2 text-center'>
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
                <span>
                  {formatCurrency(
                    showOriginalQuotation ? previewSubtotal : subtotal
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span>Discount :</span>
                <span>
                  {formatCurrency(
                    showOriginalQuotation
                      ? previewDiscountAmount
                      : invoicePreviewDiscountAmount
                  )}
                </span>
              </div>
              <div className='flex justify-between border-t border-slate-300 pt-2 font-semibold'>
                <span>Total after discount :</span>
                <span>
                  {formatCurrency(
                    showOriginalQuotation
                      ? previewTotalAfterDiscount
                      : invoicePreviewTotalAfterDiscount
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span>DPP :</span>
                <span>
                  {formatCurrency(
                    showOriginalQuotation ? previewDpp : invoicePreviewDpp
                  )}
                </span>
              </div>
              <div className='flex justify-between'>
                <span>PPN {ppnPct}% :</span>
                <span>
                  {formatCurrency(
                    showOriginalQuotation ? previewPpn : invoicePreviewPpn
                  )}
                </span>
              </div>
              <div className='mt-3 flex justify-between border border-slate-300 bg-slate-100 px-3 py-2 text-base font-bold'>
                <span>TOTAL INVOICE MUST BE PAID :</span>
                <span>
                  {formatCurrency(
                    showOriginalQuotation
                      ? previewTotalInvoice
                      : invoicePreviewTotal
                  )}
                </span>
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
