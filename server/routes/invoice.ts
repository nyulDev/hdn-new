import { Router } from 'express'
import { sql } from '../db'

const router = Router()

const mapInvoice = (row: any) => ({
  id: row.id,
  noQuo: row.no_quo,
  judul: row.judul,
  customerName: row.customer_name,
  amount: Number(row.amount ?? 0),
  status: row.status ?? 'belum_dibayar',
  formInfo: row.form_info ?? {},
  items: row.items ?? [],
  costs: row.costs ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

router.get('/', async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM invoice
      ORDER BY updated_at DESC
    `

    res.json(rows.map(mapInvoice))
  } catch (error) {
    console.error('Failed to get invoices:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.get('/by-no-quo/:noQuo', async (req, res) => {
  const { noQuo } = req.params

  try {
    const rows = await sql`
      SELECT * FROM invoice
      WHERE no_quo = ${noQuo}
      ORDER BY updated_at DESC
      LIMIT 1
    `

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice dengan No. Quo tersebut tidak ditemukan' })
    }

    res.json(mapInvoice(rows[0]))
  } catch (error) {
    console.error('Failed to get invoice by quotation number:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.post('/', async (req, res) => {
  const { noQuo, judul, customerName, amount, status, formInfo, items, costs } = req.body

  try {
    const inserted = await sql`
      INSERT INTO invoice (
        no_quo,
        judul,
        customer_name,
        amount,
        status,
        form_info,
        items,
        costs
      )
      VALUES (
        ${noQuo},
        ${judul},
        ${customerName},
        ${Number(amount ?? 0)},
        ${status ?? 'belum_dibayar'},
        ${JSON.stringify(formInfo ?? {})},
        ${JSON.stringify(items ?? [])},
        ${JSON.stringify(costs ?? {})}
      )
      RETURNING *
    `

    res.status(201).json(mapInvoice(inserted[0]))
  } catch (error) {
    console.error('Failed to create invoice:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { noQuo, judul, customerName, amount, status, formInfo, items, costs } = req.body

  try {
    const updated = await sql`
      UPDATE invoice
      SET
        no_quo = ${noQuo ?? sql`no_quo`},
        judul = ${judul ?? sql`judul`},
        customer_name = ${customerName ?? sql`customer_name`},
        amount = ${amount ?? sql`amount`},
        status = ${status ?? sql`status`},
        form_info = ${JSON.stringify(formInfo ?? {})},
        items = ${JSON.stringify(items ?? [])},
        costs = ${JSON.stringify(costs ?? {})},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    res.json(mapInvoice(updated[0]))
  } catch (error) {
    console.error('Failed to update invoice:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
