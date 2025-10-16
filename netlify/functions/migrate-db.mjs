// /.netlify/functions/migrate-db.mjs - Atualizar schema da BD
import { jsonHeaders, sql, init } from './db.mjs';

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
  try {
    await init();
    
    console.log('Iniciando migração da base de dados...');
    
    // Adicionar colunas que faltam em ocr_results
    await sql`
      ALTER TABLE ocr_results 
      ADD COLUMN IF NOT EXISTS eurocode TEXT,
      ADD COLUMN IF NOT EXISTS brand TEXT,
      ADD COLUMN IF NOT EXISTS vehicle TEXT,
      ADD COLUMN IF NOT EXISTS matricula TEXT,
      ADD COLUMN IF NOT EXISTS loja TEXT DEFAULT 'LOJA',
      ADD COLUMN IF NOT EXISTS observacoes TEXT,
      ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'recepcao'
    `;
    
    console.log('Colunas adicionadas a ocr_results');
    console.log('Migração concluída com sucesso!');
    
    return ok({ 
      ok: true, 
      message: 'Base de dados atualizada com sucesso!',
      tables: {
        ocr_results: 'Colunas adicionadas'
      }
    });
    
  } catch (e) {
    console.error('Erro na migração:', e);
    return err(500, String(e?.message || e));
  }
};

