import { createFileRoute } from '@tanstack/react-router'
import { ModalEstimasi } from '@/features/modal-estimasi/page'

export const Route = createFileRoute('/_authenticated/modal-estimasi/')({
  component: ModalEstimasi,
})
