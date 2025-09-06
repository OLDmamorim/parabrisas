// netlify/functions/update-ocr.mjs
import { sql } from "@neondatabase/serverless";
export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }
    const b = JSON.parse(event.body || "{}");
    const id   = b.id;
    const text = b.text ?? "";
    const ts   = b.ts || b.timestamp || null;
    const euro = b.euro_validado ?? b.eurocode ?? null;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: "ID em falta" }) };

    // aplica só os campos fornecidos
    const { rows } = await sql`
      UPDATE ocr_capturas
         SET text = ${text},
             ts = COALESCE(${ts}, ts),
             euro_validado = COALESCE(${euro}, euro_validado)
       WHERE id = ${id}
       RETURNING id, ts, text, euro_validado;
    `;

    return { statusCode: 200, body: JSON.stringify({ ok: true, row: rows[0] }) };
  } catch (err) {
    console.error("update-ocr error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};