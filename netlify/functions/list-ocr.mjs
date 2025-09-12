// /.netlify/functions/list-ocr.mjs
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
  if (event.httpMethod !== 'GET')     return err(405, 'Method Not Allowed');

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Tenta com a coluna vehicle
    try {
      const rows = await sql/*sql*/`
        SELECT
          id,
          ts                       AS created_at,
          text,
          euro_validado            AS eurocode,
          brand,
          vehicle,                      -- 👈 nova coluna (se existir)
          filename,
          source
        FROM ocr_results
        ORDER BY ts DESC
        LIMIT 300
      `;
      return ok({ ok: true, rows });
    } catch (e) {
      // Se a coluna ainda não existir, faz fallback e devolve vehicle: null
      const msg = String(e?.message || e);
      if (msg.includes('column "vehicle" does not exist')) {
        const rowsNoVehicle = await sql/*sql*/`
          SELECT
            id,
            ts                AS created_at,
            text,
            euro_validado     AS eurocode,
            brand,
            filename,
            source
          FROM ocr_results
          ORDER BY ts DESC
          LIMIT 300
        `;
        const rows = rowsNoVehicle.map(r => ({ ...r, vehicle: null }));
        return ok({ ok: true, rows, note: 'vehicle column missing, returned as null' });
      }
      // outro erro qualquer
      throw e;
    }
  } catch (e) {
    return err(500, String(e?.message || e));
  }
};