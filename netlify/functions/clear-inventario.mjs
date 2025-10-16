// /.netlify/functions/clear-inventario.mjs
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

    // Limpar apenas inventário do utilizador
    await sql`DELETE FROM inventario WHERE user_id = ${user.id}`;
    
    return ok({ ok: true });
  } catch (e) {
    console.error('Erro ao limpar inventário:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};

