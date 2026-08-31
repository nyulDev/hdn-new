import type { User } from '@/features/users/data/schema'
import { fetchApi } from '../api'

export type UserPayload = Omit<
  User,
  'id' | 'status' | 'createdAt' | 'updatedAt'
> & {
  password: string
}

export const getUsers = () => fetchApi<User[]>('/users')

export const loginUser = (email: string, password: string) =>
  fetchApi<{ token: string; user: User }>('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const createUser = (data: UserPayload) =>
  fetchApi<User>('/users', { method: 'POST', body: JSON.stringify(data) })

export const updateUser = (id: string, data: UserPayload) =>
  fetchApi<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteUser = (id: string) =>
  fetchApi<{ success: boolean }>(`/users/${id}`, { method: 'DELETE' })
