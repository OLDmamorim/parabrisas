// /.netlify/functions/list-ocr.mjs - Com autenticação
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
  if (event.httpMethod !== 'GET')     return err(405, 'Method Not Allowed');

  try {
    // Inicializar BD
    await init();
    
    // Verificar autenticação
    const user = await requireAuth(event);

    // Buscar apenas registos do utilizador atual
    try {
      const rows = await sql/*sql*/`
        SELECT
          id,
          ts                       AS created_at,
          text,
          eurocode,
          brand,
          vehicle,
          filename,
          source,
          matricula,
          loja,
          observacoes,
          user_id
        FROM ocr_results
        WHERE user_id = ${user.id}
        ORDER BY ts DESC
        LIMIT 300
      `;
      return ok({ ok: true, rows });
    } catch (e) {
      // Se as colunas ainda não existirem, fazer fallback
      const msg = String(e?.message || e);
      if (msg.includes('column') && msg.includes('does not exist')) {
        const rowsBasic = await sql/*sql*/`
          SELECT
            id,
            ts                AS created_at,
            text,
            filename,
            source,
            matricula
          FROM ocr_results
          WHERE user_id = ${user.id}
          ORDER BY ts DESC
          LIMIT 300
        `;
        const rows = rowsBasic.map(r => ({ 
          ...r, 
          eurocode: null, 
          brand: null, 
          vehicle: null,
          loja: 'LOJA',
          observacoes: ''
        }));
        return ok({ ok: true, rows, note: 'Some columns missing, returned as null' });
      }
      throw e;
    }
  } catch (e) {
    console.error('Erro ao listar OCR:', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};