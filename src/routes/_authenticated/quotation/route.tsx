import { createFileRoute } from '@tanstack/react-router'
import { QuotationPage } from '@/features/quotation/page'

export const Route = createFileRoute('/_authenticated/quotation')({
  component: QuotationPage,
})
