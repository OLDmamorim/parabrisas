// netlify/functions/list-ocr.mjs
import { sql } from "@neondatabase/serverless";
export const handler = async (_event) => {
  try {
    await sql`CREATE TABLE IF NOT EXISTS ocr_capturas (
      id SERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL,
      text TEXT,
      euro_validado TEXT
    );`;
    const { rows } = await sql`SELECT id, ts, text, euro_validado FROM ocr_capturas ORDER BY id DESC LIMIT 200;`;
    return { statusCode: 200, body: JSON.stringify(rows) };
  } catch (err) {
    console.error("list-ocr error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};