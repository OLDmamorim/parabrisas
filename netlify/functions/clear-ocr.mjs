// netlify/functions/clear-ocr.mjs
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.NEON_DATABASE_URL);

export const handler = async () => {
  try {
    await sql`DELETE FROM ocr_results`;
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("Erro clear:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};