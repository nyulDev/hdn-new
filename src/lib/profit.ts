// Shared profit calculation helpers used by the Profit page and the
// Quotation (ModalEstimasi) page so both pages produce identical values.

export const parseQuotationNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  const text = String(value ?? '').trim()
  if (!text) return 0
  return (
    parseFloat(
      text.replace(/,/g, '').replace(/\./g, (separator, index, source) => {
        const rest = source.slice(index + 1)
        return /^\d{3}(\.|,|$)/.test(rest) ? '' : separator
      })
    ) || 0
  )
}

export const getQuotationSubtotal = (data: {
  formInfo?: Record<string, unknown>
  items?: Array<Record<string, unknown>>
}) => {
  const formInfo = data.formInfo ?? {}
  const range = parseQuotationNumber(formInfo.quotationRange)

  return (data.items ?? []).reduce((total, item) => {
    const manualUnitPrice = parseQuotationNumber(item.unitPriceQuo)
    const unitPrice =
      manualUnitPrice || (parseQuotationNumber(item.unitPrice) * range) / 100
    return total + parseQuotationNumber(item.qty) * unitPrice
  }, 0)
}

export const getQuotationAfterDiscount = (data: {
  formInfo?: Record<string, unknown>
  items?: Array<Record<string, unknown>>
}) => {
  const formInfo = data.formInfo ?? {}
  const quotationTotalAfterDiscount = formInfo.quotationTotalAfterDiscount
  if (
    quotationTotalAfterDiscount !== undefined &&
    quotationTotalAfterDiscount !== null &&
    String(quotationTotalAfterDiscount).trim() !== ''
  ) {
    return parseQuotationNumber(quotationTotalAfterDiscount)
  }
  const invoiceTotalAfterDiscount = formInfo.invoiceTotalAfterDiscount
  if (
    invoiceTotalAfterDiscount !== undefined &&
    invoiceTotalAfterDiscount !== null &&
    String(invoiceTotalAfterDiscount).trim() !== ''
  ) {
    return parseQuotationNumber(invoiceTotalAfterDiscount)
  }
  const subtotal = getQuotationSubtotal(data)
  const quotationDiscountAmount = formInfo.quotationDiscountAmount
  if (
    quotationDiscountAmount !== undefined &&
    quotationDiscountAmount !== null &&
    String(quotationDiscountAmount).trim() !== ''
  ) {
    return subtotal - parseQuotationNumber(quotationDiscountAmount)
  }
  const discount = parseQuotationNumber(formInfo.quotationDiscountPct)
  return subtotal * (1 - discount / 100)
}

export const getModalSubtotal = (data: {
  items?: Array<Record<string, unknown>>
  costs?: Record<string, unknown>
  formInfo?: Record<string, unknown>
}) => {
  const storedSubtotal = data.formInfo?.modalEstimasiSubtotal
  if (
    storedSubtotal !== undefined &&
    storedSubtotal !== null &&
    String(storedSubtotal).trim() !== ''
  ) {
    return parseQuotationNumber(storedSubtotal)
  }
  const items = data.items ?? []
  const costs = data.costs ?? {}
  const totalModalSparepart = items.reduce(
    (total, item) =>
      total +
      parseQuotationNumber(item.qty) * parseQuotationNumber(item.unitPrice),
    0
  )
  const discountPct = parseQuotationNumber(costs.discountPct)
  const afterDiscount =
    totalModalSparepart + (discountPct / 100) * totalModalSparepart
  const usdRate = parseQuotationNumber(costs.usdRate)
  const otherCostsTotal = (
    (costs.otherCosts as Array<Record<string, unknown>>) ?? []
  ).reduce(
    (total, cost) =>
      total +
      parseQuotationNumber(cost.qty) * parseQuotationNumber(cost.unitPrice),
    0
  )
  const costsTotal =
    parseQuotationNumber(costs.qtyBankCharge) *
      parseQuotationNumber(costs.bankChargeUsd) +
    parseQuotationNumber(costs.qtyPackingCost) *
      parseQuotationNumber(costs.packingCostUsd) +
    (parseQuotationNumber(costs.dutyTaxPct) / 100) * afterDiscount +
    parseQuotationNumber(costs.qtyAirDhl) *
      parseQuotationNumber(costs.airDhlKgs) +
    parseQuotationNumber(costs.qtyAirDoor) *
      parseQuotationNumber(costs.airDoorKgs) +
    parseQuotationNumber(costs.qtySeaResmi) *
      parseQuotationNumber(costs.seaResmiCbm) +
    parseQuotationNumber(costs.qtySeaDoor) *
      parseQuotationNumber(costs.seaDoorCbm) +
    parseQuotationNumber(costs.qtyLocalCost) *
      parseQuotationNumber(costs.localCostUsd) *
      usdRate +
    parseQuotationNumber(costs.qtyFeeKurir) *
      parseQuotationNumber(costs.feeKurir) +
    parseQuotationNumber(costs.qtyTruk) * parseQuotationNumber(costs.trukLs) +
    parseQuotationNumber(costs.qtyServiceboat) *
      parseQuotationNumber(costs.serviceboatLs) +
    parseQuotationNumber(costs.qtyLainLain) *
      parseQuotationNumber(costs.lainLainLs) +
    otherCostsTotal

  return afterDiscount + costsTotal
}

export const getActualItemSubtotal = (item: Record<string, unknown>) => {
  const rawAmountActual = item.amountActual
  if (
    rawAmountActual !== undefined &&
    rawAmountActual !== null &&
    String(rawAmountActual).trim() !== ''
  ) {
    return parseQuotationNumber(rawAmountActual)
  }

  const qtyActual = parseQuotationNumber(item.qtyActual ?? item.qty)
  const unitPriceActual = parseQuotationNumber(
    item.unitPriceActual ?? item.unitPrice
  )
  const variantSubtotal = (
    (item.actualPriceVariants as Array<Record<string, unknown>>) ?? []
  ).reduce(
    (total, variant) =>
      total +
      parseQuotationNumber(variant.qtyActual ?? item.qtyActual ?? item.qty) *
        parseQuotationNumber(variant.price),
    0
  )

  return qtyActual * unitPriceActual + variantSubtotal
}

export const getActualModalSubtotal = (data: {
  items?: Array<Record<string, unknown>>
  costs?: Record<string, unknown>
  formInfo?: Record<string, unknown>
}) => {
  const storedSubtotal = data.formInfo?.modalAktualSubtotal
  if (
    storedSubtotal !== undefined &&
    storedSubtotal !== null &&
    String(storedSubtotal).trim() !== ''
  ) {
    return parseQuotationNumber(storedSubtotal)
  }
  const items = data.items ?? []
  const costs = data.costs ?? {}
  const totalModalSparepart = items.reduce(
    (total, item) => total + getActualItemSubtotal(item),
    0
  )
  const discountPct = parseQuotationNumber(costs.discountPct)
  const afterDiscount =
    totalModalSparepart + (discountPct / 100) * totalModalSparepart
  const usdRate = parseQuotationNumber(costs.usdRate)
  const otherCostsTotal = (
    (costs.otherCosts as Array<Record<string, unknown>>) ?? []
  ).reduce(
    (total, cost) =>
      total +
      parseQuotationNumber(cost.qty) * parseQuotationNumber(cost.unitPrice),
    0
  )
  const costsTotal =
    parseQuotationNumber(costs.qtyBankCharge) *
      parseQuotationNumber(costs.bankChargeUsd) +
    parseQuotationNumber(costs.qtyPackingCost) *
      parseQuotationNumber(costs.packingCostUsd) +
    (parseQuotationNumber(costs.dutyTaxPct) / 100) * afterDiscount +
    parseQuotationNumber(costs.qtyAirDhl) *
      parseQuotationNumber(costs.airDhlKgs) +
    parseQuotationNumber(costs.qtyAirDoor) *
      parseQuotationNumber(costs.airDoorKgs) +
    parseQuotationNumber(costs.qtySeaResmi) *
      parseQuotationNumber(costs.seaResmiCbm) +
    parseQuotationNumber(costs.qtySeaDoor) *
      parseQuotationNumber(costs.seaDoorCbm) +
    parseQuotationNumber(costs.qtyLocalCost) *
      parseQuotationNumber(costs.localCostUsd) *
      usdRate +
    parseQuotationNumber(costs.qtyFeeKurir) *
      parseQuotationNumber(costs.feeKurir) +
    parseQuotationNumber(costs.qtyTruk) * parseQuotationNumber(costs.trukLs) +
    parseQuotationNumber(costs.qtyServiceboat) *
      parseQuotationNumber(costs.serviceboatLs) +
    parseQuotationNumber(costs.qtyLainLain) *
      parseQuotationNumber(costs.lainLainLs) +
    otherCostsTotal

  return afterDiscount + costsTotal
}

export const getModalHsiAmount = (data: {
  items?: Array<Record<string, unknown>>
  costs?: Record<string, unknown>
}) =>
  getModalSubtotal(data) * (parseQuotationNumber(data.costs?.investorPct) / 100)

export const getActualModalHsiAmount = (data: {
  items?: Array<Record<string, unknown>>
  costs?: Record<string, unknown>
}) =>
  getActualModalSubtotal(data) *
  (parseQuotationNumber(data.costs?.investorPct) / 100)

// Nilai persentase "c. (Net Profit)" pada kolom ESTIMASI PPn di page Profit.
// Formula: (netEstimate / modalEstimate) * 100
// dengan netEstimate = grossEstimate - bansosEstimate - hsiEstimate - marketingShareEstimate
export const getNetProfitEstimatePct = (
  data: {
    formInfo?: Record<string, unknown>
    items?: Array<Record<string, unknown>>
    costs?: Record<string, unknown>
  },
  bansosEstimatePct = 5
) => {
  const invoiceEstimate = getQuotationAfterDiscount(data)
  const modalEstimate = getModalSubtotal(data)
  const hsiEstimate = getModalHsiAmount(data)
  const grossEstimate = invoiceEstimate - modalEstimate
  const bansosEstimate = invoiceEstimate * (bansosEstimatePct / 100)
  const marketingShareEstimate = grossEstimate * 0.1
  const netEstimate =
    grossEstimate - bansosEstimate - hsiEstimate - marketingShareEstimate
  if (modalEstimate === 0) return 0
  return (netEstimate / modalEstimate) * 100
}
