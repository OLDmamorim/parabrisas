// /.netlify/functions/save-inventario.mjs
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

    const {
      text = '',
      eurocode = '',
      filename = '',
      source = '',
      brand = '',
      vehicle = '',
      loja = 'LOJA',
      observacoes = ''
    } = payload;

    // Criar tabela se não existir
    await sql`
      CREATE TABLE IF NOT EXISTS inventario (
        id SERIAL PRIMARY KEY,
        ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        text TEXT,
        eurocode TEXT,
        brand TEXT,
        vehicle TEXT,
        filename TEXT,
        source TEXT,
        loja TEXT,
        observacoes TEXT,
        user_id INTEGER
      )
    `;

    // Inserir
    const rows = await sql`
      INSERT INTO inventario (text, eurocode, brand, vehicle, filename, source, loja, observacoes, user_id)
      VALUES (${text}, ${eurocode}, ${brand}, ${vehicle}, ${filename}, ${source}, ${loja}, ${observacoes}, ${user.id})
      RETURNING id, ts AS created_at
    `;
    
    return ok({ ok: true, row: rows[0] });
  } catch (e) {
    console.error('Erro ao guardar inventário:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};

