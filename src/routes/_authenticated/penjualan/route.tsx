import { createFileRoute } from '@tanstack/react-router'
import { Penjualan } from '@/features/penjualan'

export const Route = createFileRoute('/_authenticated/penjualan')({
  component: Penjualan,
})
