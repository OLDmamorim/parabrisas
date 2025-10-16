// /.netlify/functions/list-inventario.mjs
import { jsonHeaders, sql, init } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

const ok = (data) => ({
  statusCode: 200,
  headers: jsonHeaders,
  body: JSON.stringify(data),
});

const err = (status, message) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify({ ok: false, error: message }),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'GET') return err(405, 'Method Not Allowed');

  try {
    await init();
    const user = await requireAuth(event);

    // Buscar inventário do utilizador
    const rows = await sql`
      SELECT
        id,
        ts AS created_at,
        text,
        eurocode,
        brand,
        vehicle,
        filename,
        source,
        loja,
        observacoes,
        user_id
      FROM inventario
      WHERE user_id = ${user.id}
      ORDER BY ts DESC
      LIMIT 500
    `;
    
    return ok({ ok: true, rows });
  } catch (e) {
    console.error('Erro ao listar inventário:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};

