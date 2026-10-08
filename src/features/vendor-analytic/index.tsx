import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  CheckCircle2,
  Building2,
  Save,
  History,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas-pro'

type VendorPrice = { usd: string; idr: string }
type Item = {
  id: string
  pn: string
  description: string
  qty: string
  unit: string
  vendorPrices: [VendorPrice, VendorPrice, VendorPrice]
  selectedVendor: 0 | 1 | 2 | null
}
type VendorInfo = { name: string }

const MAX_VENDORS = 3
const VC = [
  { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400' },
  { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', badge: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-400' },
]

let _id = 1
const newId = () => String(_id++)
const emptyVP = (): VendorPrice => ({ usd: '', idr: '' })
const emptyItem = (): Item => ({
  id: newId(), pn: '', description: '', qty: '', unit: 'PC',
  vendorPrices: [emptyVP(), emptyVP(), emptyVP()],
  selectedVendor: null,
})
const parseNum = (v: string) => { const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0 }
const fmtIDR = (v: number) => v === 0 ? '-' : `Rp ${Math.round(v).toLocaleString('id-ID')}`
const calcAmount = (item: Item, vi: number, rate: number) => {
  const vp = item.vendorPrices[vi], qty = parseNum(item.qty)
  const usd = parseNum(vp.usd), idr = parseNum(vp.idr)
  if (usd > 0) return qty * usd * rate
  if (idr > 0) return qty * idr
  return 0
}

function VBadge({ idx, name }: { idx: number; name: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${VC[idx].badge}`}>
      <Building2 className='h-3 w-3' />{name || `Vendor ${idx + 1}`}
    </span>
  )
}

export function VendorAnalytic() {
  const [projectName, setProjectName] = useState('')
  const [usdRate, setUsdRate] = useState('17500')
  const [vendorCount, setVendorCount] = useState(2)
  const [vendors, setVendors] = useState<VendorInfo[]>([{ name: 'Vendor 1' }, { name: 'Vendor 2' }, { name: 'Vendor 3' }])
  const [items, setItems] = useState<Item[]>([emptyItem()])
  const [collapsed, setCollapsed] = useState([false, false, false])
  const [history, setHistory] = useState<any[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const rate = parseNum(usdRate) || 17500

  useEffect(() => {
    const saved = localStorage.getItem('vendorAnalyticHistory')
    if (saved) {
      try { setHistory(JSON.parse(saved)) } catch (e) {}
    }
  }, [])

  const handleSave = () => {
    const docId = currentId || String(Date.now())
    const doc = {
      id: docId,
      date: new Date().toISOString(),
      projectName,
      usdRate,
      vendorCount,
      vendors,
      items
    }
    const newHistory = currentId ? history.map(h => h.id === currentId ? doc : h) : [doc, ...history]
    setHistory(newHistory)
    localStorage.setItem('vendorAnalyticHistory', JSON.stringify(newHistory))
    setCurrentId(docId)
    alert('Data Vendor Analytic berhasil disimpan!')
  }

  const loadDoc = (doc: any) => {
    setCurrentId(doc.id)
    setProjectName(doc.projectName)
    setUsdRate(doc.usdRate)
    setVendorCount(doc.vendorCount)
    setVendors(doc.vendors)
    setItems(doc.items)
    setIsHistoryOpen(false)
  }

  const deleteDoc = (id: string) => {
    const newHistory = history.filter(h => h.id !== id)
    setHistory(newHistory)
    localStorage.setItem('vendorAnalyticHistory', JSON.stringify(newHistory))
    if (currentId === id) setCurrentId(null)
  }

  const handleReset = () => {
    setItems([emptyItem()])
    setProjectName('')
    setCurrentId(null)
  }

  const updVendor = (i: number, name: string) =>
    setVendors(prev => { const n = [...prev]; n[i] = { name }; return n })

  const toggleCollapse = (i: number) =>
    setCollapsed(prev => { const n = [...prev]; n[i] = !n[i]; return n })

  const addItem = () => setItems(p => [...p, emptyItem()])
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id))

  const updateItem = useCallback((id: string, field: keyof Omit<Item, 'vendorPrices' | 'selectedVendor' | 'id'>, val: string) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: val } : i)), [])

  const updateVP = useCallback((id: string, vi: number, field: keyof VendorPrice, val: string) =>
    setItems(p => p.map(item => {
      if (item.id !== id) return item
      const vp = [...item.vendorPrices] as Item['vendorPrices']
      vp[vi] = { ...vp[vi], [field]: val }
      return { ...item, vendorPrices: vp }
    })), [])

  const selectVendor = (id: string, vi: 0 | 1 | 2) =>
    setItems(p => p.map(item => item.id === id ? { ...item, selectedVendor: item.selectedVendor === vi ? null : vi } : item))

  const totals = useMemo(() => {
    const r = [0, 0, 0]
    for (const item of items) for (let v = 0; v < MAX_VENDORS; v++) r[v] += calcAmount(item, v, rate)
    return r
  }, [items, rate])

  const selectedTotal = useMemo(() =>
    items.reduce((s, i) => i.selectedVendor === null ? s : s + calcAmount(i, i.selectedVendor, rate), 0), [items, rate])

  const selectedCount = items.filter(i => i.selectedVendor !== null).length

  const handlePdf = async () => {
    if (!tableRef.current) return
    try {
      const clone = tableRef.current.cloneNode(true) as HTMLElement
      clone.style.cssText = 'position:fixed;top:0;left:0;width:1100px;z-index:-9999;background:#fff;padding:20px;'
      document.body.appendChild(clone)
      const canvas = await html2canvas(clone, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' })
      document.body.removeChild(clone)
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 6, cw = pw - m * 2
      const ih = (canvas.height * cw) / canvas.width
      if (ih <= ph - m * 2) {
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', m, m, cw, ih)
      } else {
        const ph2 = ph - m * 2, pagePx = Math.floor((ph2 / cw) * canvas.width)
        let yPx = 0
        while (yPx < canvas.height) {
          if (yPx > 0) pdf.addPage()
          const sc = document.createElement('canvas'); sc.width = canvas.width; sc.height = Math.min(pagePx, canvas.height - yPx)
          sc.getContext('2d')!.drawImage(canvas, 0, yPx, sc.width, sc.height, 0, 0, sc.width, sc.height)
          pdf.addImage(sc.toDataURL('image/jpeg', 0.95), 'JPEG', m, m, cw, (sc.height * cw) / canvas.width)
          yPx += pagePx
        }
      }
      pdf.save(`VendorAnalytic-${projectName || 'report'}.pdf`)
    } catch (e) { alert('Gagal export PDF: ' + String(e)) }
  }

  return (
    <>
      <Header><ThemeSwitch /><ProfileDropdown /></Header>
      <Main fluid className='px-2 py-6 sm:px-4'>

        {/* Header */}
        <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Vendor Analytic</h1>
            <p className='mt-0.5 text-sm text-muted-foreground'>Bandingkan harga dari hingga 3 vendor dan pilih vendor terbaik per item</p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={() => setIsHistoryOpen(true)} className='gap-1.5'>
              <History className='h-4 w-4' />Riwayat
            </Button>
            <Button variant='outline' size='sm' onClick={handleReset} className='gap-1.5'>
              <RotateCcw className='h-4 w-4' />Reset
            </Button>
            <Button variant='secondary' size='sm' onClick={() => void handlePdf()} className='gap-1.5'>
              <Download className='h-4 w-4' />Export PDF
            </Button>
            <Button size='sm' onClick={handleSave} className='gap-1.5 bg-blue-600 hover:bg-blue-700 text-white'>
              <Save className='h-4 w-4' />Simpan
            </Button>
          </div>
        </div>

        {/* Settings */}
        <div className='mb-6 flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4 shadow-sm'>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Nama Project / RFS</label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder='Input No. RFS' className='h-9 w-64 text-sm' />
          </div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Kurs USD → IDR</label>
            <Input value={usdRate} onChange={e => setUsdRate(e.target.value)} className='h-9 w-36 text-sm' placeholder='17500' />
          </div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Jumlah Vendor</label>
            <div className='flex gap-1'>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setVendorCount(n)}
                  className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${vendorCount === n ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {Array.from({ length: vendorCount }, (_, i) => (
            <div key={i} className='flex flex-col gap-1'>
              <label className='text-xs font-medium text-muted-foreground'><VBadge idx={i} name={vendors[i].name} /></label>
              <Input value={vendors[i].name} onChange={e => updVendor(i, e.target.value)} placeholder={`Nama vendor ${i + 1}`} className='h-9 w-44 text-sm' />
            </div>
          ))}
        </div>

        {/* Summary cards */}
        <div className='mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: vendorCount }, (_, i) => (
            <div key={i} className={`rounded-xl border p-4 ${VC[i].bg} ${VC[i].border}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${VC[i].text}`}>{vendors[i].name} — Total</p>
              <p className='mt-1.5 text-xl font-bold'>{fmtIDR(totals[i])}</p>
            </div>
          ))}
          <div className='rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30'>
            <p className='text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300'>Total Dipilih ({selectedCount} item)</p>
            <p className='mt-1.5 text-xl font-bold'>{fmtIDR(selectedTotal)}</p>
          </div>
        </div>

        {/* Table */}
        <div ref={tableRef} className='rounded-xl border bg-background shadow-sm'>
          {projectName && (
            <div className='border-b px-4 py-3'>
              <p className='text-sm font-semibold'>{projectName}</p>
              <p className='text-xs text-muted-foreground'>1 USD = Rp {parseNum(usdRate).toLocaleString('id-ID')}</p>
            </div>
          )}
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-sm whitespace-nowrap min-w-max'>
              <thead>
                <tr className='border-b bg-muted/40 text-left'>
                  <th className='w-8 px-2 py-3 text-center text-xs'>No</th>
                  <th className='w-28 px-2 py-3 text-xs'>P/N</th>
                  <th className='min-w-52 px-2 py-3 text-xs'>Description</th>
                  <th className='w-16 px-2 py-3 text-center text-xs'>QTY</th>
                  <th className='w-20 px-2 py-3 text-center text-xs'>Unit</th>
                  {Array.from({ length: vendorCount }, (_, i) => (
                    <th key={i} colSpan={collapsed[i] ? 1 : 4} className={`px-3 py-3 ${VC[i].text}`}>
                      <div className='flex items-center justify-between gap-2'>
                        <VBadge idx={i} name={vendors[i].name} />
                        <button onClick={() => toggleCollapse(i)} className='rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10'>
                          {collapsed[i] ? <ChevronDown className='h-3.5 w-3.5' /> : <ChevronUp className='h-3.5 w-3.5' />}
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className='w-20 px-2 py-3 text-center text-xs'>Pilih</th>
                  <th className='px-2 py-3 text-right text-xs'>Harga Terpilih</th>
                  <th className='w-10 px-1 py-3' />
                </tr>
                <tr className='border-b bg-muted/20 text-xs text-muted-foreground'>
                  <th colSpan={5} />
                  {Array.from({ length: vendorCount }, (_, i) =>
                    collapsed[i]
                      ? <th key={i} className='px-2 py-1.5 text-center italic'>tersembunyi</th>
                      : [
                          <th key={`${i}tu`} className='px-2 py-1.5 text-right'>Total Qty (USD)</th>
                          , <th key={`${i}pu`} className='w-28 px-2 py-1.5 text-right'>PC (USD)</th>
                          , <th key={`${i}pi`} className='w-32 px-2 py-1.5 text-right'>PC (IDR)</th>
                          , <th key={`${i}ti`} className='px-2 py-1.5 text-right'>Total Qty (IDR)</th>
                        ]
                  )}
                  <th colSpan={3} />
                </tr>
              </thead>

              <tbody>
                {items.map((item, rowIdx) => {
                  const selAmt = item.selectedVendor !== null ? calcAmount(item, item.selectedVendor, rate) : null
                  return (
                    <tr key={item.id} className={`border-b transition-colors hover:bg-muted/10 ${item.selectedVendor !== null ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}>
                      <td className='px-2 py-2 text-center text-xs text-muted-foreground'>{rowIdx + 1}</td>
                      <td className='px-2 py-2'><Input value={item.pn} onChange={e => updateItem(item.id, 'pn', e.target.value)} placeholder='P/N' className='h-8 w-full text-xs' /></td>
                      <td className='px-2 py-2'><Input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder='Nama barang / deskripsi' className='h-8 w-full text-xs' /></td>
                      <td className='px-2 py-2'><Input type='number' min={0} value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} placeholder='0' className='h-8 w-full text-center text-xs' /></td>
                      <td className='px-2 py-2'><Input value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} placeholder='PC' className='h-8 w-full text-center text-xs' /></td>

                      {Array.from({ length: vendorCount }, (_, vi) => {
                        const vp = item.vendorPrices[vi], c = VC[vi]
                        const qty = parseNum(item.qty)
                        const usd = parseNum(vp.usd)
                        const isUsd = usd > 0
                        const idr = isUsd ? usd * rate : parseNum(vp.idr)
                        const totalUsd = qty * usd
                        const totalIdr = qty * idr
                        const amt = totalIdr // for total selected calculation

                        if (collapsed[vi]) return (
                          <td key={vi} className={`px-2 py-2 text-center text-xs ${c.bg} ${c.text}`}>{amt > 0 ? fmtIDR(amt) : '-'}</td>
                        )
                        return [
                          <td key={`${vi}tu`} className={`px-2 py-2 text-right text-xs font-medium ${c.bg} ${c.text}`}>{totalUsd > 0 ? `$ ${totalUsd.toLocaleString('en-US', {minimumFractionDigits: 2})}` : '-'}</td>,
                          <td key={`${vi}pu`} className={`px-2 py-2 ${c.bg}`}><Input type='number' min={0} value={vp.usd} onChange={e => updateVP(item.id, vi, 'usd', e.target.value)} placeholder='USD' className='h-8 w-full text-right text-xs' /></td>,
                          <td key={`${vi}pi`} className={`px-2 py-2 ${c.bg}`}>
                            {isUsd ? (
                              <span className={`block h-8 px-3 py-1.5 text-right text-xs font-medium ${c.text}`}>{fmtIDR(idr)}</span>
                            ) : (
                              <Input type='number' min={0} value={vp.idr} onChange={e => updateVP(item.id, vi, 'idr', e.target.value)} placeholder='IDR' className='h-8 w-full text-right text-xs' />
                            )}
                          </td>,
                          <td key={`${vi}ti`} className={`px-2 py-2 text-right text-xs font-medium ${c.bg} ${c.text}`}>{totalIdr > 0 ? fmtIDR(totalIdr) : '-'}</td>,
                        ]
                      })}

                      <td className='px-2 py-2'>
                        <div className='flex justify-center gap-1'>
                          {Array.from({ length: vendorCount }, (_, vi) => {
                            const isSel = item.selectedVendor === vi, c = VC[vi]
                            return (
                              <button key={vi} onClick={() => selectVendor(item.id, vi as 0 | 1 | 2)}
                                title={`Pilih ${vendors[vi].name}`}
                                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all ${isSel ? `${c.badge} border-transparent text-white ring-2 ${c.ring} ring-offset-1` : 'border-border bg-background hover:border-primary'}`}>
                                {vi + 1}
                              </button>
                            )
                          })}
                        </div>
                      </td>

                      <td className='px-2 py-2 text-right text-xs font-semibold'>
                        {selAmt !== null ? <span className='text-amber-700 dark:text-amber-300'>{fmtIDR(selAmt)}</span> : <span className='text-muted-foreground'>—</span>}
                      </td>

                      <td className='px-1 py-2'>
                        <button onClick={() => removeItem(item.id)} disabled={items.length === 1}
                          className='flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/30'>
                          <Trash2 className='h-3.5 w-3.5' />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              <tfoot>
                <tr className='border-t-2 bg-muted/30 text-sm font-bold'>
                  <td colSpan={5} className='px-2 py-3'>TOTAL</td>
                  {Array.from({ length: vendorCount }, (_, vi) => {
                    const c = VC[vi]
                    if (collapsed[vi]) return <td key={vi} className={`px-2 py-3 text-center ${c.text}`}>{fmtIDR(totals[vi])}</td>
                    return [
                      <td key={`${vi}p`} colSpan={3} className={`px-2 py-3 ${c.bg}`} />,
                      <td key={`${vi}a`} className={`px-2 py-3 text-right ${c.bg} ${c.text}`}>{fmtIDR(totals[vi])}</td>,
                    ]
                  })}
                  <td className='px-2 py-3 text-center text-xs text-muted-foreground'>{selectedCount}/{items.length}</td>
                  <td className='px-2 py-3 text-right text-amber-700 dark:text-amber-300'>{fmtIDR(selectedTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className='border-t p-3'>
            <Button variant='outline' size='sm' onClick={addItem} className='gap-1.5 text-xs'>
              <Plus className='h-3.5 w-3.5' />Tambah Item
            </Button>
          </div>
        </div>

        {/* Selection summary */}
        {selectedCount > 0 && (
          <div className='mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30'>
            <h2 className='mb-3 text-sm font-bold text-amber-800 dark:text-amber-200'>Ringkasan Seleksi ({selectedCount} item dipilih)</h2>
            <div className='space-y-1.5'>
              {items.filter(i => i.selectedVendor !== null).map(item => {
                const vi = item.selectedVendor!, amt = calcAmount(item, vi, rate), c = VC[vi]
                return (
                  <div key={item.id} className='flex items-center justify-between gap-4 rounded-lg border bg-white/70 px-3 py-2 text-sm dark:bg-black/20'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${c.text}`} />
                      <span className='truncate font-medium'>{item.pn ? `${item.pn} – ` : ''}{item.description || '(tanpa nama)'}</span>
                      <span className='shrink-0 text-muted-foreground'>× {item.qty || 0} {item.unit}</span>
                    </div>
                    <div className='flex shrink-0 items-center gap-3'>
                      <VBadge idx={vi} name={vendors[vi].name} />
                      <span className='font-semibold'>{fmtIDR(amt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className='mt-3 flex justify-end border-t border-amber-200 pt-3 dark:border-amber-700'>
              <span className='text-base font-bold text-amber-800 dark:text-amber-200'>Grand Total: {fmtIDR(selectedTotal)}</span>
            </div>
          </div>
        )}
      </Main>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Riwayat Vendor Analytic</DialogTitle>
            <DialogDescription>
              Daftar dokumen perbandingan vendor yang telah Anda simpan.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto pr-2">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data yang disimpan.</p>
            ) : (
              <div className="space-y-3">
                {history.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div>
                      <p className="font-semibold">{doc.projectName || '(Tanpa Nama Project)'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(doc.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} • {doc.items.length} item • {doc.vendorCount} vendor
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => loadDoc(doc)}>Buka</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteDoc(doc.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

