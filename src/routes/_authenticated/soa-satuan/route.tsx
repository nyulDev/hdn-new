import { createFileRoute } from '@tanstack/react-router'
import { SoaSatuan } from '@/features/soa-satuan'

export const Route = createFileRoute('/_authenticated/soa-satuan')({
  component: SoaSatuan,
})
