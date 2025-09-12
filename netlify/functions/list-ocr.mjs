// /.netlify/functions/list-ocr.js
import { neon } from '@neondatabase/serverless';

const ok = (data) => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  },
  body: JSON.stringify(data),
});

const err = (status, message) => ({
  statusCode: status,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  },
  body: JSON.stringify({ ok: false, error: message }),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'GET')    return err(405, 'Method Not Allowed');

  try {
    const sql = neon(process.env.DATABASE_URL);

    // query params de forma compatível com Netlify
    const qp = event.queryStringParameters || {};
    const limit  = Math.min(Math.max(parseInt(qp.limit  ?? '200', 10) || 200, 1), 1000);
    const offset = Math.max(parseInt(qp.offset ?? '0',   10) || 0, 0);

    const rows = await sql`
      SELECT
        id,
        ts            AS created_at,
        text,
        euro_validado AS eurocode,
        brand,
        filename,
        source
      FROM ocr_results
      ORDER BY ts DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return ok({ ok: true, rows });
  } catch (e) {
    console.error('LIST OCR ERROR:', e);
    return err(500, `DB ERROR: ${String(e?.message || e)}`);
  }
};