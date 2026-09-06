import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { Plus, Trash2, Printer, RefreshCw, Save, FileText } from 'lucide-react'
import { getCustomers, type Customer } from '@/lib/api/customers'
import {
  saveEstimasi,
  getEstimasiList,
  getEstimasiByNoQuo,
  updateEstimasi,
  updateEstimasiByNoQuo,
  deleteEstimasi,
  type EstimasiList,
} from '@/lib/api/estimasi'
import { getNetProfitEstimatePct } from '@/lib/profit'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  id: number
  no: number
  pn: string
  description: string
  note: string
  qty: string
  qtyActual?: string
  unit: string
  unitPrice: string
  amount: number
  unitPriceActual?: string
  amountActual?: number
  actualPriceVariants?: Array<{
    toko: string
    qtyActual: string
    price: string
  }>
  toko: string
  unitPriceQuo?: string
  amountQuo?: number
}

const QuotationModeContext = createContext(false)

interface FormInfo {
  tanggal: string
  pt: string
  kapal: string
  dept: string
  noQuo: string
  noRfs: string
  supplyLocation: string
  sktd: boolean
  revisi: string
}

interface CostConfig {
  discountPct: string
  qtyBankCharge: string
  bankChargeUsd: string
  qtyPackingCost: string
  packingCostUsd: string
  dutyTaxPct: string
  qtyAirDhl: string
  airDhlKgs: string
  qtyAirDoor: string
  airDoorKgs: string
  qtySeaResmi: string
  seaResmiCbm: string
  qtySeaDoor: string
  seaDoorCbm: string
  qtyLocalCost: string
  localCostUsd: string
  qtyFeeKurir: string
  feeKurir: string
  qtyTruk: string
  trukLs: string
  qtyServiceboat: string
  serviceboatLs: string
  qtyLainLain: string
  lainLainLs: string
  investorPct: string
  usdRate: string
  otherCosts: OtherCost[]
}

interface OtherCost {
  id: number
  description: string
  qty: string
  unit: string
  unitPrice: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number, decimals = 0) =>
  v === 0
    ? ''
    : v.toLocaleString('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })

const parseNum = (s: string) =>
  parseFloat(
    s.replace(/,/g, '').replace(/\./g, (m, o, str) => {
      // Jika titik diikuti tepat 3 digit dan tidak ada titik lain di belakang → thousand separator
      const rest = str.slice(o + 1)
      return /^\d{3}(\.|,|$)/.test(rest) ? '' : m
    })
  ) || 0

/** Format string angka dengan titik sebagai thousand separator pada bagian integer.
 *  Contoh: "1000" → "1.000" | "7850.080" → "7.850.080" | "0" → "0" */
const fmtInputDisplay = (s: string): string => {
  if (!s.trim()) return s
  const dotIdx = s.indexOf('.')
  const intStr = dotIdx >= 0 ? s.slice(0, dotIdx) : s
  const decStr = dotIdx >= 0 ? s.slice(dotIdx) : ''
  const intNum = parseInt(intStr.replace(/\./g, '').replace(/,/g, ''), 10)
  if (isNaN(intNum)) return s
  const intFormatted = intNum.toLocaleString('id-ID') // id-ID pakai titik untuk ribuan
  return intFormatted + decStr
}

// ─── Default data ─────────────────────────────────────────────────────────────

const defaultFormInfo: FormInfo = {
  tanggal: new Date().toISOString().slice(0, 10),
  pt: '',
  kapal: '',
  dept: '',
  noQuo: '',
  noRfs: '',
  supplyLocation: 'JAKARTA',
  sktd: false,
  revisi: '0',
}

const defaultQuotationDetails = {
  note: 'a. OEM Parts\nb. Weight est.: 35-37 kgs\nc. Price only for full order',
  delivery: '30-35 working days after confirmation order',
  price: 'Jakarta excl service boat and permit',
  payment: '30 calendar days after delivery',
  stockValidity: 'Not binding',
  priceValidity: '3 calendar days',
}

const defaultCosts: CostConfig = {
  discountPct: '-2',
  qtyBankCharge: '1',
  bankChargeUsd: '0',
  qtyPackingCost: '1',
  packingCostUsd: '17.200',
  dutyTaxPct: '25',
  qtyAirDhl: '',
  airDhlKgs: '0',
  qtyAirDoor: '',
  airDoorKgs: '220.000',
  qtySeaResmi: '',
  seaResmiCbm: '16000.000',
  qtySeaDoor: '',
  seaDoorCbm: '5500.000',
  qtyLocalCost: '',
  localCostUsd: '17.200',
  qtyFeeKurir: '1',
  feeKurir: '100.000',
  qtyTruk: '1',
  trukLs: '0',
  qtyServiceboat: '1',
  serviceboatLs: '0',
  qtyLainLain: '1',
  lainLainLs: '0',
  investorPct: '8',
  usdRate: '16000',
  otherCosts: [],
}

// ─── Cell component ───────────────────────────────────────────────────────────

function Cell({
  value,
  onChange,
  className = '',
  placeholder = '',
  readOnly = false,
  align = 'left',
  highlight = '',
  formatThousand = false,
}: {
  value: string
  onChange?: (v: string) => void
  className?: string
  placeholder?: string
  readOnly?: boolean
  align?: 'left' | 'right' | 'center'
  highlight?: string
  formatThousand?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)

  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left'

  const bgClass = highlight === 'yellow' ? 'bg-yellow-50' : ''

  // Tampil formatted (titik ribuan) saat tidak sedang diedit
  const displayValue =
    formatThousand && !isFocused ? fmtInputDisplay(value) : value

  if (readOnly) {
    return (
      <div
        className={`px-1.5 py-0.5 text-xs font-medium ${alignClass} ${bgClass} ${className}`}
      >
        {value}
      </div>
    )
  }

  return (
    <Input
      value={displayValue}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`h-6 rounded-none border-0 bg-transparent px-1.5 py-0 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-inset ${alignClass} ${bgClass} ${className}`}
    />
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModalEstimasi({
  quotationMode = false,
  actualMode = false,
  title,
}: {
  quotationMode?: boolean
  actualMode?: boolean
  title?: string
}) {
  const [formInfo, setFormInfo] = useState<FormInfo>(defaultFormInfo)
  const [items, setItems] = useState<LineItem[]>([])
  const [costs, setCosts] = useState<CostConfig>(defaultCosts)
  const [customers, setCustomers] = useState<Customer[]>([])

  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [savedList, setSavedList] = useState<EstimasiList[]>([])

  useEffect(() => {
    getCustomers()
      .then(setCustomers)
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load customers:', error)
      })
  }, [])

  useEffect(() => {
    getEstimasiList()
      .then((list) => {
        const uniqueByNoQuo = new Map(
          list
            .filter((estimasi) => estimasi.noQuo)
            .map((estimasi) => [estimasi.noQuo, estimasi])
        )
        setSavedList([...uniqueByNoQuo.values()])
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load quotation numbers:', error)
      })
  }, [quotationMode])
  const [loadingQuotation, setLoadingQuotation] = useState(false)
  // Nomor urut quotation (bagian pertama dari format No. Quo)
  const [noQuoNumber, setNoQuoNumber] = useState('')

  // Sync formInfo.noQuo setiap kali nomor urut, dept, atau revisi berubah
  useEffect(() => {
    if (!quotationMode) {
      const dept = formInfo.dept.trim().toUpperCase()
      const year = new Date().getFullYear()
      const revisiSegment =
        formInfo.revisi && formInfo.revisi !== '0' ? `-R${formInfo.revisi}` : ''
      const assembled = noQuoNumber
        ? `${noQuoNumber}${revisiSegment}-PH-${dept || 'HDN'}-${year}`
        : ''
      setFormInfo((prev) => ({ ...prev, noQuo: assembled }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noQuoNumber, formInfo.dept, formInfo.revisi, quotationMode])
  const [quotationRange, setQuotationRange] = useState('')
  const [estimasiPct, setEstimasiPct] = useState('')
  const [quotationDiscountPct, setQuotationDiscountPct] = useState('10')
  const [quotationPpnPct, setQuotationPpnPct] = useState('12')
  const [showQuotationTable, setShowQuotationTable] = useState(!quotationMode)
  const [quotationDetails, setQuotationDetails] = useState(
    defaultQuotationDetails
  )
  const pageTitle =
    title ??
    (quotationMode
      ? 'Quotation'
      : actualMode
        ? 'Modal Aktual'
        : 'Modal Estimasi')
  const [editingEstimasiId, setEditingEstimasiId] = useState<number | null>(
    null
  )

  const handleSave = async () => {
    const judul = formInfo.noQuo.trim() || 'Estimasi Baru'
    try {
      const status = actualMode
        ? 'modal_aktual'
        : quotationMode
          ? 'quotation'
          : 'modal_estimasi'
      const saveData = {
        judul: judul,
        formInfo: quotationMode
          ? {
              ...formInfo,
              quotationRange,
              estimasiPct,
              quotationDetails,
              quotationDiscountPct,
              quotationPpnPct,
            }
          : formInfo,
        items,
        costs,
        status,
      }
      const saved =
        quotationMode &&
        savedList.some((estimasi) => estimasi.noQuo === formInfo.noQuo)
          ? await updateEstimasiByNoQuo(formInfo.noQuo, saveData)
          : !quotationMode && editingEstimasiId !== null
            ? await updateEstimasi(editingEstimasiId, saveData)
            : await saveEstimasi(saveData)
      alert('Berhasil disimpan')
      setSavedList((current) => {
        const existing = current.some((estimasi) => estimasi.id === saved.id)
        return existing
          ? current.map((estimasi) =>
              estimasi.id === saved.id ? saved : estimasi
            )
          : [saved, ...current]
      })
      setEditingEstimasiId(null)
    } catch (e) {
      alert('Gagal menyimpan: ' + (e as Error).message)
    }
  }

  const handleLoadQuotation = async (selectedNoQuo = formInfo.noQuo) => {
    const noQuo = selectedNoQuo.trim()
    if (!noQuo) {
      alert('No. Quo wajib diisi')
      return
    }
    setLoadingQuotation(true)
    try {
      const data = await getEstimasiByNoQuo(noQuo)
      setEditingEstimasiId(data.id)
      const loadedFormInfo = {
        ...defaultFormInfo,
        ...(data.formInfo || {}),
        supplyLocation:
          data.formInfo?.supplyLocation || defaultFormInfo.supplyLocation,
      }
      setFormInfo(loadedFormInfo)
      if (loadedFormInfo.noQuo) {
        setNoQuoNumber(loadedFormInfo.noQuo.split('-')[0] || '')
      } else {
        setNoQuoNumber('')
      }
      setQuotationRange(String(loadedFormInfo.quotationRange ?? ''))
      setQuotationDiscountPct(
        String(loadedFormInfo.quotationDiscountPct ?? '10')
      )
      setQuotationPpnPct(String(loadedFormInfo.quotationPpnPct ?? '12'))
      setItems(data.items || [])
      setCosts({
        ...defaultCosts,
        ...(data.costs || {}),
        otherCosts: data.costs?.otherCosts ?? [],
      })
      // Persentase Estimasi (%) diambil dari Net Profit estimasi persentase
      // pada page Profit berdasarkan No. Quo
      setEstimasiPct(
        getNetProfitEstimatePct({
          formInfo: loadedFormInfo,
          items: data.items || [],
          costs: data.costs || defaultCosts,
        })
          .toFixed(2)
          .replace(/\.?0+$/, '')
      )
      alert('Data quotation berhasil ditarik')
    } catch (e) {
      alert('Gagal menarik data quotation: ' + (e as Error).message)
    } finally {
      setLoadingQuotation(false)
    }
  }

  const handleDeleteQuotation = async () => {
    if (!formInfo.noQuo.trim() || editingEstimasiId === null) {
      alert('Tidak ada data quotation yang sedang dimuat')
      return
    }

    try {
      await deleteEstimasi(editingEstimasiId)
      setSavedList((current) =>
        current.filter((estimasi) => estimasi.id !== editingEstimasiId)
      )
      setEditingEstimasiId(null)
      resetAll()
      alert('Data quotation berhasil dihapus')
    } catch (e) {
      alert('Gagal menghapus data quotation: ' + (e as Error).message)
    }
  }

  const getQuotationUnitPrice = (item: LineItem) => {
    if (item.unitPriceQuo?.trim()) return parseNum(item.unitPriceQuo)
    const range = parseNum(quotationRange)
    return range === 0 ? 0 : (parseNum(item.unitPrice) * range) / 100
  }

  const updateInfo = (field: keyof FormInfo, value: string | boolean) =>
    setFormInfo((prev) => ({ ...prev, [field]: value }))

  const customerCompanies = [
    ...new Set(customers.map((customer) => customer.pt)),
  ]
  const customerShips = customers.filter(
    (customer) => customer.pt === formInfo.pt
  )
  const handleCompanyChange = (pt: string) => {
    const matchingShips = customers.filter((customer) => customer.pt === pt)
    const kapal = matchingShips.some(
      (customer) => customer.namaKapal === formInfo.kapal
    )
      ? formInfo.kapal
      : ''
    setFormInfo((prev) => ({ ...prev, pt, kapal }))
  }

  // ── item mutations ──
  const updateItem = (id: number, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const updated = { ...it, [field]: value }

        const hasVariants = (updated.actualPriceVariants ?? []).length > 0
        const variantTotal = (updated.actualPriceVariants ?? []).reduce(
          (sum, variant) => {
            const variantQty =
              variant.qtyActual && variant.qtyActual.trim()
                ? variant.qtyActual
                : updated.qty
            return sum + parseNum(variantQty) * parseNum(variant.price)
          },
          0
        )
        const actualQty =
          updated.qtyActual && updated.qtyActual.trim()
            ? updated.qtyActual
            : updated.qty

        updated.amount = parseNum(updated.qty) * parseNum(updated.unitPrice)

        updated.amountActual =
          parseNum(actualQty) * parseNum(updated.unitPriceActual ?? '') +
          (hasVariants ? variantTotal : 0)

        updated.amountQuo =
          parseNum(updated.qty) * parseNum(updated.unitPriceQuo ?? '')
        return updated
      })
    )
  }

  const addItem = () => {
    const newId = Date.now()

    const newItem = {
      id: newId,
      no: items.length + 1,
      pn: '',
      description: '',
      note: '',
      qty: '',
      qtyActual: '',
      unit: 'PC',
      unitPrice: '',
      amount: 0,
      unitPriceActual: '',
      amountActual: 0,
      toko: '',
      unitPriceQuo: '',
      amountQuo: 0,
    }

    setItems((prev) => [...prev, newItem])
  }

  const addActualPriceVariant = (id: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        return {
          ...item,
          actualPriceVariants: [
            ...(item.actualPriceVariants ?? []),
            { toko: '', qtyActual: item.qtyActual ?? item.qty, price: '' },
          ],
        }
      })
    )
  }

  const updateActualPriceVariant = (
    id: number,
    variantIndex: number,
    field: 'toko' | 'qtyActual' | 'price',
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item

        const currentVariants = [...(item.actualPriceVariants ?? [])]
        const target = currentVariants[variantIndex] ?? {
          toko: '',
          qtyActual: item.qtyActual ?? item.qty,
          price: '',
        }
        currentVariants[variantIndex] = {
          ...target,
          [field]: value,
        }

        const actualQty =
          item.qtyActual && item.qtyActual.trim() ? item.qtyActual : item.qty
        const variantTotal = currentVariants.reduce((sum, variant) => {
          const variantQty =
            variant.qtyActual && variant.qtyActual.trim()
              ? variant.qtyActual
              : item.qty
          return sum + parseNum(variantQty) * parseNum(variant.price)
        }, 0)

        return {
          ...item,
          actualPriceVariants: currentVariants,
          amountActual:
            parseNum(actualQty) * parseNum(item.unitPriceActual ?? '') +
            variantTotal,
        }
      })
    )
  }

  const removeItem = (id: number) => {
    setItems((prev) =>
      prev.filter((it) => it.id !== id).map((it, i) => ({ ...it, no: i + 1 }))
    )
  }

  const resetAll = useCallback(() => {
    setEditingEstimasiId(null)
    setFormInfo(defaultFormInfo)
    setItems([])
    setCosts({
      ...defaultCosts,
      qtyBankCharge: '',
      qtyPackingCost: '',
      qtyAirDhl: '',
      qtyAirDoor: '',
      qtySeaResmi: '',
      qtySeaDoor: '',
      qtyLocalCost: '',
      qtyFeeKurir: '',
      qtyTruk: '',
      qtyServiceboat: '',
      qtyLainLain: '',
    })
    setQuotationRange('')
    setEstimasiPct('')
    setQuotationDiscountPct('10')
    setQuotationPpnPct('12')
    setQuotationDetails(defaultQuotationDetails)
    setShowQuotationTable(!quotationMode)
  }, [quotationMode])

  const updateCost = (field: keyof CostConfig, value: string) =>
    setCosts((prev) => ({ ...prev, [field]: value }))

  const addOtherCost = () => {
    setCosts((prev) => ({
      ...prev,
      otherCosts: [
        ...prev.otherCosts,
        {
          id: Date.now(),
          description: '',
          qty: '1',
          unit: 'LS',
          unitPrice: '0',
        },
      ],
    }))
  }

  const updateOtherCost = (
    id: number,
    field: keyof Omit<OtherCost, 'id'>,
    value: string
  ) =>
    setCosts((prev) => ({
      ...prev,
      otherCosts: prev.otherCosts.map((cost) =>
        cost.id === id ? { ...cost, [field]: value } : cost
      ),
    }))

  const removeOtherCost = (id: number) =>
    setCosts((prev) => ({
      ...prev,
      otherCosts: prev.otherCosts.filter((cost) => cost.id !== id),
    }))

  // ── calculations ──
  const totalModalSparepart = actualMode
    ? items.reduce((s, it) => s + (it.amountActual ?? 0), 0)
    : items.reduce((s, it) => s + it.amount, 0)
  const usdRate = parseNum(costs.usdRate)
  const discountAmt = (parseNum(costs.discountPct) / 100) * totalModalSparepart
  const afterDiscount = totalModalSparepart + discountAmt
  const bankChargeIdr =
    parseNum(costs.qtyBankCharge) * parseNum(costs.bankChargeUsd)
  const packingCostIdr =
    parseNum(costs.qtyPackingCost) * parseNum(costs.packingCostUsd)
  const dutyTaxAmt = (parseNum(costs.dutyTaxPct) / 100) * afterDiscount
  // Amount = QTY × Unit Price (untuk semua baris delivery & other cost)
  const airDhlIdr = parseNum(costs.qtyAirDhl) * parseNum(costs.airDhlKgs)
  const airDoorIdr = parseNum(costs.qtyAirDoor) * parseNum(costs.airDoorKgs)
  const seaResmiIdr = parseNum(costs.qtySeaResmi) * parseNum(costs.seaResmiCbm) // CBM rate sudah IDR
  const seaDoorIdr = parseNum(costs.qtySeaDoor) * parseNum(costs.seaDoorCbm) // CBM rate sudah IDR
  const localCostIdr =
    parseNum(costs.qtyLocalCost) * parseNum(costs.localCostUsd) * usdRate // USD → IDR
  const feeKurirIdr = parseNum(costs.qtyFeeKurir) * parseNum(costs.feeKurir) // Unit Price sudah IDR
  const otherCostsTotal = costs.otherCosts.reduce(
    (total, cost) => total + parseNum(cost.qty) * parseNum(cost.unitPrice),
    0
  )
  const subTotal =
    afterDiscount +
    bankChargeIdr +
    packingCostIdr +
    dutyTaxAmt +
    airDhlIdr +
    airDoorIdr +
    seaResmiIdr +
    seaDoorIdr +
    localCostIdr +
    feeKurirIdr +
    otherCostsTotal

  const investorAmt = (parseNum(costs.investorPct) / 100) * subTotal
  const grandTotal = subTotal + investorAmt
  const quotationSubtotal = items.reduce(
    (total, item) => total + parseNum(item.qty) * getQuotationUnitPrice(item),
    0
  )
  const quotationDiscount =
    quotationSubtotal * (parseNum(quotationDiscountPct) / 100)
  const quotationAfterDiscount = quotationSubtotal - quotationDiscount
  const quotationPpn =
    quotationAfterDiscount * (parseNum(quotationPpnPct) / 100)
  const quotationTotal = quotationAfterDiscount + quotationPpn
  // Jika SKTD aktif → TOTAL (IDR) = Total after discount (tanpa PPN)
  const effectiveQuotationTotal = formInfo.sktd
    ? quotationAfterDiscount
    : quotationTotal
  const tableHeaders = [
    'No',
    'P/N',
    'Description',
    actualMode ? 'Qty Estimasi' : 'QTY',
    '',
    'Unit Price Estimasi',
    'Amount Estimasi',
    ...(actualMode ? ['Qty Aktual', 'Unit Price Aktual', 'Amount Aktual'] : []),
    ...(!quotationMode ? ['Toko'] : []),
    ...(quotationMode ? ['Unit Price Quotation', 'Amount Quotation'] : []),
    '',
  ]
  const tableColumnCount = quotationMode ? 10 : actualMode ? 12 : 9

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{pageTitle}</h1>
            <p className='mt-0.5 text-sm text-muted-foreground'>
              {actualMode
                ? 'Form aktual biaya pengadaan spare part'
                : 'Form estimasi biaya pengadaan spare part'}
            </p>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={resetAll}
            >
              <RefreshCw className='h-3.5 w-3.5' />
              Reset
            </Button>
            {!quotationMode && (
              <>
                <div className='flex items-center gap-1'>
                  <Input
                    value={formInfo.noQuo}
                    onChange={(e) => {
                      const selectedNoQuo = e.target.value
                      updateInfo('noQuo', selectedNoQuo)
                      if (
                        savedList.some(
                          (estimasi) => estimasi.noQuo === selectedNoQuo
                        )
                      ) {
                        void handleLoadQuotation(selectedNoQuo)
                      }
                    }}
                    list='modal-estimasi-quotation-numbers'
                    placeholder='Search No. Quo...'
                    disabled={loadingQuotation}
                    className='h-8 w-40 text-xs'
                  />
                  <datalist id='modal-estimasi-quotation-numbers'>
                    {savedList
                      .filter((estimasi) => estimasi.noQuo)
                      .map((estimasi) => (
                        <option key={estimasi.id} value={estimasi.noQuo} />
                      ))}
                  </datalist>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='gap-1.5'
                  onClick={() => void handleSave()}
                >
                  <Save className='h-3.5 w-3.5' />
                  Simpan
                </Button>
                {editingEstimasiId !== null && (
                  <Button
                    variant='destructive'
                    size='sm'
                    className='gap-1.5'
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                    Hapus
                  </Button>
                )}
              </>
            )}
            {quotationMode && (
              <Button
                variant='outline'
                size='sm'
                className='gap-1.5'
                onClick={() => void handleSave()}
              >
                <Save className='h-3.5 w-3.5' />
                Simpan
              </Button>
            )}
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={() => setReportDialogOpen(true)}
            >
              <FileText className='h-3.5 w-3.5' />
              Report
            </Button>
            <Button
              size='sm'
              className='gap-1.5'
              onClick={() => window.print()}
            >
              <Printer className='h-3.5 w-3.5' />
              Print
            </Button>
            {quotationMode && (
              <label className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Switch
                  checked={showQuotationTable}
                  onCheckedChange={setShowQuotationTable}
                  aria-label='Tampilkan tabel quotation'
                />
                Tampilkan Cost
              </label>
            )}
          </div>
        </div>
        {!actualMode && (
          <div className='mb-4 rounded-md border bg-background p-4 shadow-sm'>
            <div className='grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3'>
              {/* Row 1 */}
              {!quotationMode && (
                <div className='flex items-center gap-2'>
                  <Label className='w-20 shrink-0 text-xs font-semibold text-muted-foreground'>
                    Tanggal
                  </Label>
                  <Input
                    type='date'
                    value={formInfo.tanggal}
                    onChange={(e) => updateInfo('tanggal', e.target.value)}
                    className='h-8 flex-1 text-xs'
                  />
                </div>
              )}
              {!quotationMode && (
                <div className='flex items-center gap-2'>
                  <Label className='w-20 shrink-0 text-xs font-semibold text-muted-foreground'>
                    PT
                  </Label>
                  <select
                    value={formInfo.pt}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className='h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs'
                  >
                    <option value=''>Pilih perusahaan</option>
                    {customerCompanies.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!quotationMode && (
                <div className='flex items-center gap-2'>
                  <Label className='w-20 shrink-0 text-xs font-semibold text-muted-foreground'>
                    Kapal
                  </Label>
                  <select
                    value={formInfo.kapal}
                    onChange={(e) => updateInfo('kapal', e.target.value)}
                    disabled={!formInfo.pt}
                    className='h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <option value=''>Pilih kapal</option>
                    {customerShips.map((customer) => (
                      <option key={customer.id} value={customer.namaKapal}>
                        {customer.namaKapal}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Row 2 */}
              {!quotationMode && (
                <div className='flex items-center gap-2'>
                  <Label className='w-20 shrink-0 text-xs font-semibold text-muted-foreground'>
                    Dept
                  </Label>
                  <Input
                    value={formInfo.dept}
                    onChange={(e) => updateInfo('dept', e.target.value)}
                    placeholder='Departemen'
                    className='h-8 flex-1 text-xs'
                  />
                </div>
              )}
              {quotationMode && (
                <div className='col-span-full'>
                  {/* Satu baris: No. Quo | Range (%) | SKTD | Revisi */}
                  <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
                    <div className='flex items-center gap-2'>
                      <Label className='w-16 shrink-0 text-xs font-semibold text-muted-foreground'>
                        No. Quo
                      </Label>
                      <Input
                        value={formInfo.noQuo}
                        onChange={(e) => {
                          updateInfo('noQuo', e.target.value)
                          if (
                            savedList.some(
                              (estimasi) => estimasi.noQuo === e.target.value
                            )
                          ) {
                            void handleLoadQuotation(e.target.value)
                          }
                        }}
                        list='quotation-numbers'
                        placeholder='Cari No. Quo...'
                        disabled={loadingQuotation}
                        className='h-8 w-[201px] min-w-0 text-xs disabled:cursor-not-allowed disabled:opacity-50'
                      />
                      <datalist id='quotation-numbers'>
                        {savedList
                          .filter((estimasi) => estimasi.noQuo)
                          .map((estimasi) => (
                            <option key={estimasi.id} value={estimasi.noQuo} />
                          ))}
                      </datalist>
                    </div>

                    <div className='flex items-center gap-2'>
                      <Label className='shrink-0 text-xs font-semibold text-muted-foreground'>
                        Range (%)
                      </Label>
                      <Input
                        type='number'
                        min='0'
                        max='999'
                        value={quotationRange}
                        onChange={(e) =>
                          setQuotationRange(e.target.value.slice(0, 3))
                        }
                        placeholder=''
                        className='h-8 w-20 flex-none text-xs'
                      />
                    </div>

                    <div className='flex items-center gap-2'>
                      <Label className='shrink-0 text-xs font-semibold text-muted-foreground'>
                        Persentase Estimasi (%)
                      </Label>
                      <Input
                        value={estimasiPct}
                        readOnly
                        className='h-8 w-20 flex-none bg-muted/30 text-xs text-muted-foreground'
                      />
                    </div>

                    <label className='flex items-center gap-2 text-xs font-medium whitespace-nowrap text-muted-foreground'>
                      <Checkbox
                        checked={formInfo.sktd}
                        onCheckedChange={(checked) =>
                          updateInfo('sktd', checked === true)
                        }
                        aria-label='SKTD'
                        className='h-4 w-4'
                      />
                      <span>SKTD</span>
                    </label>

                    <div className='flex items-center gap-2'>
                      <Label className='shrink-0 text-xs font-semibold text-muted-foreground'>
                        Revisi
                      </Label>
                      <RadioGroup
                        value={formInfo.revisi}
                        onValueChange={(value) => {
                          updateInfo('revisi', value)
                          if (quotationMode && formInfo.noQuo) {
                            const baseNumber = formInfo.noQuo.split('-')[0]
                            const dept =
                              formInfo.dept.trim().toUpperCase() || 'HDN'
                            const year = new Date().getFullYear()
                            const revisiSegment =
                              value && value !== '0' ? `-R${value}` : ''
                            if (baseNumber) {
                              const newNoQuo = `${baseNumber}${revisiSegment}-PH-${dept}-${year}`
                              updateInfo('noQuo', newNoQuo)
                            }
                          }
                        }}
                        className='flex items-center gap-2'
                        aria-label='Revisi quotation'
                      >
                        {['0', '1', '2', '3'].map((value) => (
                          <label
                            key={value}
                            className='flex items-center gap-1 text-[11px] text-muted-foreground'
                          >
                            <RadioGroupItem
                              value={value}
                              className='h-3.5 w-3.5'
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              )}
              {!quotationMode && (
                <div className='flex items-center gap-2'>
                  <Label className='w-20 shrink-0 text-xs font-semibold text-muted-foreground'>
                    No. Quo
                  </Label>
                  {/* Input nomor urut saja */}
                  <Input
                    value={noQuoNumber}
                    onChange={(e) => setNoQuoNumber(e.target.value)}
                    placeholder='0000'
                    className='h-8 w-20 flex-none text-xs'
                  />
                  {/* Bagian read-only: -[R{n}]-PH-{DEPT}-{YEAR} */}
                  <div className='flex items-center gap-0'>
                    {formInfo.revisi && formInfo.revisi !== '0' && (
                      <>
                        <span className='text-xs text-muted-foreground'>-</span>
                        <Input
                          value={`R${formInfo.revisi}`}
                          readOnly
                          className='h-8 w-10 flex-none cursor-default border-dashed bg-amber-50 px-1 text-center text-xs text-amber-600 select-none focus-visible:ring-0'
                        />
                      </>
                    )}
                    <span className='text-xs text-muted-foreground'>-</span>
                    <Input
                      value='PH'
                      readOnly
                      className='h-8 w-10 flex-none cursor-default border-dashed bg-muted/40 px-1 text-center text-xs text-muted-foreground select-none focus-visible:ring-0'
                    />
                    <span className='text-xs text-muted-foreground'>-</span>
                    <Input
                      value={formInfo.dept.trim().toUpperCase() || 'HDN'}
                      readOnly
                      className='h-8 w-14 flex-none cursor-default border-dashed bg-muted/40 px-1 text-center text-xs text-muted-foreground select-none focus-visible:ring-0'
                    />
                    <span className='text-xs text-muted-foreground'>-</span>
                    <Input
                      value={new Date().getFullYear()}
                      readOnly
                      className='h-8 w-14 flex-none cursor-default border-dashed bg-muted/40 px-1 text-center text-xs text-muted-foreground select-none focus-visible:ring-0'
                    />
                  </div>
                </div>
              )}
              {!quotationMode && (
                <div className='flex items-center gap-2'>
                  <Label className='w-20 shrink-0 text-xs font-semibold text-muted-foreground'>
                    No. RFS
                  </Label>
                  <Input
                    value={formInfo.noRfs}
                    onChange={(e) => updateInfo('noRfs', e.target.value)}
                    placeholder='Nomor RFS'
                    className='h-8 flex-1 text-xs'
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── Spreadsheet container ── */}
        <div className='overflow-x-auto rounded-md border bg-background text-xs shadow-sm'>
          <QuotationModeContext.Provider value={quotationMode}>
            <table className='w-full min-w-175 border-collapse'>
              <colgroup>
                <col className='w-8' />
                <col className='w-36' />
                <col />
                <col className='w-14' />
                <col className='w-12' />
                <col className='w-28' />
                <col className='w-28' />
                {actualMode && (
                  <>
                    <col className='w-14' />
                    <col className='w-28' />
                    <col className='w-28' />
                  </>
                )}
                {!quotationMode && <col className='w-28' />}
                {quotationMode && (
                  <>
                    <col className='w-28' />
                    <col className='w-28' />
                  </>
                )}
                <col className='w-8' />
              </colgroup>

              {/* ── thead ── */}
              <thead>
                <tr className='border-b bg-muted/60'>
                  {tableHeaders.map((h, i) => (
                    <th
                      key={i}
                      className='border-r px-2 py-1.5 text-center text-xs font-semibold last:border-r-0'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* ── Line items ── */}
                {items.map((item) => (
                  <tr
                    key={`${item.id}-main`}
                    className='border-b hover:bg-muted/20'
                  >
                    <td className='border-r py-0.5 text-center'>
                      <Cell value={String(item.no)} readOnly align='center' />
                    </td>
                    <td className='border-r py-0.5'>
                      <Cell
                        value={item.pn}
                        onChange={(v) => updateItem(item.id, 'pn', v)}
                        placeholder='P/N'
                      />
                    </td>
                    <td className='border-r py-0.5'>
                      <Cell
                        value={item.description}
                        onChange={(v) => updateItem(item.id, 'description', v)}
                        placeholder='Description'
                        className='font-semibold'
                      />
                      <Input
                        value={item.note}
                        onChange={(e) =>
                          updateItem(item.id, 'note', e.target.value)
                        }
                        placeholder='Tambahkan catatan (opsional)...'
                        className='mt-0.5 h-5 rounded-none border-0 bg-transparent px-1.5 py-0 text-[11px] text-red-500 italic shadow-none placeholder:text-red-300 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-inset'
                      />
                    </td>
                    <td className='border-r py-0.5'>
                      <Cell
                        value={item.qty}
                        onChange={(v) => updateItem(item.id, 'qty', v)}
                        placeholder='0'
                        align='center'
                      />
                    </td>
                    <td className='border-r py-0.5'>
                      <Cell
                        value={item.unit}
                        onChange={(v) => updateItem(item.id, 'unit', v)}
                        placeholder='PC'
                        align='center'
                      />
                    </td>
                    <td className='border-r py-0.5'>
                      <Cell
                        value={item.unitPrice}
                        onChange={(v) => updateItem(item.id, 'unitPrice', v)}
                        placeholder='0.000'
                        align='right'
                        formatThousand
                      />
                    </td>
                    <td className='border-r py-0.5'>
                      <Cell
                        value={fmt(item.amount)}
                        readOnly
                        align='right'
                        className='font-medium'
                      />
                    </td>

                    {actualMode && (
                      <>
                        <td className='border-r py-0.5 align-top'>
                          <div className='space-y-1.5'>
                            <Cell
                              value={item.qtyActual ?? item.qty}
                              onChange={(v) =>
                                updateItem(item.id, 'qtyActual', v)
                              }
                              placeholder='0'
                              align='center'
                              className='w-full'
                            />

                            {(item.actualPriceVariants ?? []).map(
                              (variant, index) => (
                                <Cell
                                  key={`${item.id}-variant-qty-${index}`}
                                  value={variant.qtyActual}
                                  onChange={(v) =>
                                    updateActualPriceVariant(
                                      item.id,
                                      index,
                                      'qtyActual',
                                      v
                                    )
                                  }
                                  placeholder='Qty'
                                  align='center'
                                  className='w-full'
                                />
                              )
                            )}
                          </div>
                        </td>
                        <td className='border-r py-0.5 align-top'>
                          <div className='space-y-1.5'>
                            <Cell
                              value={item.unitPriceActual ?? ''}
                              onChange={(v) =>
                                updateItem(item.id, 'unitPriceActual', v)
                              }
                              placeholder='0.000'
                              align='right'
                              formatThousand
                              className='w-full min-w-[6rem]'
                            />

                            {(item.actualPriceVariants ?? []).map(
                              (variant, index) => (
                                <Cell
                                  key={`${item.id}-variant-price-${index}`}
                                  value={variant.price}
                                  onChange={(v) =>
                                    updateActualPriceVariant(
                                      item.id,
                                      index,
                                      'price',
                                      v
                                    )
                                  }
                                  placeholder='0.000'
                                  align='right'
                                  formatThousand
                                  className='w-full min-w-[6rem]'
                                />
                              )
                            )}

                            <button
                              type='button'
                              onClick={() => addActualPriceVariant(item.id)}
                              className='text-[10px] font-medium text-primary hover:underline'
                            >
                              + toko lain
                            </button>
                          </div>
                        </td>
                        <td className='border-r py-0.5'>
                          <Cell
                            value={fmt(item.amountActual ?? 0)}
                            readOnly
                            align='right'
                            className='font-medium'
                          />
                        </td>
                      </>
                    )}

                    {!quotationMode && (
                      <td className='border-r py-0.5 align-top'>
                        <div className='space-y-1.5'>
                          <Cell
                            value={item.toko ?? ''}
                            onChange={(v) => updateItem(item.id, 'toko', v)}
                            placeholder='Toko'
                            align='center'
                            className='font-medium'
                          />

                          {(item.actualPriceVariants ?? []).map(
                            (variant, index) => (
                              <Cell
                                key={`${item.id}-variant-toko-${index}`}
                                value={variant.toko}
                                onChange={(e) =>
                                  updateActualPriceVariant(
                                    item.id,
                                    index,
                                    'toko',
                                    e
                                  )
                                }
                                placeholder='Toko baru'
                                align='center'
                                className='font-medium'
                              />
                            )
                          )}
                        </div>
                      </td>
                    )}

                    {quotationMode && (
                      <>
                        <td className='border-r py-0.5'>
                          <Cell
                            value={
                              item.unitPriceQuo?.trim() ||
                              fmt(getQuotationUnitPrice(item))
                            }
                            onChange={(v) =>
                              updateItem(item.id, 'unitPriceQuo', v)
                            }
                            placeholder='0.000'
                            align='right'
                            formatThousand
                          />
                        </td>
                        <td className='border-r py-0.5'>
                          <Cell
                            value={fmt(
                              parseNum(item.qty) * getQuotationUnitPrice(item)
                            )}
                            readOnly
                            align='right'
                            className='font-medium'
                          />
                        </td>
                      </>
                    )}

                    <td className='py-0.5 text-center'>
                      <button
                        onClick={() => removeItem(item.id)}
                        className='p-0.5 text-muted-foreground transition-colors hover:text-destructive'
                        title='Hapus item'
                      >
                        <Trash2 className='h-3 w-3' />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* empty filler rows */}
                {Array.from({ length: Math.max(0, 8 - items.length) }).map(
                  (_, i) => (
                    <tr key={`empty-${i}`} className='h-7 border-b'>
                      <td className='border-r' />
                      <td className='border-r' />
                      <td className='border-r' />
                      <td className='border-r' />
                      <td className='border-r' />
                      <td className='border-r' />
                      <td className='border-r' />
                      {actualMode && (
                        <>
                          <td className='border-r' />
                          <td className='border-r' />
                          <td className='border-r' />
                        </>
                      )}
                      {!quotationMode && <td className='border-r' />}
                      {quotationMode && (
                        <>
                          <td className='border-r' />
                          <td className='border-r' />
                        </>
                      )}
                      <td />
                    </tr>
                  )
                )}

                {/* add row button */}
                <tr className='border-b'>
                  <td colSpan={tableColumnCount} className='px-2 py-1'>
                    <button
                      onClick={addItem}
                      className='flex items-center gap-1 text-xs text-primary hover:underline'
                    >
                      <Plus className='h-3 w-3' />
                      Tambah item
                    </button>
                  </td>
                </tr>

                {quotationMode && (
                  <tr className='border-b'>
                    <td colSpan={10} className='p-0'>
                      <div className='grid grid-cols-1 gap-4 p-3 text-xs md:grid-cols-[1fr_340px]'>
                        <div className='font-mono'>
                          <div className='mb-2 font-semibold'>Note:</div>
                          <Textarea
                            value={quotationDetails.note}
                            onChange={(event) =>
                              setQuotationDetails((current) => ({
                                ...current,
                                note: event.target.value,
                              }))
                            }
                            className='min-h-20 resize-y rounded-none border-dotted px-1 py-1 text-xs shadow-none focus-visible:ring-1'
                          />
                          <div className='my-3 border-t border-dotted' />
                          <div className='grid grid-cols-[110px_12px_1fr] gap-y-1'>
                            <span>a. Delivery</span>
                            <span>:</span>
                            <Input
                              value={quotationDetails.delivery}
                              onChange={(event) =>
                                setQuotationDetails((current) => ({
                                  ...current,
                                  delivery: event.target.value,
                                }))
                              }
                              className='h-6 rounded-none border-dotted px-1 text-xs shadow-none focus-visible:ring-1'
                            />
                            <span>b. Price</span>
                            <span>:</span>
                            <Input
                              value={quotationDetails.price}
                              onChange={(event) =>
                                setQuotationDetails((current) => ({
                                  ...current,
                                  price: event.target.value,
                                }))
                              }
                              className='h-6 rounded-none border-dotted px-1 text-xs shadow-none focus-visible:ring-1'
                            />
                            <span>c. Payment</span>
                            <span>:</span>
                            <Input
                              value={quotationDetails.payment}
                              onChange={(event) =>
                                setQuotationDetails((current) => ({
                                  ...current,
                                  payment: event.target.value,
                                }))
                              }
                              className='h-6 rounded-none border-dotted px-1 text-xs shadow-none focus-visible:ring-1'
                            />
                            <span>d. Stock Validity</span>
                            <span>:</span>
                            <Input
                              value={quotationDetails.stockValidity}
                              onChange={(event) =>
                                setQuotationDetails((current) => ({
                                  ...current,
                                  stockValidity: event.target.value,
                                }))
                              }
                              className='h-6 rounded-none border-dotted px-1 text-xs shadow-none focus-visible:ring-1'
                            />
                            <span>e. Price Validity</span>
                            <span>:</span>
                            <Input
                              value={quotationDetails.priceValidity}
                              onChange={(event) =>
                                setQuotationDetails((current) => ({
                                  ...current,
                                  priceValidity: event.target.value,
                                }))
                              }
                              className='h-6 rounded-none border-dotted px-1 text-xs shadow-none focus-visible:ring-1'
                            />
                          </div>
                          <div className='mt-5 font-sans'>
                            Association Member:
                          </div>
                          <div className='mt-3 flex flex-wrap items-center gap-4'>
                            {['4.png', '5.png', '6.png'].map((image) => (
                              <img
                                key={image}
                                src={`/images/${image}`}
                                alt={`Association member ${image}`}
                                className='h-auto max-h-16 w-auto max-w-[30%] object-contain'
                              />
                            ))}
                          </div>
                        </div>
                        <div className='ml-auto w-full max-w-85 font-mono'>
                          <QuotationSummaryRow
                            label='Sub Total'
                            value={quotationSubtotal}
                          />
                          <QuotationSummaryRow
                            label={
                              <span className='flex items-center gap-1'>
                                Discount
                                <Input
                                  type='number'
                                  min='0'
                                  max='100'
                                  value={quotationDiscountPct}
                                  onChange={(event) =>
                                    setQuotationDiscountPct(event.target.value)
                                  }
                                  className='h-6 w-14 rounded-none border-dotted px-1 text-right text-xs font-normal shadow-none focus-visible:ring-1'
                                />
                                %
                              </span>
                            }
                            value={-quotationDiscount}
                          />
                          <QuotationSummaryRow
                            label='Total after discount'
                            value={quotationAfterDiscount}
                          />
                          <QuotationSummaryRow
                            label={
                              <span className='flex items-center gap-1'>
                                PPN
                                <Input
                                  type='number'
                                  min='0'
                                  max='100'
                                  value={quotationPpnPct}
                                  onChange={(event) =>
                                    setQuotationPpnPct(event.target.value)
                                  }
                                  className='h-6 w-14 rounded-none border-dotted px-1 text-right text-xs font-normal shadow-none focus-visible:ring-1'
                                />
                                %
                              </span>
                            }
                            value={quotationPpn}
                          />
                          <QuotationSummaryRow
                            label='TOTAL (IDR)'
                            value={effectiveQuotationTotal}
                            strong
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Cost section ── */}
                {(!quotationMode || showQuotationTable) && (
                  <>
                    {/* Discount */}
                    <CostRow label='1. DISCOUNT' labelColSpan={2}>
                      <td className='border-r'>
                        <Cell
                          value={costs.discountPct + '%'}
                          onChange={(v) =>
                            updateCost('discountPct', v.replace('%', ''))
                          }
                          align='center'
                          highlight='yellow'
                        />
                      </td>
                      <td className='border-r' />
                      <Cell
                        value={fmt(totalModalSparepart)}
                        readOnly
                        align='right'
                        className='border-r'
                      />
                      <Cell
                        value={fmt(discountAmt)}
                        readOnly
                        align='right'
                        className=''
                      />
                      <td />
                    </CostRow>

                    {/* Total Modal Sparepart */}
                    <CostRow label='2. TOTAL MODAL SPAREPART' labelColSpan={2}>
                      <td className='border-r'>
                        <Cell value='1' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell value='LS' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={fmt(afterDiscount)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={fmt(afterDiscount)}
                          readOnly
                          align='right'
                          className='font-semibold'
                        />
                      </td>
                      <td />
                    </CostRow>

                    {/* Bank Charge */}
                    <CostRow label='3. BANK CHARGE' labelColSpan={2}>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtyBankCharge}
                          onChange={(v) => updateCost('qtyBankCharge', v)}
                          align='center'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='USD' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.bankChargeUsd}
                          onChange={(v) => updateCost('bankChargeUsd', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={bankChargeIdr === 0 ? '0' : fmt(bankChargeIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostRow>

                    {/* Packing Cost */}
                    <CostRow label='4. PACKING COST' labelColSpan={2}>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtyPackingCost}
                          onChange={(v) => updateCost('qtyPackingCost', v)}
                          align='center'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='USD' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.packingCostUsd}
                          onChange={(v) => updateCost('packingCostUsd', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={
                            packingCostIdr === 0 ? '0' : fmt(packingCostIdr)
                          }
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostRow>

                    {/* Delivery heading */}
                    <CostRow
                      label='5. DELIVERY COST CINA TO JAKARTA:'
                      labelColSpan={5}
                      noBorderRight
                    >
                      <td className='border-r' />
                      <td />
                    </CostRow>

                    {/* Duty Tax */}
                    <CostSubRow label='a. DUTY TAX'>
                      <td className='border-r'>
                        <Cell
                          value={costs.dutyTaxPct + '%'}
                          onChange={(v) =>
                            updateCost('dutyTaxPct', v.replace('%', ''))
                          }
                          align='center'
                          highlight='yellow'
                        />
                      </td>
                      <td className='border-r' />
                      <td className='border-r'>
                        <Cell
                          value={fmt(afterDiscount)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value={fmt(dutyTaxAmt)} readOnly align='right' />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* AIR DHL */}
                    <CostSubRow label='b. AIR (DHL)'>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtyAirDhl}
                          onChange={(v) => updateCost('qtyAirDhl', v)}
                          align='center'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='KGS' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.airDhlKgs}
                          onChange={(v) => updateCost('airDhlKgs', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={airDhlIdr === 0 ? '' : fmt(airDhlIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* AIR Door */}
                    <CostSubRow label='c. AIR (Door to door)'>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtyAirDoor}
                          onChange={(v) => updateCost('qtyAirDoor', v)}
                          align='center'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='KGS' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.airDoorKgs}
                          onChange={(v) => updateCost('airDoorKgs', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={airDoorIdr === 0 ? '0' : fmt(airDoorIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* SEA Resmi */}
                    <CostSubRow label='d. SEA (Resmi)'>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtySeaResmi}
                          onChange={(v) => updateCost('qtySeaResmi', v)}
                          align='center'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='CBM' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.seaResmiCbm}
                          onChange={(v) => updateCost('seaResmiCbm', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={seaResmiIdr === 0 ? '0' : fmt(seaResmiIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* SEA Door */}
                    <CostSubRow label='e. SEA (Door to door)'>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtySeaDoor}
                          onChange={(v) => updateCost('qtySeaDoor', v)}
                          align='center'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='CBM' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.seaDoorCbm}
                          onChange={(v) => updateCost('seaDoorCbm', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={seaDoorIdr === 0 ? '0' : fmt(seaDoorIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* Local cost */}
                    <CostSubRow label='f. Local cost (delivery to agent, permit, etc)'>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtyLocalCost}
                          onChange={(v) => updateCost('qtyLocalCost', v)}
                          align='center'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='USD' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.localCostUsd}
                          onChange={(v) => updateCost('localCostUsd', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={localCostIdr === 0 ? '0' : fmt(localCostIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* Fee kurir */}
                    <CostRow label='6. Fee kurir' labelColSpan={2}>
                      <td className='border-r'>
                        <Cell
                          value={costs.qtyFeeKurir}
                          onChange={(v) => updateCost('qtyFeeKurir', v)}
                          align='center'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell value='LS' readOnly align='center' />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={costs.feeKurir}
                          onChange={(v) => updateCost('feeKurir', v)}
                          align='right'
                          highlight='yellow'
                          formatThousand
                        />
                      </td>
                      <td className='border-r'>
                        <Cell
                          value={feeKurirIdr === 0 ? '0' : fmt(feeKurirIdr)}
                          readOnly
                          align='right'
                        />
                      </td>
                      <td />
                    </CostRow>

                    {/* Other cost heading */}
                    <CostRow
                      label='7. Other cost'
                      labelColSpan={5}
                      noBorderRight
                    >
                      <td className='border-r' />
                      <td />
                    </CostRow>

                    {costs.otherCosts.map((cost) => (
                      <CostSubRow
                        key={cost.id}
                        label={
                          <Input
                            value={cost.description}
                            onChange={(event) =>
                              updateOtherCost(
                                cost.id,
                                'description',
                                event.target.value
                              )
                            }
                            placeholder='Nama cost lain'
                            className='h-6 rounded-none border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-1'
                          />
                        }
                      >
                        <td className='border-r'>
                          <Cell
                            value={cost.qty}
                            onChange={(value) =>
                              updateOtherCost(cost.id, 'qty', value)
                            }
                            align='center'
                            formatThousand
                          />
                        </td>
                        <td className='border-r'>
                          <Cell
                            value={cost.unit}
                            onChange={(value) =>
                              updateOtherCost(cost.id, 'unit', value)
                            }
                            align='center'
                          />
                        </td>
                        <td className='border-r'>
                          <Cell
                            value={cost.unitPrice}
                            onChange={(value) =>
                              updateOtherCost(cost.id, 'unitPrice', value)
                            }
                            align='right'
                            highlight='yellow'
                            formatThousand
                          />
                        </td>
                        <td className='border-r'>
                          <Cell
                            value={fmt(
                              parseNum(cost.qty) * parseNum(cost.unitPrice)
                            )}
                            readOnly
                            align='right'
                          />
                        </td>
                        <td className='text-center'>
                          <button
                            type='button'
                            onClick={() => removeOtherCost(cost.id)}
                            className='p-0.5 text-muted-foreground transition-colors hover:text-destructive'
                            title='Hapus cost lain'
                          >
                            <Trash2 className='h-3 w-3' />
                          </button>
                        </td>
                      </CostSubRow>
                    ))}

                    <tr className='border-b hover:bg-muted/10'>
                      <td className='border-r' />
                      <td className='border-r' colSpan={5}>
                        <button
                          type='button'
                          onClick={addOtherCost}
                          className='px-2 py-1 text-xs text-primary hover:underline'
                        >
                          + Cost Lain
                        </button>
                      </td>
                      <td />
                    </tr>

                    {/* SUB TOTAL */}
                    <tr className='border-t-2 border-b bg-muted/40'>
                      <td className='border-r' />
                      <td className='border-r' />
                      <td
                        className='border-r px-2 py-1.5 text-right text-xs font-bold'
                        colSpan={3}
                      >
                        SUB TOTAL
                      </td>
                      <td className='border-r' />
                      <td className='border-r py-0.5'>
                        <Cell
                          value={fmt(subTotal)}
                          readOnly
                          align='right'
                          className='font-bold'
                        />
                      </td>
                      <td />
                    </tr>

                    {/* Investor heading */}
                    <tr className='border-b'>
                      <td className='border-r' colSpan={2} />
                      <td className='border-r px-2 py-0.5' colSpan={5}>
                        <span className='text-xs text-muted-foreground'>
                          d. Investor
                        </span>
                      </td>
                      <td />
                    </tr>

                    {/* HSI */}
                    <CostSubRow label='i. H S I  —→  2 bulan'>
                      <td className='border-r'>
                        <Cell
                          value={costs.investorPct + '%'}
                          onChange={(v) =>
                            updateCost('investorPct', v.replace('%', ''))
                          }
                          align='center'
                          highlight='yellow'
                        />
                      </td>
                      <td className='border-r' />
                      <td className='border-r'>
                        <Cell value={fmt(subTotal)} readOnly align='right' />
                      </td>
                      <td className='border-r'>
                        <Cell value={fmt(investorAmt)} readOnly align='right' />
                      </td>
                      <td />
                    </CostSubRow>

                    {/* TOTAL */}
                    <tr className='border-t-2 border-b bg-primary/10'>
                      <td className='border-r' />
                      <td className='border-r' />
                      <td
                        className='border-r px-2 py-2 text-right text-sm font-bold'
                        colSpan={3}
                      >
                        TOTAL
                      </td>
                      <td className='border-r' />
                      <td className='border-r py-1'>
                        <Cell
                          value={fmt(grandTotal)}
                          readOnly
                          align='right'
                          className='text-sm font-bold'
                        />
                      </td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </QuotationModeContext.Provider>
        </div>
        <p className='mt-3 text-xs text-muted-foreground'>
          * Sel berwarna kuning dapat diedit. Klik sel untuk mengubah nilai.
        </p>
      </Main>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title='Hapus data quotation'
        desc={
          <>
            Apakah Anda yakin ingin menghapus data{' '}
            <span className='font-semibold'>{formInfo.noQuo || 'No. Quo'}</span>
            ?
            <br />
            Tindakan ini akan menghapus data yang sedang dimuat dan tidak dapat
            dibatalkan.
          </>
        }
        confirmText='Hapus'
        destructive
        disabled={!formInfo.noQuo.trim() || editingEstimasiId === null}
        handleConfirm={async () => {
          setDeleteConfirmOpen(false)
          await handleDeleteQuotation()
        }}
      />

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-5xl'>
          {!quotationMode && (
            <DialogHeader className='print:hidden'>
              <DialogTitle>Report Modal Estimasi</DialogTitle>
              <DialogDescription>
                Pratinjau laporan biaya berdasarkan data yang sedang dibuka.
              </DialogDescription>
            </DialogHeader>
          )}
          {quotationMode ? (
            <QuotationReport
              formInfo={formInfo}
              items={items}
              quotationRange={quotationRange}
              quotationDetails={quotationDetails}
              quotationSubtotal={quotationSubtotal}
              quotationDiscount={quotationDiscount}
              quotationAfterDiscount={quotationAfterDiscount}
              quotationPpn={quotationPpn}
              quotationTotal={effectiveQuotationTotal}
              quotationPpnPct={quotationPpnPct}
              customers={customers}
            />
          ) : (
            <EstimasiReport
              formInfo={formInfo}
              items={items}
              costs={costs}
              totalModalSparepart={totalModalSparepart}
              discountAmt={discountAmt}
              bankChargeIdr={bankChargeIdr}
              packingCostIdr={packingCostIdr}
              dutyTaxAmt={dutyTaxAmt}
              airDhlIdr={airDhlIdr}
              airDoorIdr={airDoorIdr}
              seaResmiIdr={seaResmiIdr}
              seaDoorIdr={seaDoorIdr}
              localCostIdr={localCostIdr}
              feeKurirIdr={feeKurirIdr}
              otherCostsTotal={otherCostsTotal}
              subTotal={subTotal}
              investorAmt={investorAmt}
              grandTotal={grandTotal}
            />
          )}
          <DialogFooter className='print:hidden'>
            <Button
              variant='outline'
              onClick={() => setReportDialogOpen(false)}
            >
              Tutup
            </Button>
            <Button onClick={() => window.print()} className='gap-1.5'>
              <Printer className='h-3.5 w-3.5' />
              Print Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EstimasiReport({
  formInfo,
  items,
  costs,
  totalModalSparepart,
  discountAmt,
  bankChargeIdr,
  packingCostIdr,
  dutyTaxAmt,
  airDhlIdr,
  airDoorIdr,
  seaResmiIdr,
  seaDoorIdr,
  localCostIdr,
  feeKurirIdr,
  otherCostsTotal,
  subTotal,
  investorAmt,
  grandTotal,
}: {
  formInfo: FormInfo
  items: LineItem[]
  costs: CostConfig
  totalModalSparepart: number
  discountAmt: number
  bankChargeIdr: number
  packingCostIdr: number
  dutyTaxAmt: number
  airDhlIdr: number
  airDoorIdr: number
  seaResmiIdr: number
  seaDoorIdr: number
  localCostIdr: number
  feeKurirIdr: number
  otherCostsTotal: number
  subTotal: number
  investorAmt: number
  grandTotal: number
}) {
  const reportDate = formInfo.tanggal
    ? new Date(`${formInfo.tanggal}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-'

  return (
    <div className='space-y-5 bg-white p-2 text-slate-900 print:p-0'>
      <div className='grid grid-cols-2 gap-4 border p-3 text-xs sm:grid-cols-4'>
        <ReportMeta label='NO' value={formInfo.noQuo || '-'} />
        <ReportMeta label='CUSTOMER ID' value={formInfo.pt || '-'} />
        <ReportMeta label='DATE' value={reportDate} />
        <ReportMeta label='SUPPLY LOCATION' value='JAKARTA' />
      </div>
      <div>
        <div className='text-base font-bold'>{formInfo.pt || '-'}</div>
        <div className='text-sm'>{formInfo.kapal || '-'}</div>
      </div>
      <table className='w-full border-collapse text-xs'>
        <thead>
          <tr className='border-y bg-slate-100'>
            {[
              'No',
              'Kode IMPA',
              'Description',
              'Qty',
              'Nama Toko',
              'Unit Price',
              'Amount',
            ].map((header) => (
              <th
                key={header}
                className='border-r px-1.5 py-1 text-left last:border-r-0'
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className='border-b'>
              <td className='px-1.5 py-1'>{item.no}</td>
              <td className='px-1.5 py-1'>{item.pn}</td>
              <td className='px-1.5 py-1'>{item.description}</td>
              <td className='px-1.5 py-1'>
                {item.qty} {item.unit}
              </td>
              <td className='px-1.5 py-1'>{item.toko || '-'}</td>
              <td className='px-1.5 py-1 text-right'>
                {fmt(parseNum(item.unitPrice))}
              </td>
              <td className='px-1.5 py-1 text-right'>{fmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className='grid gap-5 text-xs md:grid-cols-2'>
        <div className='border p-2'>
          <div className='mb-1 text-sm font-bold'>RINGKASAN BIAYA:</div>
          <ReportRow label='Sub Total Amount' value={totalModalSparepart} />
          <ReportRow label='Discount' value={discountAmt} />
          <ReportRow label='Bank Charge' value={bankChargeIdr} />
          <ReportRow label='Packing Cost' value={packingCostIdr} />
          <div className='mt-1 border-t pt-1 font-bold'>
            <ReportRow
              label='Total Delivery'
              value={
                dutyTaxAmt +
                airDhlIdr +
                airDoorIdr +
                seaResmiIdr +
                seaDoorIdr +
                localCostIdr
              }
            />
          </div>
          <ReportRow label='Duty Tax' value={dutyTaxAmt} />
          <ReportRow label='Air DHL' value={airDhlIdr} />
          <ReportRow label='Air Door to Door' value={airDoorIdr} />
          <ReportRow label='Sea Resmi' value={seaResmiIdr} />
          <ReportRow label='Sea Door to Door' value={seaDoorIdr} />
          <ReportRow label='Local Cost' value={localCostIdr} />
          <ReportRow label='Fee Kurir' value={feeKurirIdr} />
          <ReportRow label='HSI / Investor' value={investorAmt} />
          <div className='mt-1 border-t pt-1 font-bold'>
            <ReportRow label='Total Other Cost' value={otherCostsTotal} />
          </div>
          {costs.otherCosts.map((cost) => (
            <ReportRow
              key={cost.id}
              label={cost.description || 'Cost lain'}
              value={parseNum(cost.qty) * parseNum(cost.unitPrice)}
            />
          ))}
        </div>
        <div className='space-y-1 self-start'>
          <ReportRow label='Sub Total' value={subTotal} />
          <ReportRow label='Total Biaya Lain' value={otherCostsTotal} />
          <div className='mt-1 bg-slate-100 p-2 text-sm font-bold'>
            <ReportRow label='TOTAL MODAL (IDR)' value={grandTotal} />
          </div>
        </div>
      </div>
      <div className='border-t pt-3 text-right text-sm font-bold'>
        PT. HALUAN DAYA NIAGA
      </div>
    </div>
  )
}

function QuotationReport({
  formInfo,
  items,
  quotationRange,
  quotationDetails,
  quotationSubtotal,
  quotationDiscount,
  quotationAfterDiscount,
  quotationPpn,
  quotationTotal,
  quotationPpnPct,
  customers,
}: {
  formInfo: FormInfo
  items: LineItem[]
  quotationRange: string
  quotationDetails: typeof defaultQuotationDetails
  quotationSubtotal: number
  quotationDiscount: number
  quotationAfterDiscount: number
  quotationPpn: number
  quotationTotal: number
  quotationPpnPct: string
  customers: Customer[]
}) {
  const reportDate = formInfo.tanggal
    ? new Date(`${formInfo.tanggal}T00:00:00`).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-'

  const customer = customers.find((c) => c.pt === formInfo.pt)

  return (
    <div className='space-y-5 bg-white p-2 text-slate-900 print:p-0'>
      <div className='flex items-start justify-between border-b pb-3'>
        <div>
          <div className='text-2xl font-bold text-sky-700'>
            HALUAN <span className='text-green-600'>DAYA NIAGA</span>, PT.
          </div>
          <div className='text-xs font-medium text-green-600'>
            Marine - Oil & Gas - Mining Services
          </div>
          <div className='mt-1 text-[10px] tracking-[0.25em] text-slate-500'>
            NPWP: 07.312.145.3-502.000
          </div>
        </div>
        <img
          src='/images/logotok.png'
          alt='Haluan Daya Niaga'
          className='h-16 w-16 object-contain'
        />
      </div>
      <div className='flex justify-between gap-4 text-[10px] leading-tight'>
        <div>
          <div>Ged. One Pacific Place, Level 11-SCBD</div>
          <div>Jl. Jend. Sudirman Kav. 52-53, Jakarta 12190</div>
          <div>Ph./Fax. 021-22757897-7538093</div>
          <div>Email: sales@haluan.id / haluan.group@yahoo.co.id</div>
          <div>Website: www.haluan.id</div>
        </div>
        <div className='text-right'>
          <div className='font-bold'>Workshop:</div>
          <div>Cinere Residence H1 No. 5</div>
          <div>Depok Meruyung Jawa Barat 16515</div>
        </div>
      </div>
      <div className='py-2 text-center'>
        <div className='mx-auto max-w-xs border-b pb-2 text-3xl font-bold tracking-wider text-red-700'>
          QUOTATION
        </div>
      </div>
      <div className='grid grid-cols-2 gap-5 text-xs sm:grid-cols-[1fr_320px]'>
        <div>
          <div className='font-bold'>{formInfo.pt || '-'}</div>
          <div>{formInfo.noRfs || formInfo.noQuo || '-'}</div>
          <div>{formInfo.kapal || '-'}</div>
          <div>Attn: {customer?.kontak || '-'}</div>
        </div>
        <div className='grid grid-cols-[115px_1fr] gap-y-1'>
          <span className='font-bold'>NO</span>
          <span>: {formInfo.noQuo || '-'}</span>
          <span className='font-bold'>CUSTOMER ID</span>
          <span>: {formInfo.pt || '-'}</span>
          <span className='font-bold'>DATE</span>
          <span>: {reportDate}</span>
          <span className='font-bold'>PAGE</span>
          <span>: 1</span>
          <span className='font-bold'>SUPPLY LOCATION</span>
          <span>: {formInfo.supplyLocation || '-'}</span>
        </div>
      </div>
      <table className='w-full border-collapse text-xs'>
        <thead>
          <tr className='border-y border-slate-400 bg-slate-100'>
            {[
              'No',
              'CODE',
              'Description',
              'Quantity',
              'Unit Price',
              'Amount',
            ].map((header) => (
              <th
                key={header}
                className='border-r px-1.5 py-1 text-left last:border-r-0'
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const unitPrice = item.unitPriceQuo?.trim()
              ? parseNum(item.unitPriceQuo)
              : (parseNum(item.unitPrice) * parseNum(quotationRange)) / 100
            return (
              <tr key={item.id} className='border-b'>
                <td className='px-1.5 py-1'>{item.no}</td>
                <td className='px-1.5 py-1'>{item.pn}</td>
                <td className='px-1.5 py-1'>{item.description}</td>
                <td className='px-1.5 py-1'>
                  {item.qty} {item.unit}
                </td>
                <td className='px-1.5 py-1 text-right'>
                  {formatQuotationAmount(unitPrice)}
                </td>
                <td className='px-1.5 py-1 text-right'>
                  {formatQuotationAmount(parseNum(item.qty) * unitPrice)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className='grid gap-5 text-xs md:grid-cols-2'>
        <div className='space-y-1 font-medium'>
          <div className='font-bold'># Note</div>
          <div className='whitespace-pre-line'>{quotationDetails.note}</div>
          <ReportTextRow label='# Delivery' value={quotationDetails.delivery} />
          <ReportTextRow label='# Price' value={quotationDetails.price} />
          <ReportTextRow label='# Payment' value={quotationDetails.payment} />
          <ReportTextRow
            label='# Stock Validity'
            value={quotationDetails.stockValidity}
          />
          <ReportTextRow
            label='# Price Validity'
            value={quotationDetails.priceValidity}
          />
        </div>
        <div className='self-start'>
          <ReportRow label='Sub Total' value={quotationSubtotal} />
          <ReportRow label='Discount' value={-quotationDiscount} />
          <ReportRow
            label='Total after discount'
            value={quotationAfterDiscount}
          />
          <ReportRow label={`PPN ${quotationPpnPct}%`} value={quotationPpn} />
          <div className='mt-1 bg-slate-100 p-2 text-sm font-bold'>
            <ReportRow
              label='TOTAL QUOTATION MUST BE PAID (IDR)'
              value={quotationTotal}
            />
          </div>
        </div>
      </div>
      <div className='flex items-end justify-between border-t pt-4'>
        <div>
          <div className='mb-2 text-xs font-bold'>ASSOCIATION MEMBER:</div>
          <div className='flex items-center gap-3'>
            {['4.png', '5.png', '6.png'].map((image) => (
              <img
                key={image}
                src={`/images/${image}`}
                alt='Association member'
                className='h-14 w-auto object-contain'
              />
            ))}
          </div>
        </div>
        <div className='text-right text-sm font-bold'>
          PT. HALUAN DAYA NIAGA<div className='mt-10 font-normal'>IRFAN</div>
        </div>
      </div>
    </div>
  )
}

function ReportTextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex gap-2'>
      <span className='shrink-0 font-bold'>{label} :</span>
      <span>{value}</span>
    </div>
  )
}

function ReportMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className='font-bold'>{label}</div>
      <div>{value}</div>
    </div>
  )
}

function ReportRow({ label, value }: { label: string; value: number }) {
  return (
    <div className='flex justify-between gap-3 py-0.5'>
      <span>{label} :</span>
      <span className='text-right'>{formatQuotationAmount(value)}</span>
    </div>
  )
}

// ─── Helper row components ────────────────────────────────────────────────────

function CostRow({
  label,
  labelColSpan = 2,
  noBorderRight = false,
  children,
}: {
  label: string
  labelColSpan?: number
  noBorderRight?: boolean
  children: React.ReactNode
}) {
  const quotationMode = useContext(QuotationModeContext)

  return (
    <tr className='border-b hover:bg-muted/10'>
      <td className='border-r' />
      <td
        className={`${noBorderRight ? '' : 'border-r'} px-2 py-0.5 text-xs font-medium`}
        colSpan={labelColSpan}
      >
        {label}
      </td>
      {children}
      {quotationMode && (
        <>
          <td className='border-r' />
          <td className='border-r' />
        </>
      )}
    </tr>
  )
}

function CostSubRow({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  const quotationMode = useContext(QuotationModeContext)

  return (
    <tr className='border-b hover:bg-muted/10'>
      <td className='border-r' />
      <td className='border-r' />
      <td
        className='border-r px-2 py-0.5 text-xs text-muted-foreground italic'
        colSpan={1}
      >
        {label}
      </td>
      {children}
      {quotationMode && (
        <>
          <td className='border-r' />
          <td className='border-r' />
        </>
      )}
    </tr>
  )
}

function QuotationSummaryRow({
  label,
  value,
  strong = false,
}: {
  label: React.ReactNode
  value: number
  strong?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_120px] border-b border-dotted py-1 ${strong ? 'font-bold' : ''}`}
    >
      <span>{label}</span>
      <span className='text-right'>{formatQuotationAmount(value)}</span>
    </div>
  )
}

function formatQuotationAmount(value: number) {
  return Math.round(value).toLocaleString('id-ID')
}
