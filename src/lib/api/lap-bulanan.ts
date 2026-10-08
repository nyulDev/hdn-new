import { fetchApi } from '../api'

export interface LapBulananRow {
  noQuo: string
  noInvoice: string
  noPo: string
  namaKapal: string
  kasbon: number
  aktual: number
  selisih: number
  keterangan: string
  status: string
  tanggal: string
  invoiceId?: number
  isCarryOver?: boolean
}

export interface LapBulananNote {
  noQuo: string
  keterangan: string
  status: string
}

export const getLapBulanan = (params?: { bulan?: number; tahun?: number }) => {
  const qs = new URLSearchParams()
  if (params?.bulan) qs.set('bulan', String(params.bulan))
  if (params?.tahun) qs.set('tahun', String(params.tahun))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return fetchApi<LapBulananRow[]>(`/lap-bulanan${query}`)
}

export const saveLapBulananNotes = (notes: LapBulananNote[]) =>
  fetchApi<{ success: boolean; saved: number }>('/lap-bulanan/save', {
    method: 'POST',
    body: JSON.stringify(notes),
  })
