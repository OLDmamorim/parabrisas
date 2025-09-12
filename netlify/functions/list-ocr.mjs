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

    // query params
    const url = new URL(event.rawUrl || `http://x${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
    const limit  = Math.min(Math.max(parseInt(url.searchParams.get('limit')  || '200', 10), 1), 1000); // 1..1000
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0',   10), 0);

    // 1) tentar a VIEW (normalizada)
    try {
      const rows = await sql`
        SELECT
          id,
          created_at,
          text,
          eurocode,
          brand,
          filename,
          source
        FROM ocr_results_v
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
      return ok({ ok: true, rows });
    } catch (_) {
      // 2) fallback: tabela original
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
    }
  } catch (e) {
    console.error('LIST OCR ERROR:', e);
    return err(500, `DB ERROR: ${String(e?.message || e)}`);
  }
};