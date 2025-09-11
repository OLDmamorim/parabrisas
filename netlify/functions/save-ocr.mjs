// /.netlify/functions/save-ocr.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image_url, eurocode, brand, loja, user_id, raw_text } = JSON.parse(event.body || "{}");
    const sql = neon(process.env.DATABASE_URL);

    const { rows } = await sql`
      INSERT INTO ocr_results (image_url, eurocode, brand, loja, user_id, raw_text)
      VALUES (${image_url || null}, ${eurocode || null}, ${brand || null}, ${loja || null}, ${user_id || null}, ${raw_text || null})
      RETURNING id, image_url, eurocode, brand, loja, user_id, raw_text, created_at
    `;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, item: rows[0] })
    };
  } catch (err) {
    console.error('save-ocr error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err?.message || err) })
    };
  }
};