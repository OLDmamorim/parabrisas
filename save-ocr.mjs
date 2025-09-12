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
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });

  // Só aceita POST
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  try {
    const sql = neon(process.env.DATABASE_URL);
    if (!process.env.DATABASE_URL) {
      return err(500, 'DATABASE_URL env var not set');
    }

    // body JSON
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return err(400, 'Invalid JSON body');
    }

    const {
      text = '',
      eurocode = '',
      filename = '',
      source = '',
      brand = '',
      vehicle = ''
    } = payload;

    // tenta inserir COM a coluna vehicle
    try {
      const rows = await sql/*sql*/`
        INSERT INTO ocr_results (text, euro_validado, brand, vehicle, filename, source)
        VALUES (${text}, ${eurocode}, ${brand}, ${vehicle}, ${filename}, ${source})
        RETURNING id, ts AS created_at
      `;
      return ok({ ok: true, row: rows[0] });
    } catch (e) {
      // se a coluna vehicle ainda não existir, faz fallback sem ela
      const msg = String(e?.message || e);
      if (msg.includes('column "vehicle" does not exist')) {
        const rows = await sql/*sql*/`
          INSERT INTO ocr_results (text, euro_validado, brand, filename, source)
          VALUES (${text}, ${eurocode}, ${brand}, ${filename}, ${source})
          RETURNING id, ts AS created_at
        `;
        return ok({ ok: true, row: rows[0], note: 'vehicle column missing (ignored)' });
      }
      throw e;
    }
  } catch (e) {
    return err(500, String(e?.message || e));
  }
};