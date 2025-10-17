// /.netlify/functions/migrate-add-saida-timestamp.mjs
// Função para adicionar coluna saida_timestamp à tabela ocr_results
import { jsonHeaders, sql, init } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  if (event.httpMethod !== 'POST') return cors(405, { ok: false, error: 'Method Not Allowed' });

  try {
    await init();
    const user = await requireAuth(event);
    
    // Apenas admin pode executar migrações
    // Por segurança, verificar se o email é o do admin
    if (user.email !== 'mramorim78@gmail.com') {
      return cors(403, { ok: false, error: 'Acesso negado. Apenas admin pode executar migrações.' });
    }

    console.log('🔧 Iniciando migração: adicionar coluna saida_timestamp');

    // Verificar se a coluna já existe
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ocr_results' 
      AND column_name = 'saida_timestamp'
    `;

    if (checkColumn.length > 0) {
      console.log('✅ Coluna saida_timestamp já existe');
      return cors(200, { 
        ok: true, 
        message: 'Coluna saida_timestamp já existe',
        already_exists: true 
      });
    }

    // Adicionar coluna saida_timestamp
    console.log('📝 Adicionando coluna saida_timestamp...');
    await sql`
      ALTER TABLE ocr_results 
      ADD COLUMN saida_timestamp TIMESTAMP WITH TIME ZONE
    `;

    console.log('✅ Coluna saida_timestamp adicionada com sucesso');

    // Atualizar registos existentes que têm saída mas não têm timestamp
    console.log('📝 Atualizando registos existentes...');
    const updated = await sql`
      UPDATE ocr_results
      SET saida_timestamp = updated_at
      WHERE observacoes IN ('SERVIÇO', 'DEVOLUÇÃO', 'QUEBRAS', 'OUTRO')
        AND saida_timestamp IS NULL
        AND updated_at IS NOT NULL
      RETURNING id
    `;

    console.log(`✅ ${updated.length} registos atualizados`);

    return cors(200, {
      ok: true,
      message: 'Migração executada com sucesso',
      column_added: true,
      records_updated: updated.length
    });

  } catch (e) {
    console.error('❌ Erro na migração:', e);
    return cors(500, { 
      ok: false, 
      error: String(e?.message || e),
      details: e.stack 
    });
  }
};

