// /.netlify/functions/save-ocr.mjs
import { neon } from '@neondatabase/serverless';

const ok = (data) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(data),
});

const err = (status, message) => ({
  statusCode: status,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify({ ok: false, error: message }),
});

export const handler = async (event) => {
  // Preflight CORS
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });

  if (event.httpMethod !== 'POST') {
    return err(405, 'Method Not Allowed');
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return err(500, 'No database connection string was provided (DATABASE_URL not set?)');

    const sql = neon(dbUrl);

    // Body JSON
    const { text = '', eurocode = '', filename = '', source = '', brand = '', vehicle = '' } =
      JSON.parse(event.body || '{}');

    // Insert
    const rows = await sql/*sql*/`
      INSERT INTO ocr_results (ts, text, euro_validado, brand, vehicle, filename, source)
      VALUES (NOW(), ${text}, ${eurocode}, ${brand}, ${vehicle}, ${filename}, ${source})
      RETURNING id, ts AS created_at, text, euro_validado AS eurocode, brand, vehicle, filename, source
    `;

    return ok({ ok: true, row: rows[0] });
  } catch (e) {
    return err(500, String(e?.message || e));
  }
};