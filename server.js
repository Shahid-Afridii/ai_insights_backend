import express from 'express';
import cors from 'cors';
import { getConnection, loadParquetOnce } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

/* ================= HELPERS ================= */

function normalizeRow(row) {
  return {
    ...row,
    pr: Number(row.pr),
    y: Number(row.y),
  };
}

/* ================= PROPERTY MATCH ================= */

async function readRelevantRows(property) {
  const conn = await getConnection();

  try {
    const normalize = (v = '') =>
      String(v).toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    const cleanStreet = (v = '') =>
      String(v)
        .toUpperCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\b\d+\w*\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizePostcode = (pc = '') =>
      String(pc).toUpperCase().replace(/\s+/g, '').trim();

    const safe = (v = '') => v.replace(/'/g, "''");

    const inputStreet = cleanStreet(property?.display_address?.split(',')[0] || '');
    const inputArea = normalize(property?.area || '');
    const inputPostcode = normalizePostcode(property?.post_code || '');
    const inputOutward = inputPostcode.slice(0, 3);

    if (!inputStreet || !inputOutward) {
      return { rows: [], totalMatched: 0 };
    }

    await loadParquetOnce(conn);

    const query = `
      WITH base AS (
        SELECT
          regexp_replace(upper(s), '[^A-Z0-9 ]', '', 'g') AS clean_street,
          replace(upper(pc), ' ', '') AS clean_pc,
          split_part(upper(pc), ' ', 1) AS outward,
          upper(t) AS clean_area,
          pr, y, ty, pc, s, t
        FROM properties
        WHERE pr BETWEEN 30000 AND 2000000
      )
      SELECT *
      FROM base
      WHERE
        (clean_street = '${safe(inputStreet)}' AND clean_pc = '${safe(inputPostcode)}')
        OR
        (clean_street = '${safe(inputStreet)}' AND outward = '${safe(inputOutward)}')
        OR
        (clean_area = '${safe(inputArea)}' AND outward = '${safe(inputOutward)}')
    `;

    const rawRows = await new Promise((resolve, reject) => {
      conn.all(query, (err, res) => (err ? reject(err) : resolve(res)));
    });

    const rows = rawRows.map(normalizeRow);

    return {
      rows,
      totalMatched: rows.length,
      allRows: rows,
    };
  } finally {
    conn.close(); // ✅ IMPORTANT
  }
}

/* ================= AREA MATCH ================= */

async function readAreaRows(areaInput) {
  const conn = await getConnection();

  try {
    const normalize = (v = '') =>
      String(v).toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    const safe = (v = '') => v.replace(/'/g, "''");

    const inputArea = normalize(areaInput);
    if (!inputArea) return [];

    await loadParquetOnce(conn);

    const query = `
      SELECT
        pr,
        y,
        ty,
        pc,
        t
      FROM properties
      WHERE 
        upper(t) = '${safe(inputArea)}'
        AND pr BETWEEN 30000 AND 2000000
      LIMIT 50000
    `;

    const rawRows = await new Promise((resolve, reject) => {
      conn.all(query, (err, res) => (err ? reject(err) : resolve(res)));
    });

    return rawRows.map((row) => ({
      year: Number(row.y),
      price: Number(row.pr),
      town: row.t,
      postcode: row.pc,
      property: row.ty,
    }));
  } finally {
    conn.close(); // ✅ IMPORTANT
  }
}

/* ================= API ================= */

app.post('/predict', async (req, res) => {
  try {
    const result = await readRelevantRows(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/area-predict', async (req, res) => {
  try {
    const { area } = req.body;
    if (!area) return res.status(400).json({ error: 'Area required' });

    const rows = await readAreaRows(area);

    res.json({
      success: true,
      rows,
      matchedCount: rows.length,
    });
  } catch (err) {
    console.error('❌ AREA ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= START ================= */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});