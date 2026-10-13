import { describe, expect, it } from 'vitest'
import {
  getModalSubtotal,
  getQuotationAfterDiscount,
  getQuotationSubtotal,
} from './profit'

describe('profit quotation helpers', () => {
  it('returns the quotation subtotal before discount', () => {
    const data = {
      formInfo: { quotationRange: '100', quotationDiscountPct: '10' },
      items: [
        { qty: '2', unitPrice: '10000', unitPriceQuo: '' },
        { qty: '3', unitPrice: '5000', unitPriceQuo: '15000' },
      ],
    }

    expect(getQuotationSubtotal(data)).toBe(65000)
    expect(getQuotationAfterDiscount(data)).toBe(58500)
  })

  it('matches the Modal Estimasi Sub Total calculation', () => {
    const data = {
      items: [{ qty: '2', unitPrice: '10000' }],
      costs: {
        discountPct: '-2',
        qtyBankCharge: '1',
        bankChargeUsd: '100',
        dutyTaxPct: '25',
        qtyLocalCost: '2',
        localCostUsd: '500',
        usdRate: '16000',
        qtyFeeKurir: '1',
        feeKurir: '100',
        qtyTruk: '1',
        trukLs: '9000',
        qtyServiceboat: '1',
        serviceboatLs: '9000',
        qtyLainLain: '1',
        lainLainLs: '9000',
        otherCosts: [{ qty: '1', unitPrice: '250' }],
      },
    }

    expect(getModalSubtotal(data)).toBe(25950)
  })

  it('uses the saved Modal Estimasi Sub Total on the Profit page', () => {
    expect(
      getModalSubtotal({
        formInfo: { modalEstimasiSubtotal: 690000 },
        items: [{ qty: '3', unitPrice: '230000' }],
        costs: { qtyBankCharge: '1', bankChargeUsd: '18000' },
      })
    ).toBe(690000)
  })
})
