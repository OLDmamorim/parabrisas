// netlify/functions/update-ocr.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { id, text, euro_validado } = JSON.parse(event.body || "{}");
    const numId = Number(id);

    if (!numId || Number.isNaN(numId)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing/invalid id" }) };
    }
    if (typeof text !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing/invalid text" }) };
    }

    // Garante que a coluna existe
    await sql`ALTER TABLE ocr_results ADD COLUMN IF NOT EXISTS euro_validado text`;

    const rows = await sql/*sql*/`
      UPDATE ocr_results
      SET text = ${text}, euro_validado = ${euro_validado}
      WHERE id = ${numId}
      RETURNING id, ts, text, filename, source, euro_validado
    `;

    if (!rows?.length) {
      return { statusCode: 404, body: JSON.stringify({ error: "Row not found" }) };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, row: rows[0] })
    };
  } catch (err) {
    console.error("Erro UPDATE:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};