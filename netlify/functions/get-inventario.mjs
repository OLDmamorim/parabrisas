import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders };

  try {
    await requireAuth(event);
    const { id } = event.queryStringParameters || {};

    const [inventario] = await sql`
      SELECT * FROM inventarios WHERE id = ${id}
    `;

    if (!inventario) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'Inventário não encontrado' }) };
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventario }) };
  } catch (e) {
    console.error('Erro:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};
