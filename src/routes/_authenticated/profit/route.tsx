import { createFileRoute } from '@tanstack/react-router'
import { Profit } from '@/features/profit'

export const Route = createFileRoute('/_authenticated/profit')({
  component: Profit,
})
