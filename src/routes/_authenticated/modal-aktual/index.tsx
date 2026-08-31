import { createFileRoute } from '@tanstack/react-router'
import { ModalAktualPage } from '@/features/modal-aktual/page'

export const Route = createFileRoute('/_authenticated/modal-aktual/')({
  component: ModalAktualPage,
})
