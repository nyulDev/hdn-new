import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Printer, RefreshCw, Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getLapBulanan, saveLapBulananNotes, type LapBulananRow } from '@/lib/api/lap-bulanan'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const formatNum = (v: number) =>
  Math.round(v).toLocaleString('id-ID')

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusValue = 'Progress' | 'Close'

interface DisplayRow extends LapBulananRow {
  no: number
  keteranganLocal: string
  statusLocal: StatusValue
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LapBulanan() {
  const today = new Date()
  const [bulan, setBulan] = useState<number>(today.getMonth() + 1)
  const [tahun, setTahun] = useState<number>(today.getFullYear())
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<DisplayRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keteranganMap, setKeteranganMap] = useState<Record<string, string>>({})
  const [statusMap, setStatusMap] = useState<Record<string, StatusValue>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = today.getFullYear() + 1; y >= 2020; y--) years.push(y)
    return years
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getLapBulanan({ bulan, tahun })
      setRows(
        data.map((r, i) => ({
          ...r,
          no: i + 1,
          // Prefer local edits, fall back to server-persisted value
          keteranganLocal: keteranganMap[r.noQuo] ?? r.keterangan ?? '',
          statusLocal: (statusMap[r.noQuo] ?? r.status ?? 'Progress') as StatusValue,
        }))
      )
      setIsDirty(false)
    } catch {
      setError('Gagal memuat data. Pastikan server berjalan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [bulan, tahun])

  const filteredRows = useMemo(() => {
    let result = [...rows]
    const s = search.toLowerCase().trim()
    if (s) {
      result = result.filter(
        (r) =>
          r.noInvoice.toLowerCase().includes(s) ||
          r.noPo.toLowerCase().includes(s) ||
          r.noQuo.toLowerCase().includes(s) ||
          r.namaKapal.toLowerCase().includes(s)
      )
    }

    if (sortOrder) {
      result.sort((a, b) => {
        const idA = a.invoiceId ?? 0
        const idB = b.invoiceId ?? 0
        return sortOrder === 'asc' ? idA - idB : idB - idA
      })
    }

    return result.map((r, i) => ({ ...r, no: i + 1 }))
  }, [rows, search, sortOrder])

  const mainRows = useMemo(() => filteredRows.filter(r => !r.isCarryOver).map((r, i) => ({ ...r, no: i + 1 })), [filteredRows])
  const carryOverRows = useMemo(() => filteredRows.filter(r => r.isCarryOver).map((r, i) => ({ ...r, no: i + 1 })), [filteredRows])

  const totals = useMemo(
    () =>
      mainRows.reduce(
        (acc, r) => ({
          kasbon: acc.kasbon + r.kasbon,
          aktual: acc.aktual + r.aktual,
          selisih: acc.selisih + r.selisih,
        }),
        { kasbon: 0, aktual: 0, selisih: 0 }
      ),
    [mainRows]
  )

  const carryOverTotals = useMemo(
    () =>
      carryOverRows.reduce(
        (acc, r) => ({
          kasbon: acc.kasbon + r.kasbon,
          aktual: acc.aktual + r.aktual,
          selisih: acc.selisih + r.selisih,
        }),
        { kasbon: 0, aktual: 0, selisih: 0 }
      ),
    [carryOverRows]
  )

  const handleKeteranganChange = (noQuo: string, value: string) => {
    setKeteranganMap((prev) => ({ ...prev, [noQuo]: value }))
    setRows((prev) =>
      prev.map((r) =>
        r.noQuo === noQuo ? { ...r, keteranganLocal: value } : r
      )
    )
    setIsDirty(true)
  }

  const handleStatusChange = (noQuo: string, value: StatusValue) => {
    setStatusMap((prev) => ({ ...prev, [noQuo]: value }))
    setRows((prev) =>
      prev.map((r) =>
        r.noQuo === noQuo ? { ...r, statusLocal: value } : r
      )
    )
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      const notes = rows.map((r) => ({
        noQuo: r.noQuo,
        keterangan: r.keteranganLocal,
        status: r.statusLocal,
      }))
      await saveLapBulananNotes(notes)
      setIsDirty(false)
      toast.success('Data berhasil disimpan')
    } catch {
      toast.error('Gagal menyimpan data. Coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const header = ['NO', 'NO. INVOICE', 'PO', 'KASBON', 'AKTUAL', 'SELISIH (Lebih/Kurang)', 'KETERANGAN', 'STATUS']
    const body = filteredRows.map((r) => [
      r.no,
      r.noInvoice,
      r.noPo,
      r.kasbon,
      r.aktual,
      r.selisih,
      r.keteranganLocal,
      r.statusLocal,
    ])
    const totalRow = ['TOTAL', '', '', totals.kasbon, totals.aktual, totals.selisih, '', '']
    const csv = [header, ...body, totalRow]
      .map((row) => row.map((c) => `"${c}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Lap_Bulanan_${MONTHS_ID[bulan - 1]}_${tahun}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* ── Print Styles ───────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #lap-bulanan-print, #lap-bulanan-print * { visibility: visible !important; }
          #lap-bulanan-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          table { border-collapse: collapse; width: 100%; font-size: 10pt; }
          th, td { border: 1px solid #000; padding: 3px 6px; }
          .th-header { background: #ffff00 !important; -webkit-print-color-adjust: exact; }
          .td-negative { color: red !important; }
        }
      `}</style>

      <Header>
        <div className='ml-auto flex items-center gap-2 no-print'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        {/* ── Toolbar ───────────────────────────────────────────── */}
        <div className='mb-4 flex flex-wrap items-center gap-3 no-print'>
          <h1 className='text-xl font-bold'>Laporan Bulanan Purchasing</h1>
          <div className='ml-auto flex flex-wrap items-center gap-2'>
            {/* Month selector */}
            <select
              id='lapbulanan-bulan'
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className='h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
            >
              {MONTHS_ID.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            {/* Year selector */}
            <select
              id='lapbulanan-tahun'
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className='h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring'
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Search */}
            <div className='relative'>
              <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                id='lapbulanan-search'
                placeholder='Cari invoice / PO / kapal...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='h-9 w-52 pl-8'
              />
            </div>

            <Button
              id='lapbulanan-refresh'
              variant='outline'
              size='sm'
              onClick={() => fetchData()}
              disabled={loading}
              title='Refresh data'
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              id='lapbulanan-save'
              variant={isDirty ? 'default' : 'outline'}
              size='sm'
              onClick={handleSave}
              disabled={isSaving || rows.length === 0}
              title='Simpan keterangan & status'
            >
              <Save className={`h-4 w-4 ${isSaving ? 'animate-pulse' : ''}`} />
              <span className='ml-1.5'>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
            </Button>

            <Button
              id='lapbulanan-export-csv'
              variant='outline'
              size='sm'
              onClick={handleExportCSV}
              title='Export CSV'
            >
              <Download className='h-4 w-4' />
              <span className='ml-1.5'>Export</span>
            </Button>

            <Button
              id='lapbulanan-print'
              variant='outline'
              size='sm'
              onClick={handlePrint}
              title='Cetak'
            >
              <Printer className='h-4 w-4' />
              <span className='ml-1.5'>Cetak</span>
            </Button>
          </div>
        </div>

        {/* ── Print Area ─────────────────────────────────────────── */}
        <div id='lap-bulanan-print' ref={printRef}>
          {/* Print Header */}
          <div className='mb-3 text-center hidden print:block'>
            <div className='text-lg font-bold uppercase'>
              LAPORAN BULANAN PURCHASING
            </div>
            <div className='text-sm'>
              Periode: {MONTHS_ID[bulan - 1]} {tahun}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className='mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 no-print'>
              {error}
            </div>
          )}

          {/* Tables */}
          {(() => {
            const renderTable = (
              title: string | null,
              tableRows: DisplayRow[],
              tableTotals: { kasbon: number; aktual: number; selisih: number }
            ) => (
              <div className='overflow-x-auto rounded-md border mb-6'>
                {title && (
                  <div className='bg-muted/50 px-4 py-2 font-bold uppercase text-sm border-b'>
                    {title}
                  </div>
                )}
                <table className='w-full border-collapse text-sm'>
                  <thead>
                    <tr>
                      {[
                        { label: 'NO', cls: 'w-10 text-center' },
                        { label: 'NO. INVOICE', cls: 'min-w-[140px]' },
                        { label: 'PO', cls: 'min-w-[100px]' },
                        { label: 'KASBON', cls: 'min-w-[130px] text-right' },
                        { label: 'AKTUAL', cls: 'min-w-[130px] text-right' },
                        { label: 'SELISIH (Lebih/Kurang)', cls: 'min-w-[150px] text-right' },
                        { label: 'KETERANGAN', cls: 'min-w-[180px]' },
                        { label: 'STATUS', cls: 'min-w-[110px] text-center' },
                      ].map(({ label, cls }) => (
                        <th
                          key={label}
                          className={`th-header border border-border bg-yellow-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-900 dark:bg-yellow-500 dark:text-gray-900 ${cls} ${label === 'NO. INVOICE' ? 'cursor-pointer hover:bg-yellow-400 select-none' : ''}`}
                          onClick={() => {
                            if (label === 'NO. INVOICE') {
                              setSortOrder((prev) => prev === null ? 'desc' : prev === 'desc' ? 'asc' : null)
                            }
                          }}
                        >
                          <div className={`flex items-center ${label === 'NO. INVOICE' ? 'gap-1' : ''}`}>
                            {label}
                            {label === 'NO. INVOICE' && (
                              <span className='inline-flex items-center'>
                                {sortOrder === 'asc' ? <ArrowUp className='h-3 w-3' /> : sortOrder === 'desc' ? <ArrowDown className='h-3 w-3' /> : <ArrowUpDown className='h-3 w-3 opacity-30' />}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className='py-8 text-center text-muted-foreground'>
                          Memuat data...
                        </td>
                      </tr>
                    ) : tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className='py-8 text-center text-muted-foreground'>
                          {error ? 'Terjadi kesalahan saat memuat data.' : 'Tidak ada data untuk periode ini.'}
                        </td>
                      </tr>
                    ) : (
                      tableRows.map((row, idx) => {
                        const isNeg = row.selisih < 0
                        return (
                          <tr
                            key={row.noQuo}
                            className={`border-b border-border transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
                          >
                            <td className='border border-border px-3 py-1.5 text-center text-xs'>
                              {row.no}
                            </td>
                            <td className='border border-border px-3 py-1.5 text-xs font-medium'>
                              {row.noInvoice}
                            </td>
                            <td className='border border-border px-3 py-1.5 text-xs'>
                              {row.noPo || '-'}
                            </td>
                            <td className='border border-border px-3 py-1.5 text-right text-xs tabular-nums'>
                              {row.kasbon > 0 ? formatNum(row.kasbon) : ''}
                            </td>
                            <td className='border border-border px-3 py-1.5 text-right text-xs tabular-nums'>
                              {row.aktual > 0 ? formatNum(row.aktual) : ''}
                            </td>
                            <td
                              className={`border border-border px-3 py-1.5 text-right text-xs tabular-nums font-medium ${isNeg ? 'text-red-600 td-negative' : row.selisih > 0 ? 'text-green-700' : ''}`}
                            >
                              {row.selisih !== 0 ? formatNum(row.selisih) : '0'}
                            </td>
                            <td className='border border-border px-1.5 py-0.5 text-xs no-print'>
                              <input
                                id={`keterangan-${row.noQuo}`}
                                type='text'
                                value={row.keteranganLocal}
                                onChange={(e) =>
                                  handleKeteranganChange(row.noQuo, e.target.value)
                                }
                                placeholder='Keterangan...'
                                className='w-full rounded border-0 bg-transparent px-1.5 py-1 text-xs outline-none focus:bg-muted/20 focus:ring-1 focus:ring-ring'
                              />
                            </td>
                            {/* Print-only keterangan cell */}
                            <td className='border border-border px-3 py-1.5 text-xs hidden print:table-cell'>
                              {row.keteranganLocal}
                            </td>
                            {/* Status cell — screen */}
                            <td className='border border-border px-1.5 py-0.5 text-center text-xs no-print'>
                              <select
                                id={`status-${row.noQuo}`}
                                value={row.statusLocal}
                                onChange={(e) =>
                                  handleStatusChange(row.noQuo, e.target.value as StatusValue)
                                }
                                className={`w-full cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-ring ${
                                  row.statusLocal === 'Progress'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                }`}
                              >
                                <option value='Progress'>Progress</option>
                                <option value='Close'>Close</option>
                              </select>
                            </td>
                            {/* Print-only status cell */}
                            <td className='border border-border px-3 py-1.5 text-center text-xs hidden print:table-cell'>
                              {row.statusLocal}
                            </td>
                          </tr>
                        )
                      })
                    )}

                    {/* Empty rows to fill up to ~5 rows minimum */}
                    {!loading && tableRows.length > 0 && tableRows.length < 5 &&
                      Array.from({ length: 5 - tableRows.length }).map((_, i) => (
                        <tr key={`empty-${i}`} className='border-b border-border'>
                          {Array.from({ length: 8 }).map((__, j) => (
                            <td key={j} className='border border-border px-3 py-1.5'>&nbsp;</td>
                          ))}
                        </tr>
                      ))
                    }
                  </tbody>

                  {/* TOTAL row */}
                  <tfoot>
                    <tr className='bg-yellow-100 dark:bg-yellow-900/30 font-bold'>
                      <td
                        colSpan={3}
                        className='th-header border border-border bg-yellow-200 px-3 py-2 text-center text-xs font-bold uppercase dark:bg-yellow-800/50'
                      >
                        T O T A L
                      </td>
                      <td className='border border-border px-3 py-2 text-right text-xs tabular-nums'>
                        {formatNum(tableTotals.kasbon)}
                      </td>
                      <td className='border border-border px-3 py-2 text-right text-xs tabular-nums'>
                        {formatNum(tableTotals.aktual)}
                      </td>
                      <td
                        className={`border border-border px-3 py-2 text-right text-xs tabular-nums ${tableTotals.selisih < 0 ? 'text-red-600' : tableTotals.selisih > 0 ? 'text-green-700' : ''}`}
                      >
                        {formatNum(tableTotals.selisih)}
                      </td>
                      {/* Keterangan + Status cells — screen */}
                      <td className='border border-border px-3 py-2 no-print' />
                      <td className='border border-border px-3 py-2 no-print' />
                      {/* Keterangan + Status — print */}
                      <td className='border border-border px-3 py-2 hidden print:table-cell' />
                      <td className='border border-border px-3 py-2 hidden print:table-cell' />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )

            return (
              <>
                {renderTable(null, mainRows, totals)}
                {carryOverRows.length > 0 && renderTable('Invoice Bulan Sebelumnya (Carry Over)', carryOverRows, carryOverTotals)}
              </>
            )
          })()}

          {/* Summary below table */}
          <div className='mt-4 flex flex-wrap gap-6 text-sm no-print'>
            <div className='rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 dark:border-yellow-700 dark:bg-yellow-900/20'>
              <span className='text-muted-foreground'>Total KASBON: </span>
              <span className='font-semibold'>{formatNum(totals.kasbon)}</span>
            </div>
            <div className='rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 dark:border-blue-700 dark:bg-blue-900/20'>
              <span className='text-muted-foreground'>Total AKTUAL: </span>
              <span className='font-semibold'>{formatNum(totals.aktual)}</span>
            </div>
            <div
              className={`rounded-lg border px-4 py-2 ${totals.selisih < 0 ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'}`}
            >
              <span className='text-muted-foreground'>Total Selisih: </span>
              <span className={`font-semibold ${totals.selisih < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {totals.selisih < 0 ? '' : '+'}{formatNum(totals.selisih)}
              </span>
            </div>
            <div className='rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/30'>
              <span className='text-muted-foreground'>Jumlah transaksi: </span>
              <span className='font-semibold'>{filteredRows.length}</span>
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
