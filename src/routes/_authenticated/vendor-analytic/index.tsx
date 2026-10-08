import { createFileRoute } from '@tanstack/react-router'
import { VendorAnalytic } from '@/features/vendor-analytic'

export const Route = createFileRoute('/_authenticated/vendor-analytic/')({
  component: VendorAnalytic,
})
