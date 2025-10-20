import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ ok: false }) };

  try {
    const user = await requireAuth(event);
    const { loja } = JSON.parse(event.body || '{}');

    const [inventario] = await sql`
      INSERT INTO inventarios (user_id, user_email, loja, status, total_items)
      VALUES (${user.id || null}, ${user.email}, ${loja || 'Desconhecida'}, 'aberto', 0)
      RETURNING *
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, inventario }) };
  } catch (e) {
    console.error('Erro:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};
