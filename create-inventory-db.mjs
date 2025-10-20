import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres(process.env.NEON_DATABASE_URL, { ssl: 'require' });

async function createInventoryTables() {
  try {
    console.log('📊 Criando tabelas de inventário...\n');
    
    // Ler ficheiro SQL
    const sqlContent = readFileSync('create-inventory-tables.sql', 'utf-8');
    
    // Executar SQL
    await sql.unsafe(sqlContent);
    
    console.log('✅ Tabelas criadas com sucesso!\n');
    
    // Verificar tabelas criadas
    const tables = await sql`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_name IN ('inventarios', 'inventario_items')
      ORDER BY table_name
    `;
    
    console.log('📋 Tabelas criadas:');
    tables.forEach(t => {
      console.log(`   • ${t.table_name} (${t.column_count} colunas)`);
    });
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    await sql.end();
    process.exit(1);
  }
}

createInventoryTables();
