// /.netlify/functions/delete-inventario.mjs
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
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  try {
    await init();
    const user = await requireAuth(event);

    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return err(400, 'Invalid JSON body');
    }

    const { id } = payload;
    if (!id) return err(400, 'ID é obrigatório');

    // Deletar apenas se pertencer ao utilizador
    await sql`DELETE FROM inventario WHERE id = ${id} AND user_id = ${user.id}`;
    
    return ok({ ok: true });
  } catch (e) {
    console.error('Erro ao deletar item:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};

