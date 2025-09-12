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
      brand: brandFromClient = '',
      vehicle: vehicleFromClient = ''
    } = body;

    const brand = brandFromClient || null;
    const vehicle = vehicleFromClient || null;

    // agora temos 7 colunas
    const rows = await sql`
      INSERT INTO ocr_results (text, euro_validado, filename, source, ip, brand, vehicle)
      VALUES (${text}, ${eurocode || null}, ${filename || null}, ${source || null}, ${ip}, ${brand}, ${vehicle})
      RETURNING id, ts, text, euro_validado, brand, vehicle, filename, source
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
        vehicle: r.vehicle,
        filename: r.filename,
        source: r.source,
      },
    });
  } catch (e) {
    return err(500, String(e?.message || e));
  }
};