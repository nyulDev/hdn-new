import { describe, expect, it } from 'vitest'
import { getQuotationAfterDiscount, getQuotationSubtotal } from './profit'

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
})
