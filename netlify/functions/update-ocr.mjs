// /.netlify/functions/update-ocr.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { id, eurocode, brand, loja, user_id } = JSON.parse(event.body || "{}");
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error: 'Missing id' }) };
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      UPDATE ocr_results
      SET
        eurocode = COALESCE(${eurocode}, eurocode),
        brand    = COALESCE(${brand}, brand),
        loja     = COALESCE(${loja}, loja),
        user_id  = COALESCE(${user_id}, user_id)
      WHERE id = ${id}
    `;

    const { rows } = await sql`
      SELECT id, image_url, eurocode, brand, loja, user_id, raw_text, created_at
      FROM ocr_results
      WHERE id = ${id}
      LIMIT 1
    `;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, item: rows[0] || null })
    };
  } catch (err) {
    console.error('update-ocr error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok:false, error: String(err?.message || err) })
    };
  }
};