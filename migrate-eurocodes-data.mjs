// Script de migração de eurocodes do ficheiro para a base de dados
// Execução: node migrate-eurocodes-data.mjs

import { sql } from './netlify/functions/db.mjs';
import { EUROCODE_PREFIX_MAP } from './eurocode-mapping.mjs';

async function migrate() {
  console.log('🔄 A iniciar migração de eurocodes para base de dados...');
  console.log('');

  try {
    // Criar tabela se não existir
    console.log('📋 A criar tabela eurocodes...');
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

    // Criar índices
    console.log('🔍 A criar índices...');
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_prefix ON eurocodes(prefix)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_marca ON eurocodes(marca)`;

    // Verificar quantos eurocodes já existem
    const existingCount = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    console.log(`📊 Eurocodes existentes na BD: ${existingCount[0].count}`);
    console.log('');

    // Obter eurocodes do ficheiro
    const entries = Object.entries(EUROCODE_PREFIX_MAP);
    console.log(`📁 Eurocodes no ficheiro: ${entries.length}`);
    console.log('');

    // Migrar eurocodes
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
    console.log('✅ Migração concluída!');
    console.log('');
    console.log('📊 Estatísticas:');
    console.log(`   • Total no ficheiro: ${entries.length}`);
    console.log(`   • Adicionados: ${addedCount}`);
    console.log(`   • Já existiam: ${skippedCount}`);
    console.log(`   • Erros: ${errorCount}`);
    console.log('');

    // Verificar total final
    const finalCount = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    console.log(`📈 Total de eurocodes na BD: ${finalCount[0].count}`);
    console.log('');

    // Mostrar alguns exemplos
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
    console.log('🎉 Migração concluída com sucesso!');

  } catch (error) {
    console.error('');
    console.error('❌ Erro fatal durante a migração:');
    console.error(error);
    process.exit(1);
  }
}

// Executar migração
migrate()
  .then(() => {
    console.log('');
    console.log('👋 A terminar...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Erro não tratado:');
    console.error(error);
    process.exit(1);
  });

