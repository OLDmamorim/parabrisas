// netlify/functions/save-ocr.mjs
import { sql } from "@neondatabase/serverless";
export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }
    const body = JSON.parse(event.body || "{}");
    const ts   = body.ts || body.timestamp || new Date().toISOString();
    const text = body.text ?? "";
    const euro = body.euro_validado ?? body.eurocode ?? body.euro ?? "";

    if (!euro) {
      return { statusCode: 400, body: JSON.stringify({ error: "Eurocode em falta" }) };
    }

    // garante tabela
    await sql`CREATE TABLE IF NOT EXISTS ocr_capturas (
      id SERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL,
      text TEXT,
      euro_validado TEXT
    );`;

    const { rows } = await sql`
      INSERT INTO ocr_capturas (ts, text, euro_validado)
      VALUES (${ts}, ${text}, ${euro})
      RETURNING id, ts, text, euro_validado;
    `;

    return { statusCode: 200, body: JSON.stringify({ ok: true, row: rows[0] }) };
  } catch (err) {
    console.error("save-ocr error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};