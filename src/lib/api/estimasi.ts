import { fetchApi } from '../api'

export interface EstimasiList {
  id: number
  judul: string
  noQuo: string
  createdAt: string
  updatedAt: string
}

export interface EstimasiFull extends EstimasiList {
  formInfo: any
  items: any[]
  costs: any
}

export interface SaveEstimasiData {
  judul: string
  formInfo: any
  items: any[]
  costs: any
}

export const getEstimasiList = () => {
  return fetchApi<EstimasiList[]>('/estimasi')
}

export const getEstimasi = (id: number) => {
  return fetchApi<EstimasiFull>(`/estimasi/${id}`)
}

export const updateEstimasi = (id: number, data: SaveEstimasiData) => {
  return fetchApi<EstimasiList>(`/estimasi/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export const getEstimasiByNoQuo = (noQuo: string) => {
  return fetchApi<EstimasiFull>(
    `/estimasi/by-no-quo/${encodeURIComponent(noQuo)}`
  )
}

export const updateEstimasiByNoQuo = (
  noQuo: string,
  data: SaveEstimasiData
) => {
  return fetchApi<EstimasiList>(
    `/estimasi/by-no-quo/${encodeURIComponent(noQuo)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  )
}

export const saveEstimasi = (data: SaveEstimasiData) => {
  return fetchApi<EstimasiList>('/estimasi', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const deleteEstimasi = (id: number) => {
  return fetchApi<{ success: boolean }>(`/estimasi/${id}`, {
    method: 'DELETE',
  })
}
