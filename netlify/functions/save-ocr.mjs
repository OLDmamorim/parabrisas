// netlify/functions/save-ocr.mjs
import { sql, init, jsonHeaders } from './db.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    const { ts, text, filename, source, euro_validado, euro_user, eurocode } =
      JSON.parse(event.body || '{}');

    if (!text && !filename) {
      return { statusCode: 400, headers: jsonHeaders, body: '"Texto ou filename obrigatório"' };
    }

    const ip =
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      event.headers['client-ip'] || null;

    const euroFinal = euro_validado || euro_user || eurocode || null;

    const rows = await sql/*sql*/`
      insert into ocr_results (ts, text, filename, source, ip, euro_validado)
      values (${ts ? new Date(ts) : new Date()}, ${text}, ${filename}, ${source}, ${ip}, ${euroFinal})
      returning id, ts, text, filename, source, euro_validado
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, row: rows[0] })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};