// Script para extrair mapeamento Eurocode → Veículo da base de dados
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ NEON_DATABASE_URL não configurada');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function extractEurocodeMapping() {
  try {
    console.log('🔍 Extraindo mapeamento Eurocode → Veículo da base de dados...\n');
    
    // Buscar todos os registos com eurocode e vehicle
    const results = await sql`
      SELECT DISTINCT 
        eurocode, 
        vehicle,
        COUNT(*) as count
      FROM ocr_results 
      WHERE eurocode IS NOT NULL 
        AND eurocode != '' 
        AND vehicle IS NOT NULL 
        AND vehicle != ''
      GROUP BY eurocode, vehicle
      ORDER BY eurocode, count DESC
    `;
    
    console.log(`📊 Total de registos únicos: ${results.length}\n`);
    
    // Agrupar por prefixo (primeiros 4 dígitos)
    const prefixMap = {};
    
    for (const row of results) {
      const eurocode = row.eurocode.trim();
      const vehicle = row.vehicle.trim();
      const count = parseInt(row.count);
      
      // Extrair prefixo (primeiros 4 dígitos)
      const prefixMatch = eurocode.match(/^(\d{4})/);
      if (!prefixMatch) continue;
      
      const prefix = prefixMatch[1];
      
      if (!prefixMap[prefix]) {
        prefixMap[prefix] = {};
      }
      
      if (!prefixMap[prefix][vehicle]) {
        prefixMap[prefix][vehicle] = 0;
      }
      
      prefixMap[prefix][vehicle] += count;
    }
    
    // Gerar tabela de mapeamento
    console.log('📋 Mapeamento Eurocode Prefix → Veículo:\n');
    console.log('```javascript');
    console.log('const EUROCODE_PREFIX_MAP = {');
    
    const sortedPrefixes = Object.keys(prefixMap).sort();
    
    for (const prefix of sortedPrefixes) {
      const vehicles = prefixMap[prefix];
      
      // Encontrar o veículo mais comum para este prefixo
      let mostCommon = null;
      let maxCount = 0;
      
      for (const [vehicle, count] of Object.entries(vehicles)) {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = vehicle;
        }
      }
      
      if (mostCommon) {
        // Tentar separar marca e modelo
        const parts = mostCommon.split(' ');
        const marca = parts[0] || mostCommon;
        const modelo = parts.slice(1).join(' ') || null;
        
        console.log(`  '${prefix}': { marca: '${marca}', modelo: ${modelo ? `'${modelo}'` : 'null'} }, // ${maxCount}x`);
      }
    }
    
    console.log('};');
    console.log('```\n');
    
    // Estatísticas
    console.log('📊 Estatísticas:');
    console.log(`   - Prefixos únicos: ${sortedPrefixes.length}`);
    console.log(`   - Eurocodes únicos: ${results.length}`);
    console.log(`   - Cobertura: ${sortedPrefixes.length} veículos diferentes\n`);
    
    // Mostrar exemplos
    console.log('📝 Exemplos de Eurocodes encontrados:');
    const examples = results.slice(0, 10);
    for (const ex of examples) {
      console.log(`   ${ex.eurocode} → ${ex.vehicle} (${ex.count}x)`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

extractEurocodeMapping();

