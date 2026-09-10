import { useEffect, useState, useMemo } from 'react'
import {
  Building2,
  Pencil,
  Plus,
  Search as SearchIcon,
  Ship,
  Trash2,
  Users,
} from 'lucide-react'
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  Customer,
  CreateCustomerData,
} from '@/lib/api/customers'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = CreateCustomerData

const emptyForm: FormData = {
  kode: '',
  pt: '',
  namaKapal: '',
  kontak: '',
  alamat: '',
  bansos: false,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const data = await getCustomers()
      setCustomers(data)
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setLoading(false)
    }
  }

  // dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  // ── filtered list ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.pt.toLowerCase().includes(q) ||
        c.namaKapal.toLowerCase().includes(q) ||
        c.kontak.toLowerCase().includes(q) ||
        c.alamat.toLowerCase().includes(q)
    )
  }, [customers, search])

  // ── open add ──
  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setErrors({})
    setFormOpen(true)
  }

  // ── open edit ──
  const openEdit = (c: Customer) => {
    setEditTarget(c)
    setForm({
      kode: c.id,
      pt: c.pt,
      namaKapal: c.namaKapal,
      kontak: c.kontak,
      alamat: c.alamat,
      bansos: c.bansos,
    })
    setErrors({})
    setFormOpen(true)
  }

  // ── validate ──
  const validate = (): boolean => {
    const e: Partial<FormData> = {}
    if (!form.kode.trim()) e.kode = 'Customer ID wajib diisi'
    if (!form.pt.trim()) e.pt = 'PT wajib diisi'
    if (!form.namaKapal.trim()) e.namaKapal = 'Nama Kapal wajib diisi'
    if (!form.kontak.trim()) e.kontak = 'Kontak wajib diisi'
    if (!form.alamat.trim()) e.alamat = 'Alamat wajib diisi'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── save ──
  const handleSave = async () => {
    if (!validate()) return

    try {
      if (editTarget) {
        const updated = await updateCustomer(editTarget.id, form)
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        )
      } else {
        const created = await createCustomer(form)
        setCustomers((prev) => [created, ...prev])
      }
      setFormOpen(false)
    } catch (error) {
      console.error('Save failed:', error)
      alert('Gagal menyimpan data')
    }
  }

  // ── delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCustomer(deleteTarget.id)
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Gagal menghapus data')
    }
  }

  const setField = (field: keyof FormData, value: FormData[typeof field]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <Header>
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        {/* Page title */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Customer</h1>
            <p className='mt-0.5 text-sm text-muted-foreground'>
              Kelola data pelanggan dan armada kapal
            </p>
          </div>
          <Button className='gap-2' onClick={openAdd}>
            <Plus className='h-4 w-4' />
            Tambah Customer
          </Button>
        </div>

        {/* Summary cards */}
        <div className='mb-6 grid gap-4 sm:grid-cols-3'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Total Customer
              </CardTitle>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{customers.length}</div>
              <p className='text-xs text-muted-foreground'>
                pelanggan terdaftar
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Perusahaan</CardTitle>
              <Building2 className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {new Set(customers.map((c) => c.pt)).size}
              </div>
              <p className='text-xs text-muted-foreground'>PT unik</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Armada Kapal
              </CardTitle>
              <Ship className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {new Set(customers.map((c) => c.namaKapal)).size}
              </div>
              <p className='text-xs text-muted-foreground'>kapal unik</p>
            </CardContent>
          </Card>
        </div>

        {/* Table card */}
        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <CardTitle>Daftar Customer</CardTitle>
                <CardDescription className='mt-0.5'>
                  {filtered.length} dari {customers.length} data ditampilkan
                </CardDescription>
              </div>
              {/* Search */}
              <div className='relative w-64'>
                <SearchIcon className='absolute top-2.5 left-2.5 h-3.5 w-3.5 text-muted-foreground' />
                <Input
                  placeholder='Cari customer...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='h-8 pl-8 text-xs'
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className='p-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-28'>Customer ID</TableHead>
                  <TableHead>PT</TableHead>
                  <TableHead>Nama Kapal</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead className='w-24 text-center'>Bansos</TableHead>
                  <TableHead className='w-20 text-center'>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='py-16 text-center text-muted-foreground'
                    >
                      Memuat data customer...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='py-16 text-center text-muted-foreground'
                    >
                      {search
                        ? `Tidak ada hasil untuk "${search}"`
                        : 'Belum ada data customer.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} className='hover:bg-muted/40'>
                      <TableCell>
                        <Badge variant='outline' className='font-mono text-xs'>
                          {c.id}
                        </Badge>
                      </TableCell>
                      <TableCell className='font-medium'>{c.pt}</TableCell>
                      <TableCell>{c.namaKapal}</TableCell>
                      <TableCell className='text-muted-foreground'>
                        {c.kontak}
                      </TableCell>
                      <TableCell className='max-w-[200px] truncate text-muted-foreground'>
                        {c.alamat}
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant={c.bansos ? 'default' : 'outline'}>
                          {c.bansos ? 'ON' : 'OFF'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center justify-center gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className='h-3.5 w-3.5' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 text-destructive hover:text-destructive'
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Main>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className='sm:max-w-[520px]'>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Edit Customer' : 'Tambah Customer Baru'}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? `Perbarui data customer ${editTarget.id}`
                : 'Isi semua field di bawah untuk mendaftarkan customer baru.'}
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-2'>
            {/* Customer ID is manual for new customers and fixed when editing. */}
            <div className='grid gap-1.5'>
              <Label htmlFor='kode' className='text-xs font-semibold'>
                Customer ID <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='kode'
                value={form.kode}
                onChange={(e) => setField('kode', e.target.value)}
                placeholder='Contoh: CUST-001'
                readOnly={!!editTarget}
                className={`h-9 font-mono text-sm ${editTarget ? 'bg-muted/40' : ''} ${errors.kode ? 'border-destructive' : ''}`}
              />
              {errors.kode && (
                <p className='text-xs text-destructive'>{errors.kode}</p>
              )}
            </div>

            {/* PT */}
            <div className='grid gap-1.5'>
              <Label htmlFor='pt' className='text-xs font-semibold'>
                PT <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='pt'
                value={form.pt}
                onChange={(e) => setField('pt', e.target.value)}
                placeholder='Contoh: PT. Samudera Indonesia'
                className={`h-9 text-sm ${errors.pt ? 'border-destructive' : ''}`}
              />
              {errors.pt && (
                <p className='text-xs text-destructive'>{errors.pt}</p>
              )}
            </div>

            {/* Nama Kapal */}
            <div className='grid gap-1.5'>
              <Label htmlFor='namaKapal' className='text-xs font-semibold'>
                Nama Kapal <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='namaKapal'
                value={form.namaKapal}
                onChange={(e) => setField('namaKapal', e.target.value)}
                placeholder='Contoh: MV. SINAR BINTAN'
                className={`h-9 text-sm ${errors.namaKapal ? 'border-destructive' : ''}`}
              />
              {errors.namaKapal && (
                <p className='text-xs text-destructive'>{errors.namaKapal}</p>
              )}
            </div>

            {/* Kontak */}
            <div className='grid gap-1.5'>
              <Label htmlFor='kontak' className='text-xs font-semibold'>
                Kontak <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='kontak'
                value={form.kontak}
                onChange={(e) => setField('kontak', e.target.value)}
                placeholder='Nomor telepon / HP'
                className={`h-9 text-sm ${errors.kontak ? 'border-destructive' : ''}`}
              />
              {errors.kontak && (
                <p className='text-xs text-destructive'>{errors.kontak}</p>
              )}
            </div>

            {/* Alamat */}
            <div className='grid gap-1.5'>
              <Label htmlFor='alamat' className='text-xs font-semibold'>
                Alamat <span className='text-destructive'>*</span>
              </Label>
              <Textarea
                id='alamat'
                value={form.alamat}
                onChange={(e) => setField('alamat', e.target.value)}
                placeholder='Alamat lengkap perusahaan'
                rows={3}
                className={`resize-none text-sm ${errors.alamat ? 'border-destructive' : ''}`}
              />
              {errors.alamat && (
                <p className='text-xs text-destructive'>{errors.alamat}</p>
              )}
            </div>

            {/* Bansos */}
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div className='space-y-0.5'>
                <Label htmlFor='bansos' className='text-xs font-semibold'>
                  Bansos
                </Label>
                <p className='text-xs text-muted-foreground'>
                  Aktifkan status bantuan sosial customer
                </p>
              </div>
              <Switch
                id='bansos'
                checked={form.bansos}
                onCheckedChange={(checked) => setField('bansos', checked)}
                aria-label='Status bansos'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>
              {editTarget ? 'Simpan Perubahan' : 'Tambah Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Data customer{' '}
              <span className='font-semibold text-foreground'>
                {deleteTarget?.id} — {deleteTarget?.pt}
              </span>{' '}
              akan dihapus permanen dan tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
