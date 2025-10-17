// /.netlify/functions/list-ocr-gestor.mjs
// Função para listar registos de qualquer utilizador (apenas para gestores)
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
    
    // Verificar se o utilizador é gestor ou Admin
    if (user.role !== 'gestor' && user.role !== 'Admin') {
      return err(403, 'Acesso negado. Apenas gestores e administradores podem aceder a dados de outros utilizadores.');
    }
    
    // Obter parâmetros
    const params = event.queryStringParameters || {};
    const tipo = params.tipo || 'recepcao';
    const targetUserId = params.user_id; // ID do utilizador cujos dados queremos ver
    
    if (!targetUserId) {
      return err(400, 'Parâmetro user_id é obrigatório');
    }

    console.log(`📋 Gestor ${user.email} a aceder dados do utilizador ID ${targetUserId}`);

    // Buscar registos do utilizador especificado
    try {
      const rows = await sql`
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
          saida_timestamp,
          tipo,
          user_id
        FROM ocr_results
        WHERE user_id = ${targetUserId} AND (tipo = ${tipo} OR tipo IS NULL)
        ORDER BY ts DESC
        LIMIT 500
      `;
      
      console.log(`✅ ${rows.length} registos encontrados`);
      
      return ok({ ok: true, rows });
    } catch (e) {
      // Se as colunas ainda não existirem, fazer fallback
      const msg = String(e?.message || e);
      if (msg.includes('column') && msg.includes('does not exist')) {
        const rowsBasic = await sql`
          SELECT
            id,
            ts                AS created_at,
            text,
            filename,
            source,
            matricula
          FROM ocr_results
          WHERE user_id = ${targetUserId}
          ORDER BY ts DESC
          LIMIT 500
        `;
        const rows = rowsBasic.map(r => ({ 
          ...r, 
          eurocode: null, 
          brand: null, 
          vehicle: null,
          loja: 'LOJA',
          observacoes: '',
          saida_timestamp: null
        }));
        return ok({ ok: true, rows, note: 'Some columns missing, returned as null' });
      }
      throw e;
    }
  } catch (e) {
    console.error('Erro ao listar OCR (gestor):', e);
    const statusCode = e.message.includes('Token') || e.message.includes('autenticação') ? 401 : 500;
    return err(statusCode, String(e?.message || e));
  }
};

