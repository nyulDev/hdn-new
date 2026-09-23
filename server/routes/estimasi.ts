import { Router } from 'express';
import { sql } from '../db';

const router = Router();

// GET list of estimasi (just basic info)
router.get('/', async (req, res) => {
  try {
    const estimasiList = await sql`
      SELECT id, judul, form_info->>'noQuo' AS no_quo, created_at, updated_at
      FROM estimasi
      ORDER BY updated_at DESC
    `;
    const formatted = estimasiList.map(e => ({
      id: e.id,
      judul: e.judul,
      noQuo: e.no_quo,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Failed to get estimasi list:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET estimasi by quotation number
router.get('/by-no-quo/:noQuo', async (req, res) => {
  const { noQuo } = req.params;
  try {
    const result = await sql`
      SELECT * FROM estimasi
      WHERE form_info->>'noQuo' = ${noQuo}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Estimasi dengan No. Quo tersebut tidak ditemukan' });
    }
    const e = result[0];
    res.json({
      id: e.id,
      judul: e.judul,
      formInfo: e.form_info,
      items: e.items,
      costs: e.costs,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    });
  } catch (error) {
    console.error('Failed to get estimasi by quotation number:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// UPDATE the latest estimasi with a quotation number
router.put('/by-no-quo/:noQuo', async (req, res) => {
  const { noQuo } = req.params;
  const { judul, formInfo, items, costs } = req.body;
  try {
    const existing = await sql`
      SELECT id FROM estimasi
      WHERE form_info->>'noQuo' = ${noQuo}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Estimasi dengan No. Quo tersebut tidak ditemukan' });
    }
    const updated = await sql`
      UPDATE estimasi
      SET judul = ${judul},
          form_info = ${JSON.stringify(formInfo)},
          items = ${JSON.stringify(items)},
          costs = ${JSON.stringify(costs)},
          updated_at = NOW()
      WHERE id = ${existing[0].id}
      RETURNING id, judul, form_info->>'noQuo' AS no_quo, created_at, updated_at
    `;
    const e = updated[0];
    res.json({
      id: e.id,
      judul: e.judul,
      noQuo: e.no_quo,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    });
  } catch (error) {
    console.error('Failed to update estimasi by quotation number:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET single estimasi full data
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sql`SELECT * FROM estimasi WHERE id = ${id}`;
    if (result.length === 0) {
      return res.status(404).json({ error: 'Estimasi not found' });
    }
    const e = result[0];
    res.json({
      id: e.id,
      judul: e.judul,
      formInfo: e.form_info,
      items: e.items,
      costs: e.costs,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    });
  } catch (error) {
    console.error('Failed to get estimasi:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// UPDATE estimasi by id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { judul, formInfo, items, costs } = req.body;
  try {
    const updated = await sql`
      UPDATE estimasi
      SET judul = ${judul},
          form_info = ${JSON.stringify(formInfo)},
          items = ${JSON.stringify(items)},
          costs = ${JSON.stringify(costs)},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, judul, form_info->>'noQuo' AS no_quo, created_at, updated_at
    `;
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Estimasi not found' });
    }
    const e = updated[0];
    res.json({
      id: e.id,
      judul: e.judul,
      noQuo: e.no_quo,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    });
  } catch (error) {
    console.error('Failed to update estimasi:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', async (req, res) => {
  const { judul, formInfo, items, costs } = req.body;
  try {
    const newEstimasi = await sql`
      INSERT INTO estimasi (judul, form_info, items, costs)
      VALUES (${judul}, ${JSON.stringify(formInfo)}, ${JSON.stringify(items)}, ${JSON.stringify(costs)})
      RETURNING id, judul, created_at, updated_at
    `;
    const e = newEstimasi[0];
    res.status(201).json({
      id: e.id,
      judul: e.judul,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    });
  } catch (error) {
    console.error('Failed to create estimasi:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE estimasi
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await sql`DELETE FROM estimasi WHERE id = ${id} RETURNING id`;
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Estimasi not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete estimasi:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
