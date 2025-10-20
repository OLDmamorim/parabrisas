// /.netlify/functions/upload-eurocodes.mjs
// Função para processar upload de Excel e atualizar base de dados de eurocodes
// VERSÃO CORRIGIDA: Usa base de dados PostgreSQL em vez de ficheiro estático

import { jsonHeaders, sql } from './db.mjs';
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
    const user = await requireAuth(event);
    
    // Verificar se o utilizador é gestor ou Admin
    const userRole = (user.role || '').toLowerCase();
    if (userRole !== 'gestor' && userRole !== 'admin') {
      return cors(403, { ok: false, error: 'Acesso negado. Apenas gestores e administradores podem atualizar eurocodes.' });
    }

    console.log('📤 Gestor a fazer upload de eurocodes:', user.email);

    const payload = JSON.parse(event.body || '{}');
    const { eurocodes } = payload; // Array de { prefix, marca, modelo }
    
    if (!Array.isArray(eurocodes) || eurocodes.length === 0) {
      return cors(400, { ok: false, error: 'Array de eurocodes é obrigatório' });
    }

    console.log(`📊 Recebidos ${eurocodes.length} eurocodes para processar`);

    // Verificar se a tabela existe, se não criar
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

    // Criar índice se não existir
    await sql`
      CREATE INDEX IF NOT EXISTS idx_eurocodes_prefix ON eurocodes(prefix)
    `;

    // Obter eurocodes existentes
    const existingPrefixes = await sql`
      SELECT prefix FROM eurocodes
    `;
    const existingSet = new Set(existingPrefixes.map(e => e.prefix));

    console.log(`📋 Eurocodes existentes: ${existingSet.size}`);

    // Filtrar apenas novos eurocodes
    const newEurocodes = eurocodes.filter(e => !existingSet.has(e.prefix));
    
    console.log(`✨ Novos eurocodes a adicionar: ${newEurocodes.length}`);

    if (newEurocodes.length === 0) {
      // Obter total atual
      const totalResult = await sql`SELECT COUNT(*) as count FROM eurocodes`;
      const totalPrefixes = parseInt(totalResult[0].count);

      return cors(200, {
        ok: true,
        message: 'Nenhum eurocode novo para adicionar',
        total_received: eurocodes.length,
        already_exists: eurocodes.length,
        added: 0,
        total_prefixes: totalPrefixes
      });
    }

    // Inserir novos eurocodes usando transação
    let addedCount = 0;
    
    for (const eurocode of newEurocodes) {
      try {
        await sql`
          INSERT INTO eurocodes (prefix, marca, modelo)
          VALUES (${eurocode.prefix}, ${eurocode.marca}, ${eurocode.modelo || null})
          ON CONFLICT (prefix) DO NOTHING
        `;
        addedCount++;
      } catch (err) {
        console.error(`❌ Erro ao inserir eurocode ${eurocode.prefix}:`, err.message);
      }
    }

    console.log(`✅ ${addedCount} eurocodes adicionados com sucesso`);

    // Obter total atualizado
    const totalResult = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    const totalPrefixes = parseInt(totalResult[0].count);

    return cors(200, {
      ok: true,
      message: 'Eurocodes atualizados com sucesso',
      total_received: eurocodes.length,
      already_exists: eurocodes.length - addedCount,
      added: addedCount,
      total_prefixes: totalPrefixes
    });

  } catch (e) {
    console.error('❌ Erro ao processar eurocodes:', e);
    return cors(500, { 
      ok: false, 
      error: String(e?.message || e)
    });
  }
};

