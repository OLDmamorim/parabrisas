import { sql, init, jsonHeaders } from './db.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    const rows = await sql/*sql*/`
      select id, ts, text, filename, source
      from ocr_results
      order by ts desc
      limit 200
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, rows })
    };
  } catch (e) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};