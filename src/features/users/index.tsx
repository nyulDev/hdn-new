import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { getUsers } from '@/lib/api/users'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'
import type { User } from './data/schema'

const route = getRouteApi('/_authenticated/users/')

export function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const search = route.useSearch()
  const navigate = route.useNavigate()

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((error) => console.error('Failed to load users:', error))
      .finally(() => setLoading(false))
  }, [])

  const handleUserSaved = (user: User) =>
    setUsers((current) => {
      const exists = current.some((item) => item.id === user.id)
      return exists
        ? current.map((item) => (item.id === user.id ? user : item))
        : [user, ...current]
    })

  const handleUserDeleted = (id: string) =>
    setUsers((current) => current.filter((user) => user.id !== id))

  return (
    <UsersProvider>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>User List</h2>
            <p className='text-muted-foreground'>
              Manage your users and their roles here.
            </p>
          </div>
          <UsersPrimaryButtons />
        </div>
        <UsersTable
          data={loading ? [] : users}
          search={search}
          navigate={navigate}
        />
      </Main>

      <UsersDialogs
        onUserSaved={handleUserSaved}
        onUserDeleted={handleUserDeleted}
      />
    </UsersProvider>
  )
}
