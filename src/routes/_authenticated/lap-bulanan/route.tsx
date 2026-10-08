import { createFileRoute } from '@tanstack/react-router'
import { LapBulanan } from '@/features/lap-bulanan'

export const Route = createFileRoute('/_authenticated/lap-bulanan')({
  component: LapBulanan,
})
