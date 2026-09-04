import { createFileRoute } from '@tanstack/react-router'
import { TtbPage } from '@/features/ttb/page'

export const Route = createFileRoute('/_authenticated/ttb')({
  component: TtbPage,
})
