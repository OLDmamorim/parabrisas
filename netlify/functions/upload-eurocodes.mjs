// /.netlify/functions/upload-eurocodes.mjs
// Função para processar upload de Excel e atualizar base de dados de eurocodes
import { jsonHeaders } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

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
    
    // Verificar se o utilizador é gestor ou administrador
    if (user.role !== 'gestor' && user.role !== 'administrador') {
      return cors(403, { ok: false, error: 'Acesso negado. Apenas gestores/administradores podem atualizar eurocodes.' });
    }

    console.log('📤 Gestor a fazer upload de eurocodes:', user.email);

    const payload = JSON.parse(event.body || '{}');
    const { eurocodes } = payload; // Array de { prefix, marca, modelo }
    
    if (!Array.isArray(eurocodes) || eurocodes.length === 0) {
      return cors(400, { ok: false, error: 'Array de eurocodes é obrigatório' });
    }

    console.log(`📊 Recebidos ${eurocodes.length} eurocodes para processar`);

    // Ler ficheiro atual
    const mappingPath = join(process.cwd(), 'eurocode-mapping.mjs');
    let currentContent = '';
    
    try {
      currentContent = await readFile(mappingPath, 'utf-8');
    } catch (e) {
      console.log('⚠️ Ficheiro não existe, será criado');
    }

    // Extrair eurocodes existentes
    const existingPrefixes = new Set();
    const prefixRegex = /'(\d{4})':/g;
    let match;
    
    while ((match = prefixRegex.exec(currentContent)) !== null) {
      existingPrefixes.add(match[1]);
    }

    console.log(`📋 Eurocodes existentes: ${existingPrefixes.size}`);

    // Filtrar apenas novos eurocodes
    const newEurocodes = eurocodes.filter(e => !existingPrefixes.has(e.prefix));
    
    console.log(`✨ Novos eurocodes a adicionar: ${newEurocodes.length}`);

    if (newEurocodes.length === 0) {
      return cors(200, {
        ok: true,
        message: 'Nenhum eurocode novo para adicionar',
        total_received: eurocodes.length,
        already_exists: eurocodes.length,
        added: 0
      });
    }

    // Gerar novas entradas
    const newEntries = newEurocodes.map(e => {
      const modeloStr = e.modelo ? `'${e.modelo}'` : 'null';
      return `  '${e.prefix}': { marca: '${e.marca}', modelo: ${modeloStr} },`;
    }).join('\n');

    // Atualizar ficheiro
    let updatedContent;
    
    if (currentContent.includes('export const EUROCODE_PREFIX_MAP = {')) {
      // Adicionar antes do último }
      const lastBraceIndex = currentContent.lastIndexOf('};');
      updatedContent = 
        currentContent.substring(0, lastBraceIndex) +
        newEntries + '\n' +
        currentContent.substring(lastBraceIndex);
    } else {
      // Criar ficheiro novo
      updatedContent = `// Base de dados de Eurocodes
// Atualizado automaticamente via upload
// Total: ${newEurocodes.length} prefixos
// Última atualização: ${new Date().toISOString()}

export const EUROCODE_PREFIX_MAP = {
${newEntries}
};

export function getVehicleFromEurocode(eurocode) {
  if (!eurocode) return null;
  
  const prefix = eurocode.replace(/[#*]/g, '').substring(0, 4);
  const info = EUROCODE_PREFIX_MAP[prefix];
  
  if (!info) return null;
  
  if (info.marca && info.modelo) {
    return \`\${info.marca} \${info.modelo}\`;
  }
  
  if (info.marca) {
    return info.marca;
  }
  
  return null;
}
`;
    }

    // Atualizar comentário do cabeçalho com novo total
    const totalPrefixes = existingPrefixes.size + newEurocodes.length;
    updatedContent = updatedContent.replace(
      /\/\/ Total: \d+ prefixos/,
      `// Total: ${totalPrefixes} prefixos`
    );
    updatedContent = updatedContent.replace(
      /\/\/ Última atualização: .*/,
      `// Última atualização: ${new Date().toISOString()}`
    );

    // Guardar ficheiro
    await writeFile(mappingPath, updatedContent, 'utf-8');

    console.log('✅ Ficheiro eurocode-mapping.mjs atualizado com sucesso');

    return cors(200, {
      ok: true,
      message: 'Eurocodes atualizados com sucesso',
      total_received: eurocodes.length,
      already_exists: eurocodes.length - newEurocodes.length,
      added: newEurocodes.length,
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

