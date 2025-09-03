// netlify/functions/delete-ocr.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export const handler = async (event) => {
  try {
    const { id } = JSON.parse(event.body || "{}");
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "Missing id" }) };

    await sql`DELETE FROM ocr_results WHERE id = ${id}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, deleted: id })
    };
  } catch (err) {
    console.error("Erro DELETE:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};