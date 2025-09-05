import { sql, init, jsonHeaders } from './db.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    const { ts, text, filename, source, euro_validado } = JSON.parse(event.body || '{}');
    if (!text && !filename) {
      return { statusCode: 400, headers: jsonHeaders, body: '"Texto ou filename obrigatório"' };
    }

    // Normalizar timestamp
    const tsDate = (() => {
      if (typeof ts === "number") return new Date(ts < 1e12 ? ts * 1000 : ts);
      if (typeof ts === "string" && ts) {
        const d = new Date(ts);
        if (!Number.isNaN(d.getTime())) return d;
      }
      return new Date();
    })();

    const ip =
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] || null;

    // Garante que a coluna existe
    await sql`ALTER TABLE ocr_results ADD COLUMN IF NOT EXISTS euro_validado text`;

    const rows = await sql/*sql*/`
      insert into ocr_results (ts, text, filename, source, ip, euro_validado)
      values (${tsDate}, ${text}, ${filename}, ${source}, ${ip}, ${euro_validado})
      returning id, ts, text, filename, source, euro_validado
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, row: rows[0] })
    };
  } catch (e) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};