// /.netlify/functions/save-ocr.mjs - Com autenticação
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
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });

  // Só aceita POST
  if (event.httpMethod !== 'POST') return err(405, 'Method Not Allowed');

  try {
    // Inicializar BD
    await init();
    
    // Verificar autenticação
    const user = await requireAuth(event);

    // body JSON
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
      matricula = '',
      loja = 'LOJA',
      observacoes = ''
    } = payload;

    // Inserir com user_id do utilizador autenticado
    try {
      const rows = await sql/*sql*/`
        INSERT INTO ocr_results (text, eurocode, brand, vehicle, filename, source, matricula, loja, observacoes, user_id)
        VALUES (${text}, ${eurocode}, ${brand}, ${vehicle}, ${filename}, ${source}, ${matricula || null}, ${loja}, ${observacoes}, ${user.id})
        RETURNING id, ts AS created_at
      `;
      return ok({ ok: true, row: rows[0] });
    } catch (e) {
      // Se algumas colunas ainda não existirem, fazer fallback
      const msg = String(e?.message || e);
      if (msg.includes('column') && msg.includes('does not exist')) {
        const rows = await sql/*sql*/`
          INSERT INTO ocr_results (text, filename, source, user_id)
          VALUES (${text}, ${filename}, ${source}, ${user.id})
          RETURNING id, ts AS created_at
        `;
        return ok({ ok: true, row: rows[0], note: 'Some columns missing (ignored)' });
      }
      throw e;
    }
  } catch (e) {
    console.error('Erro ao guardar OCR:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};