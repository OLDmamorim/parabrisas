import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ ok: false }) };

  try {
    await requireAuth(event);
    const { inventario_id, hora, tipo, veiculo, eurocode, marca, matricula, sm_loja, obs } = JSON.parse(event.body || '{}');

    const [item] = await sql`
      INSERT INTO inventario_items (inventario_id, hora, tipo, veiculo, eurocode, marca, matricula, sm_loja, obs)
      VALUES (${inventario_id}, ${hora}, ${tipo}, ${veiculo || null}, ${eurocode || null}, ${marca || null}, ${matricula || null}, ${sm_loja || null}, ${obs || null})
      RETURNING *
    `;

    await sql`
      UPDATE inventarios
      SET total_items = total_items + 1, updated_at = NOW()
      WHERE id = ${inventario_id}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, item }) };
  } catch (e) {
    console.error('Erro:', e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: String(e.message) }) };
  }
};
