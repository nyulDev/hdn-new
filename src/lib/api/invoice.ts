import { fetchApi } from '../api'

export type InvoiceStatus = 'lunas' | 'belum_dibayar' | 'diproses'

export interface InvoiceRecord {
  id: number
  noQuo: string
  judul: string
  customerName: string
  amount: number
  status: InvoiceStatus
  formInfo: Record<string, any>
  items: any[]
  costs: any
  createdAt: string
  updatedAt: string
}

export const getInvoices = () => fetchApi<InvoiceRecord[]>('/invoice')

export const getInvoiceByNoQuo = (noQuo: string) =>
  fetchApi<InvoiceRecord>(`/invoice/by-no-quo/${encodeURIComponent(noQuo)}`)

export const createInvoice = (data: {
  noQuo: string
  judul: string
  customerName: string
  amount: number
  status: InvoiceStatus
  formInfo: Record<string, any>
  items: any[]
  costs: any
}) =>
  fetchApi<InvoiceRecord>('/invoice', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateInvoice = (
  id: number,
  data: Partial<{
    noQuo: string
    judul: string
    customerName: string
    amount: number
    status: InvoiceStatus
    formInfo: Record<string, any>
    items: any[]
    costs: any
  }>
) =>
  fetchApi<InvoiceRecord>(`/invoice/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
