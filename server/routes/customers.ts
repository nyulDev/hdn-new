import { Router } from 'express';
import { sql } from '../db';

const router = Router();

// GET all customers
router.get('/', async (req, res) => {
  try {
    const customers = await sql`SELECT * FROM customers ORDER BY id DESC`;
    // camelCase conversion
    const formatted = customers.map(c => ({
      id: c.kode,
      pt: c.pt,
      namaKapal: c.nama_kapal,
      kontak: c.kontak,
      alamat: c.alamat,
      createdAt: c.created_at,
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Failed to get customers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST new customer
router.post('/', async (req, res) => {
  const { pt, namaKapal, kontak, alamat } = req.body;
  try {
    // Generate kode (e.g. CUST-001)
    const result = await sql`SELECT kode FROM customers ORDER BY id DESC LIMIT 1`;
    let nextNum = 1;
    if (result.length > 0 && result[0].kode) {
      const numStr = result[0].kode.replace('CUST-', '');
      nextNum = parseInt(numStr, 10) + 1;
    }
    const kode = `CUST-${String(nextNum).padStart(3, '0')}`;

    const newCustomer = await sql`
      INSERT INTO customers (kode, pt, nama_kapal, kontak, alamat)
      VALUES (${kode}, ${pt}, ${namaKapal}, ${kontak}, ${alamat})
      RETURNING *
    `;
    
    const c = newCustomer[0];
    res.status(201).json({
      id: c.kode,
      pt: c.pt,
      namaKapal: c.nama_kapal,
      kontak: c.kontak,
      alamat: c.alamat,
      createdAt: c.created_at,
    });
  } catch (error) {
    console.error('Failed to create customer:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT update customer
router.put('/:kode', async (req, res) => {
  const { kode } = req.params;
  const { pt, namaKapal, kontak, alamat } = req.body;
  try {
    const updated = await sql`
      UPDATE customers
      SET pt = ${pt}, nama_kapal = ${namaKapal}, kontak = ${kontak}, alamat = ${alamat}
      WHERE kode = ${kode}
      RETURNING *
    `;
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const c = updated[0];
    res.json({
      id: c.kode,
      pt: c.pt,
      namaKapal: c.nama_kapal,
      kontak: c.kontak,
      alamat: c.alamat,
      createdAt: c.created_at,
    });
  } catch (error) {
    console.error('Failed to update customer:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE customer
router.delete('/:kode', async (req, res) => {
  const { kode } = req.params;
  try {
    const deleted = await sql`DELETE FROM customers WHERE kode = ${kode} RETURNING id`;
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete customer:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
