import { useEffect, useState } from 'react'
import {
  getEstimasiByNoQuo,
  getEstimasiList,
  type EstimasiList,
} from '@/lib/api/estimasi'
import {
  getActualModalHsiAmount,
  getActualModalSubtotal,
  getModalHsiAmount,
  getModalSubtotal,
  getQuotationAfterDiscount,
  getQuotationSubtotal,
  parseQuotationNumber,
} from '@/lib/profit'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const initialValues = {
  invoiceActual: 0,
  invoiceEstimate: 0,
  modalActual: 0,
  modalEstimate: 0,
  bansosActual: 0,
  bansosEstimate: 0,
  investorActual: 0,
  investorEstimate: 0,
}

const formatAmount = (value: number) =>
  Math.round(value).toLocaleString('id-ID')

const formatPercent = (value: number) =>
  `${value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`

function AmountInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Input
      type='text'
      inputMode='decimal'
      value={value === 0 ? '' : formatAmount(value)}
      onChange={(event) => onChange(parseQuotationNumber(event.target.value))}
      className='h-7 rounded-none border-0 bg-transparent px-1 text-right font-mono text-sm text-blue-900 shadow-none focus-visible:ring-1 dark:text-blue-300'
    />
  )
}

export function Profit() {
  const [values, setValues] = useState(initialValues)
  const [noQuo, setNoQuo] = useState('')
  const [estimasiList, setEstimasiList] = useState<EstimasiList[]>([])
  const [loadingQuotation, setLoadingQuotation] = useState(false)
  const [department, setDepartment] = useState('')
  const [bansosActualPct, setBansosActualPct] = useState('5')
  const [bansosEstimatePct, setBansosEstimatePct] = useState('5')
  const [useBansos, setUseBansos] = useState(true)

  useEffect(() => {
    getEstimasiList()
      .then(setEstimasiList)
      .catch((error) =>
        console.error('Failed to load quotation numbers:', error)
      )
  }, [])

  const handleQuotationChange = async (selectedNoQuo: string) => {
    setNoQuo(selectedNoQuo)
    if (!selectedNoQuo) {
      setDepartment('')
      return
    }

    setLoadingQuotation(true)
    try {
      const data = await getEstimasiByNoQuo(selectedNoQuo)
      const invoiceEstimate = getQuotationAfterDiscount(data)
      const invoiceActual = getQuotationSubtotal(data)
      const actualModalSubtotal = getActualModalSubtotal(data)
      const hsiAmount = getModalHsiAmount(data)
      const actualHsiAmount = getActualModalHsiAmount(data)
      const loadedDepartment = String(data.formInfo?.dept ?? '').trim()
      const actualBansosAmount =
        invoiceActual > 0
          ? (invoiceActual / 1.15) *
            (parseQuotationNumber(bansosActualPct) / 100)
          : 0
      setDepartment(loadedDepartment)
      setValues((current) => ({
        ...current,
        invoiceActual,
        invoiceEstimate,
        modalActual: actualModalSubtotal,
        modalEstimate: getModalSubtotal(data),
        investorActual: actualHsiAmount,
        investorEstimate: hsiAmount,
        bansosActual: actualBansosAmount,
        bansosEstimate:
          invoiceEstimate * (parseQuotationNumber(bansosEstimatePct) / 100),
      }))
    } catch (error) {
      console.error('Failed to load quotation:', error)
    } finally {
      setLoadingQuotation(false)
    }
  }

  const updateValue = (field: keyof typeof values, value: number) =>
    setValues((current) => ({ ...current, [field]: value }))

  const grossActual = values.invoiceActual - values.modalActual
  const grossEstimate = values.invoiceEstimate - values.modalEstimate
  const investorShareActual = grossActual * 0.1
  const hsiEstimate = values.investorEstimate
  const paymentShares = [0.3, 0.2, 0.1, 0.03, 0]
  const appliedBansosActual = useBansos ? values.bansosActual : 0
  const appliedBansosEstimate = useBansos ? values.bansosEstimate : 0
  const netActual = grossActual - appliedBansosActual - investorShareActual
  const marketingShareEstimate = grossEstimate * paymentShares[2]
  const netEstimate =
    grossEstimate - appliedBansosEstimate - hsiEstimate - marketingShareEstimate
  const marketingTotal = Math.max(grossActual, 0)

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-4'>
          <h1 className='text-2xl font-bold tracking-tight'>Profit</h1>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            Analisis profit aktual dan estimasi PPn
          </p>
        </div>
        <div className='mb-4 flex items-center gap-2'>
          <label
            htmlFor='profit-no-quo'
            className='text-sm font-medium text-muted-foreground'
          >
            No. Quo
          </label>
          <Input
            id='profit-no-quo'
            value={noQuo}
            onChange={(event) => {
              const selectedNoQuo = event.target.value
              setNoQuo(selectedNoQuo)
              if (
                estimasiList.some(
                  (estimasi) => estimasi.noQuo === selectedNoQuo
                )
              ) {
                void handleQuotationChange(selectedNoQuo)
              }
            }}
            list='profit-quotation-numbers'
            placeholder='Cari No. Quo...'
            disabled={loadingQuotation}
            className='h-8 w-56 text-xs'
          />
          <datalist id='profit-quotation-numbers'>
            {estimasiList
              .filter((estimasi) => estimasi.noQuo)
              .map((estimasi) => (
                <option key={estimasi.id} value={estimasi.noQuo} />
              ))}
          </datalist>
        </div>
        <div className='overflow-x-auto rounded-md border bg-background shadow-sm'>
          <table className='w-full min-w-[780px] border-collapse font-mono text-sm'>
            <thead>
              <tr className='border-b bg-muted/50 text-blue-950 dark:text-blue-200'>
                <th className='w-64 border-r px-2 py-2 text-left font-normal' />
                <th className='w-40 border-r px-2 py-2 text-center font-bold'>
                  AKTUAL
                </th>
                <th className='w-24 border-r px-2 py-2 text-center font-normal' />
                <th className='w-40 border-r px-2 py-2 text-center font-bold'>
                  ESTIMASI PPn
                </th>
                <th className='w-24 px-2 py-2 text-center font-normal' />
              </tr>
            </thead>
            <tbody className='text-blue-950 dark:text-blue-200'>
              <ProfitRow label='1. INVOICE'>
                <AmountInput
                  value={values.invoiceActual}
                  onChange={(v) => updateValue('invoiceActual', v)}
                />
                <td />
                <AmountInput
                  value={values.invoiceEstimate}
                  onChange={(v) => updateValue('invoiceEstimate', v)}
                />
                <td />
              </ProfitRow>
              <ProfitRow label='2. MODAL'>
                <AmountInput
                  value={values.modalActual}
                  onChange={(v) => updateValue('modalActual', v)}
                />
                <td />
                <AmountInput
                  value={values.modalEstimate}
                  onChange={(v) => updateValue('modalEstimate', v)}
                />
                <td />
              </ProfitRow>
              <ProfitRow label='3. GROSS PROFIT'>
                <td className='border-r px-2 py-1 text-right'>
                  {formatAmount(grossActual)}
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  {formatPercent((grossActual / values.invoiceActual) * 100)}
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  {formatAmount(grossEstimate)}
                </td>
                <td className='px-2 py-1 text-right'>
                  {formatPercent(
                    (grossEstimate / values.invoiceEstimate) * 100
                  )}
                </td>
              </ProfitRow>
              <tr>
                <td colSpan={5} className='h-3' />
              </tr>
              <ProfitRow label='4. PROFIT SHARING' className='font-medium'>
                <td colSpan={4} />
              </ProfitRow>
              <ProfitSubRow
                label={
                  <span className='flex items-center gap-2'>
                    <span>a. BANSOS</span>
                    <Checkbox
                      checked={useBansos}
                      onCheckedChange={(checked) =>
                        setUseBansos(checked === true)
                      }
                      aria-label='Gunakan Bansos'
                    />
                  </span>
                }
              >
                <td className='border-r px-2 py-1 text-right text-red-600'>
                  {formatAmount(appliedBansosActual)}
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Input
                      type='number'
                      min='0'
                      max='100'
                      value={useBansos ? bansosActualPct : '0'}
                      onChange={(event) => {
                        const percentage = event.target.value
                        setBansosActualPct(percentage)
                        updateValue(
                          'bansosActual',
                          values.invoiceActual > 0
                            ? (values.invoiceActual / 1.15) *
                                (parseQuotationNumber(percentage) / 100)
                            : 0
                        )
                      }}
                      disabled={!useBansos}
                      className='h-7 w-14 border-0 bg-transparent p-0 text-right font-mono text-sm shadow-none focus-visible:ring-1'
                    />
                    %
                  </div>
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  {formatAmount(appliedBansosEstimate)}
                </td>
                <td className='px-2 py-1 text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Input
                      type='number'
                      min='0'
                      max='100'
                      value={useBansos ? bansosEstimatePct : '0'}
                      onChange={(event) => {
                        const percentage = event.target.value
                        setBansosEstimatePct(percentage)
                        updateValue(
                          'bansosEstimate',
                          values.invoiceEstimate *
                            (parseQuotationNumber(percentage) / 100)
                        )
                      }}
                      disabled={!useBansos}
                      className='h-7 w-14 border-0 bg-transparent p-0 text-right font-mono text-sm shadow-none focus-visible:ring-1'
                    />
                    %
                  </div>
                </td>
              </ProfitSubRow>
              <ProfitSubRow label='b. INVESTOR'>
                <td colSpan={4} />
              </ProfitSubRow>
              <ProfitSubRow label='i. H S I --> 2 bulan'>
                <td className='border-r px-2 py-1 text-right text-red-600'>
                  {formatAmount(values.investorActual)}
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  {formatAmount(values.modalActual)}
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  {formatAmount(hsiEstimate)}
                </td>
                <td className='px-2 py-1 text-right'>
                  {formatAmount(values.modalEstimate)}
                </td>
              </ProfitSubRow>
              <ProfitSubRow
                label={`c. ${department ? `${department} ` : ''}(Net Profit)`}
              >
                <td className='border-r px-2 py-1 text-right font-bold text-red-600'>
                  {formatAmount(netActual)}
                </td>
                <td className='border-r px-2 py-1 text-right'>
                  {formatPercent((netActual / grossActual) * 100)}
                </td>
                <td className='border-r px-2 py-1 text-right font-bold'>
                  {formatAmount(netEstimate)}
                </td>
                <td className='px-2 py-1 text-right'>
                  {formatPercent(
                    values.modalEstimate !== 0
                      ? (netEstimate / values.modalEstimate) * 100
                      : 0
                  )}
                </td>
              </ProfitSubRow>
              <tr>
                <td colSpan={5} className='h-3' />
              </tr>
              <tr className='border-b'>
                <td colSpan={5} className='px-2 py-1'>
                  5. SHARING Marketing Fee
                </td>
              </tr>
              <tr className='border-b text-center'>
                <td className='border-r px-2 py-1'>Payment</td>
                {[
                  'Cash',
                  '0–30 days',
                  '31–60 days',
                  '61–90 days',
                  '> 90 days',
                ].map((label) => (
                  <td
                    key={label}
                    className='border-r px-2 py-1 last:border-r-0'
                  >
                    {label}
                  </td>
                ))}
              </tr>
              <tr className='border-b text-center'>
                <td className='border-r px-2 py-1'>Presentase</td>
                {paymentShares.map((share, index) => (
                  <td
                    key={index}
                    className={`border-r px-2 py-1 last:border-r-0 ${index === 2 ? 'bg-yellow-300 text-black' : ''}`}
                  >
                    {formatPercent(share * 100)}
                  </td>
                ))}
              </tr>
              <tr className='text-center'>
                <td className='border-r px-2 py-1'>Nilai (Rp)</td>
                {paymentShares.map((share, index) => (
                  <td
                    key={index}
                    className={`border-r px-2 py-1 last:border-r-0 ${index === 2 ? 'bg-yellow-300 font-bold text-red-600' : ''}`}
                  >
                    {formatAmount(marketingTotal * share)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Main>
    </>
  )
}

function ProfitRow({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <tr className={`border-b ${className}`}>
      <td className='border-r px-2 py-1'>{label}</td>
      {children}
    </tr>
  )
}

function ProfitSubRow({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <tr className='border-b'>
      <td className='border-r px-5 py-1'>{label}</td>
      {children}
    </tr>
  )
}
