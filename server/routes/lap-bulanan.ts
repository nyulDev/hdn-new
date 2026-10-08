import { Router } from 'express'
import { sql } from '../db'

const router = Router()

// Ensure table exists on startup
const initTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS lap_bulanan_notes (
      no_quo      TEXT PRIMARY KEY,
      keterangan  TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'Progress',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}
initTable().catch((e) => console.error('Failed to init lap_bulanan_notes table:', e))

// ── GET /api/lap-bulanan
// Join estimasi + invoice + notes, filter by bulan/tahun
router.get('/', async (req, res) => {
  const { bulan, tahun } = req.query

  try {
    // Latest estimasi per noQuo
    const estimasiRows = await sql`
      SELECT DISTINCT ON (form_info->>'noQuo')
        id,
        judul,
        form_info->>'noQuo'      AS no_quo,
        form_info->>'noInvoice'  AS no_invoice_est,
        form_info->>'tanggal'    AS tanggal,
        items,
        costs,
        created_at,
        updated_at
      FROM estimasi
      WHERE form_info->>'noQuo' IS NOT NULL
        AND form_info->>'noQuo' != ''
      ORDER BY form_info->>'noQuo', updated_at DESC
    `

    // Latest invoice per noQuo
    const invoiceRows = await sql`
      SELECT DISTINCT ON (no_quo)
        id,
        no_quo,
        amount,
        form_info->>'noInvoice'  AS no_invoice,
        form_info->>'invoiceNo'  AS invoice_no,
        form_info->>'noPo'       AS no_po,
        form_info->>'noPO'       AS no_po2,
        form_info->>'tanggal'    AS tanggal,
        form_info->>'pt'         AS pt,
        form_info->>'kapal'      AS kapal,
        created_at,
        updated_at
      FROM invoice
      WHERE no_quo IS NOT NULL AND no_quo != ''
      ORDER BY no_quo, updated_at DESC
    `

    // Use the separately saved Modal Aktual total, not the invoice amount.
    const actualRows = await sql`
      SELECT DISTINCT ON (form_info->>'noQuo')
        form_info->>'noQuo' AS no_quo,
        form_info->>'modalAktualTotal' AS modal_aktual_total,
        form_info->>'modalAktualSubtotal' AS modal_aktual_subtotal,
        costs->>'investorPct' AS investor_pct
      FROM estimasi
      WHERE form_info->>'noQuo' IS NOT NULL
        AND form_info->>'noQuo' != ''
        AND (
          form_info->>'modalAktualTotal' IS NOT NULL
          OR form_info->>'modalAktualSubtotal' IS NOT NULL
        )
      ORDER BY form_info->>'noQuo', updated_at DESC
    `

    // All saved notes
    const notesRows = await sql`SELECT no_quo, keterangan, status, updated_at FROM lap_bulanan_notes`

    // Build maps
    const invoiceByNoQuo = new Map<string, any>()
    for (const inv of invoiceRows) {
      const key = String(inv.no_quo ?? '').trim()
      if (key) invoiceByNoQuo.set(key, inv)
    }

    const actualByNoQuo = new Map<string, (typeof actualRows)[number]>()
    for (const actual of actualRows) {
      const key = String(actual.no_quo ?? '').trim()
      if (key) actualByNoQuo.set(key, actual)
    }

    const notesByNoQuo = new Map<string, { keterangan: string; status: string; updated_at: Date }>()
    for (const n of notesRows) {
      notesByNoQuo.set(String(n.no_quo).trim(), {
        keterangan: n.keterangan,
        status: n.status,
        updated_at: new Date(n.updated_at),
      })
    }

    const results: any[] = []

    for (const est of estimasiRows) {
      const noQuo = String(est.no_quo ?? '').trim()
      if (!noQuo) continue

      // KASBON = sum of items amounts
      let kasbon = 0
      try {
        const items: any[] = Array.isArray(est.items)
          ? est.items
          : JSON.parse(est.items ?? '[]')
        for (const item of items) kasbon += Number(item.amount ?? 0)
      } catch {
        kasbon = 0
      }

      const inv = invoiceByNoQuo.get(noQuo)
      const actual = actualByNoQuo.get(noQuo)
      const storedActualTotal = actual?.modal_aktual_total
      const hasStoredActualTotal =
        storedActualTotal !== null &&
        storedActualTotal !== undefined &&
        String(storedActualTotal).trim() !== ''
      const legacySubtotal = Number(actual?.modal_aktual_subtotal ?? 0)
      const investorPct = Number(actual?.investor_pct ?? 0)
      const aktual = !actual
        ? 0
        : hasStoredActualTotal && Number.isFinite(Number(storedActualTotal))
          ? Number(storedActualTotal)
          : Number.isFinite(legacySubtotal) && Number.isFinite(investorPct)
            ? legacySubtotal * (1 + investorPct / 100)
            : 0

      // Hanya tampilkan No. Invoice jika invoice benar-benar sudah tersimpan
      const noInvoice = inv
        ? inv.no_invoice ||
          inv.invoice_no ||
          noQuo.replace(/(-\d{4})$/, '-INV$1')
        : ''

      const noPo = inv ? inv.no_po || inv.no_po2 || '' : ''

      const tanggalStr = inv?.tanggal || est.tanggal || null
      let tanggalDate: Date | null = null
      if (tanggalStr) {
        tanggalDate = new Date(tanggalStr)
        if (isNaN(tanggalDate.getTime())) tanggalDate = null
      }
      if (!tanggalDate) tanggalDate = new Date(est.updated_at)

      const note = notesByNoQuo.get(noQuo)

      let isCarryOver = false

      // Filter by month/year
      if (bulan && tahun) {
        const fm = parseInt(String(bulan), 10)
        const fy = parseInt(String(tahun), 10)
        const isCurrentMonth = tanggalDate.getMonth() + 1 === fm && tanggalDate.getFullYear() === fy
        
        if (!isCurrentMonth) {
          // Jika bukan bulan yang dipilih, cek apakah ini carry-over yang di-close di bulan ini
          if (note && note.status === 'Close' && note.updated_at) {
            if (note.updated_at.getMonth() + 1 === fm && note.updated_at.getFullYear() === fy) {
              // Pastikan tanggal invoice SEBELUM bulan yang dipilih
              if (tanggalDate < new Date(fy, fm - 1, 1)) {
                isCarryOver = true
              }
            }
          }
          if (!isCarryOver) continue
        }
      } else if (tahun) {
        const fy = parseInt(String(tahun), 10)
        if (tanggalDate.getFullYear() !== fy) continue
      }

      if (!noInvoice) continue

      results.push({
        noQuo,
        noInvoice,
        noPo,
        namaKapal: inv?.kapal || '',
        kasbon,
        aktual,
        selisih: kasbon - aktual,
        keterangan: note?.keterangan ?? '',
        status: note?.status ?? 'Progress',
        tanggal: tanggalDate.toISOString().slice(0, 10),
        invoiceId: inv?.id,
        isCarryOver,
      })
    }

    results.sort(
      (a, b) =>
        a.tanggal.localeCompare(b.tanggal) ||
        a.noInvoice.localeCompare(b.noInvoice)
    )

    res.json(results)
  } catch (error) {
    console.error('Failed to get lap bulanan:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

// ── POST /api/lap-bulanan/save
// Upsert notes: [{noQuo, keterangan, status}]
router.post('/save', async (req, res) => {
  const notes: { noQuo: string; keterangan: string; status: string }[] = req.body

  if (!Array.isArray(notes) || notes.length === 0) {
    return res.status(400).json({ error: 'Body harus berupa array notes' })
  }

  try {
    for (const note of notes) {
      const { noQuo, keterangan, status } = note
      if (!noQuo) continue
      await sql`
        INSERT INTO lap_bulanan_notes (no_quo, keterangan, status, updated_at)
        VALUES (${noQuo}, ${keterangan ?? ''}, ${status ?? 'Progress'}, NOW())
        ON CONFLICT (no_quo) DO UPDATE
          SET keterangan = EXCLUDED.keterangan,
              status     = EXCLUDED.status,
              updated_at = NOW()
      `
    }
    res.json({ success: true, saved: notes.length })
  } catch (error) {
    console.error('Failed to save lap bulanan notes:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

export default router
