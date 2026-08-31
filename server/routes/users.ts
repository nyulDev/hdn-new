import { Router } from 'express'
import { promisify } from 'node:util'
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { sql } from '../db'

const router = Router()
const scryptAsync = promisify(scrypt)

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('hex')
  const key = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${key.toString('hex')}`
}

const verifyPassword = async (password: string, storedPassword: string) => {
  const [salt, storedKey] = storedPassword.split(':')
  if (!salt || !storedKey) return password === storedPassword
  const key = (await scryptAsync(password, salt, 64)) as Buffer
  const storedBuffer = Buffer.from(storedKey, 'hex')
  return (
    storedBuffer.length === key.length && timingSafeEqual(storedBuffer, key)
  )
}

const mapUser = (user: any) => ({
  id: String(user.id),
  firstName: user.first_name,
  lastName: user.last_name,
  username: user.username,
  email: user.email,
  phoneNumber: user.phone_number,
  status: user.status,
  role: user.role,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
})

router.get('/', async (_req, res) => {
  try {
    const users = await sql`SELECT * FROM users ORDER BY created_at DESC`
    res.json(users.map(mapUser))
  } catch (error) {
    console.error('Failed to get users:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/login', async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase()
  const password = String(req.body.password ?? '')
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' })
  }

  try {
    const result = await sql`
      SELECT * FROM users WHERE LOWER(email) = ${email} AND status = 'active' LIMIT 1
    `
    const user = result[0]
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email atau password salah' })
    }
    res.json({
      token: randomUUID(),
      user: mapUser(user),
    })
  } catch (error) {
    console.error('Failed to authenticate user:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/', async (req, res) => {
  const { firstName, lastName, username, email, phoneNumber, password, role } =
    req.body
  try {
    const passwordHash = await hashPassword(String(password ?? ''))
    const result = await sql`
      INSERT INTO users
        (first_name, last_name, username, email, phone_number, password_hash, role)
      VALUES
        (${firstName}, ${lastName}, ${username}, ${email}, ${phoneNumber}, ${passwordHash}, ${role})
      RETURNING *
    `
    res.status(201).json(mapUser(result[0]))
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Username atau email sudah digunakan' })
    }
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { firstName, lastName, username, email, phoneNumber, password, role } =
    req.body
  try {
    const passwordHash = password ? await hashPassword(String(password)) : ''
    const result = password
      ? await sql`
          UPDATE users
          SET first_name = ${firstName}, last_name = ${lastName}, username = ${username},
              email = ${email}, phone_number = ${phoneNumber}, password_hash = ${passwordHash},
              role = ${role}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `
      : await sql`
          UPDATE users
          SET first_name = ${firstName}, last_name = ${lastName}, username = ${username},
              email = ${email}, phone_number = ${phoneNumber}, role = ${role}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `
    if (!result.length) return res.status(404).json({ error: 'User not found' })
    res.json(mapUser(result[0]))
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Username atau email sudah digunakan' })
    }
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await sql`DELETE FROM users WHERE id = ${req.params.id} RETURNING id`
    if (!result.length) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router