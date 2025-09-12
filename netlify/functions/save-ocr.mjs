// /.netlify/functions/save-ocr.js
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
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'POST')    return err(405, 'Method Not Allowed');

  try {
    const sql = neon(process.env.DATABASE_URL);

    const ip =
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] ||
      event.headers['x-real-ip'] ||
      null;

    const body = JSON.parse(event.body || '{}');
    const {
      text = '',
      eurocode = '',
      filename = '',
      source = '',
      brand: brandFromClient = ''
    } = body;

    // fallback: se o client não mandou brand, calcula aqui (seguro)
    const brand = brandFromClient || null;

    // *** IMPORTANTE: 6 colunas, 6 valores ***
    const rows = await sql`
      INSERT INTO ocr_results (text, euro_validado, filename, source, ip, brand)
      VALUES (${text}, ${eurocode || null}, ${filename || null}, ${source || null}, ${ip}, ${brand})
      RETURNING id, ts, text, euro_validado, brand, filename, source
    `;

    const r = rows?.[0];
    return ok({
      ok: true,
      item: r && {
        id: r.id,
        created_at: r.ts,
        text: r.text,
        eurocode: r.euro_validado,
        brand: r.brand,
        filename: r.filename,
        source: r.source,
      },
    });
  } catch (e) {
    // devolve a mensagem real para vermos o motivo exato
    return err(500, String(e?.message || e));
  }
};