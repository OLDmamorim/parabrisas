#!/usr/bin/env node
// Script completo para configurar sistema de eurocodes
// Executa: Passo 1 (criar tabela) + Passo 2 (migrar dados)

import { sql } from './netlify/functions/db.mjs';
import { EUROCODE_PREFIX_MAP } from './eurocode-mapping.mjs';

console.log('');
console.log('🚀 SETUP COMPLETO DO SISTEMA DE EUROCODES');
console.log('==========================================');
console.log('');

async function setup() {
  try {
    // PASSO 1: Criar tabela
    console.log('📋 PASSO 1: Criar tabela de eurocodes');
    console.log('--------------------------------------');
    
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
    console.log('✅ Tabela criada com sucesso');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_prefix ON eurocodes(prefix)`;
    console.log('✅ Índice por prefixo criado');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_marca ON eurocodes(marca)`;
    console.log('✅ Índice por marca criado');
    
    console.log('');
    
    // PASSO 2: Migrar dados
    console.log('📊 PASSO 2: Migrar eurocodes do ficheiro para a BD');
    console.log('---------------------------------------------------');
    
    const existingCount = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    console.log(`📈 Eurocodes existentes na BD: ${existingCount[0].count}`);
    
    const entries = Object.entries(EUROCODE_PREFIX_MAP);
    console.log(`📁 Eurocodes no ficheiro: ${entries.length}`);
    console.log('');
    
    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log('⏳ A migrar eurocodes...');
    
    for (const [prefix, { marca, modelo }] of entries) {
      try {
        const result = await sql`
          INSERT INTO eurocodes (prefix, marca, modelo)
          VALUES (${prefix}, ${marca}, ${modelo})
          ON CONFLICT (prefix) DO NOTHING
          RETURNING id
        `;
        
        if (result.length > 0) {
          addedCount++;
          if (addedCount % 50 === 0) {
            console.log(`   ✓ ${addedCount} eurocodes migrados...`);
          }
        } else {
          skippedCount++;
        }
      } catch (err) {
        errorCount++;
        console.error(`   ❌ Erro ao migrar eurocode ${prefix}:`, err.message);
      }
    }
    
    console.log('');
    console.log('✅ MIGRAÇÃO CONCLUÍDA!');
    console.log('');
    console.log('📊 ESTATÍSTICAS FINAIS:');
    console.log('------------------------');
    console.log(`   • Total no ficheiro: ${entries.length}`);
    console.log(`   • Adicionados: ${addedCount}`);
    console.log(`   • Já existiam: ${skippedCount}`);
    console.log(`   • Erros: ${errorCount}`);
    console.log('');
    
    const finalCount = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    console.log(`📈 Total de eurocodes na BD: ${finalCount[0].count}`);
    console.log('');
    
    console.log('📝 Exemplos de eurocodes migrados:');
    const samples = await sql`
      SELECT prefix, marca, modelo 
      FROM eurocodes 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    samples.forEach(({ prefix, marca, modelo }) => {
      const modeloStr = modelo ? ` ${modelo}` : '';
      console.log(`   • ${prefix}: ${marca}${modeloStr}`);
    });
    
    console.log('');
    console.log('🎉 SETUP CONCLUÍDO COM SUCESSO!');
    console.log('');
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('-------------------');
    console.log('1. Substituir função de upload:');
    console.log('   cp upload-eurocodes-FIXED.mjs netlify/functions/upload-eurocodes.mjs');
    console.log('');
    console.log('2. Adicionar função de lookup:');
    console.log('   cp get-vehicle-from-eurocode.mjs netlify/functions/get-vehicle-from-eurocode.mjs');
    console.log('');
    console.log('3. Fazer commit e push:');
    console.log('   git add netlify/functions/');
    console.log('   git commit -m "Fix: Migrar upload de eurocodes para PostgreSQL"');
    console.log('   git push origin main');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERRO FATAL:');
    console.error('---------------');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

// Executar setup
setup()
  .then(() => {
    console.log('👋 A terminar...');
    console.log('');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Erro não tratado:');
    console.error(error);
    console.error('');
    process.exit(1);
  });

