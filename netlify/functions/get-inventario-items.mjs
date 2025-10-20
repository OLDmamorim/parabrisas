import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders };

  try {
    await requireAuth(event);
    const { inventario_id } = event.queryStringParameters || {};

    const items = await sql`
      SELECT * FROM inventario_items
      WHERE inventario_id = ${inventario_id}
      ORDER BY hora ASC
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, items }) };
  } catch (e) {
    console.error('Erro:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};
