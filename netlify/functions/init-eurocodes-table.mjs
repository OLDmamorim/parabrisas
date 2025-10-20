// /.netlify/functions/init-eurocodes-table.mjs
// Função temporária para criar a tabela de eurocodes
// EXECUTAR UMA VEZ e depois APAGAR este ficheiro

import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from './auth-utils.mjs';

const cors = (status, body = {}) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors(200);
  
  try {
    // Verificar autenticação (qualquer utilizador autenticado pode executar)
    const user = await requireAuth(event);
    console.log('👤 Utilizador a criar tabela:', user.email);

    console.log('📋 A criar tabela eurocodes...');
    
    // Criar tabela
    await sql`
      CREATE TABLE IF NOT EXISTS eurocodes (
        id SERIAL PRIMARY KEY,
        prefix VARCHAR(4) UNIQUE NOT NULL,
        marca VARCHAR(100) NOT NULL,
        modelo VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    console.log('🔍 A criar índice por prefixo...');
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_prefix ON eurocodes(prefix)`;

    console.log('🔍 A criar índice por marca...');
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_marca ON eurocodes(marca)`;

    console.log('✅ Tabela criada com sucesso!');

    // Verificar se já existem dados
    const count = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    const totalRecords = parseInt(count[0].count);

    return cors(200, {
      ok: true,
      message: 'Tabela de eurocodes criada com sucesso',
      total_records: totalRecords,
      note: 'Pode agora executar o script de migração de dados'
    });

  } catch (e) {
    console.error('❌ Erro ao criar tabela:', e);
    return cors(500, { 
      ok: false, 
      error: String(e?.message || e)
    });
  }
};

