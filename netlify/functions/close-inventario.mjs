import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ ok: false }) };

  try {
    await requireAuth(event);
    const { inventario_id } = JSON.parse(event.body || '{}');

    await sql`
      UPDATE inventarios
      SET status = 'fechado', updated_at = NOW()
      WHERE id = ${inventario_id}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('Erro:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};
