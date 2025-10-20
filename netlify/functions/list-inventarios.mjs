import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders };

  try {
    await requireAuth(event);

    const inventarios = await sql`
      SELECT * FROM inventarios
      ORDER BY data_inventario DESC
      LIMIT 100
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventarios }) };
  } catch (e) {
    console.error('Erro:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};
