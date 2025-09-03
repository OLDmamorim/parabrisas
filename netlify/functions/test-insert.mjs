import { sql, init, jsonHeaders } from './db.mjs';

export const handler = async (event) => {
  // GET simples que insere uma linha de teste
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: jsonHeaders, body: '"Method Not Allowed"' };
  }

  try {
    await init();

    const rows = await sql/*sql*/`
      insert into ocr_results (text, filename, source)
      values ('TESTE VIA /api/test-insert', 'manual', 'test')
      returning id, ts, text, filename, source
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, inserted: rows[0] })
    };
  } catch (e) {
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};