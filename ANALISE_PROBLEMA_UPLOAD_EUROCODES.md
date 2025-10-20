# Análise do Problema: Upload de Eurocodes

## Data da Análise
20 de outubro de 2025

## Problema Identificado

O botão de upload de Excel para atualizar a base de dados de eurocodes apresenta **múltiplos problemas** relacionados com a arquitetura e inconsistências no projeto.

## Localização do Código

### Frontend
- **Ficheiro:** `upload-eurocodes.html`
- **Linha 401:** Chamada à função Netlify
```javascript
const response = await fetch('/.netlify/functions/upload-eurocodes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ eurocodes: parsedEurocodes })
});
```

### Backend (Função Netlify)
- **Ficheiro:** `netlify/functions/upload-eurocodes.mjs`
- **Linha 4:** Importação do auth-utils
```javascript
import { requireAuth } from '../../auth-utils.mjs';
```

## Descoberta Crítica: Inconsistência no Projeto

Após análise de todas as funções Netlify, descobriu-se uma **inconsistência grave** no projeto:

### Padrão de Importação Misto

**11 funções** importam `requireAuth` do ficheiro na raiz:
```javascript
import { requireAuth } from '../../auth-utils.mjs';
```

Funções afetadas:
1. `auth-me.mjs`
2. `delete-ocr.mjs`
3. `edit-ocr.mjs`
4. `list-ocr-gestor.mjs`
5. `list-ocr.mjs`
6. `list-users.mjs`
7. `migrate-add-saida-timestamp.mjs`
8. `migrate-add-user-role.mjs`
9. `save-ocr.mjs`
10. `update-ocr.mjs`
11. `upload-eurocodes.mjs` ⬅️ **Função em análise**

**1 função** importa `requireAuth` do ficheiro local:
```javascript
import { requireAuth } from './auth-utils.mjs';
```

Função:
- `clear-ocr.mjs` ✅ **Única função diferente**

### Estrutura de Ficheiros

```
parabrisas/
├── auth-utils.mjs              # Ficheiro na raiz (usado por 11 funções)
├── db.mjs                      # Ficheiro na raiz
├── netlify/
│   └── functions/
│       ├── auth-utils.mjs      # Ficheiro local (usado por 1 função)
│       ├── db.mjs              # Ficheiro local
│       └── upload-eurocodes.mjs # Função com importação da raiz
```

## Análise Detalhada

### Causa Raiz do Problema

**O problema NÃO é o caminho de importação**, mas sim a **arquitetura da função** que tenta escrever em ficheiros estáticos num ambiente serverless.

### Importações na Função `upload-eurocodes.mjs`

1. **Linha 3:** `import { jsonHeaders } from './db.mjs';` ✅ **CORRETO** (ficheiro local)
2. **Linha 4:** `import { requireAuth } from '../../auth-utils.mjs';` ✅ **CORRETO** (padrão do projeto)
3. **Linha 5-6:** `import { readFile, writeFile } from 'fs/promises';` ❌ **PROBLEMÁTICO**

## Problema Principal: Sistema de Ficheiros Read-Only

### Tentativa de Escrita em Ficheiro
```javascript
// Linha 39
const mappingPath = join(process.cwd(), 'eurocode-mapping.mjs');

// Linha 134
await writeFile(mappingPath, updatedContent, 'utf-8');
```

**Problema:** Em ambientes serverless como Netlify Functions, o sistema de ficheiros é **read-only** após o deploy. Não é possível escrever em ficheiros estáticos durante o runtime.

### Comportamento Esperado vs. Real

| Ação | Esperado | Real |
|------|----------|------|
| Ler ficheiro | ✅ Funciona | ✅ Funciona |
| Escrever ficheiro | ✅ Funciona (local) | ❌ Falha (Netlify) |
| Persistir dados | ✅ Permanente | ❌ Temporário (se funcionar) |

## Impacto do Problema

1. **Erro de Runtime:** A função falha ao tentar escrever no ficheiro `eurocode-mapping.mjs`
2. **Dados Não Persistem:** Mesmo que a escrita funcione temporariamente, os dados são perdidos no próximo deploy
3. **Upload Bloqueado:** Nenhum eurocode pode ser carregado através da interface
4. **Inconsistência de Dados:** O ficheiro `eurocode-mapping.mjs` nunca é atualizado

## Fluxo Atual (Problemático)

1. Utilizador seleciona ficheiro Excel com eurocodes ✅
2. Frontend valida e processa o Excel usando biblioteca XLSX ✅
3. Frontend envia array de eurocodes para a função Netlify ✅
4. Função valida autenticação usando `requireAuth` ✅
5. Função verifica se utilizador é 'gestor' ou 'admin' ✅
6. Função lê ficheiro `eurocode-mapping.mjs` existente ✅
7. Função filtra eurocodes duplicados ✅
8. **Função tenta escrever no ficheiro** ❌ **FALHA AQUI**
9. Função retorna erro ao frontend ❌

## Soluções Propostas

### Solução 1: Migrar para Base de Dados (RECOMENDADA)

#### Passo 1: Criar Tabela de Eurocodes
```sql
CREATE TABLE IF NOT EXISTS eurocodes (
  id SERIAL PRIMARY KEY,
  prefix VARCHAR(4) UNIQUE NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eurocodes_prefix ON eurocodes(prefix);
```

#### Passo 2: Modificar Função `upload-eurocodes.mjs`
```javascript
// Importar sql do db.mjs
import { jsonHeaders, sql } from './db.mjs';
import { requireAuth } from '../../auth-utils.mjs';

export const handler = async (event) => {
  // ... validações ...
  
  // Verificar eurocodes existentes
  const existingPrefixes = await sql`
    SELECT prefix FROM eurocodes
  `;
  const existingSet = new Set(existingPrefixes.map(e => e.prefix));
  
  // Filtrar novos eurocodes
  const newEurocodes = eurocodes.filter(e => !existingSet.has(e.prefix));
  
  // Inserir novos eurocodes
  if (newEurocodes.length > 0) {
    await sql`
      INSERT INTO eurocodes (prefix, marca, modelo)
      SELECT * FROM UNNEST(
        ${sql.array(newEurocodes.map(e => e.prefix))}::varchar[],
        ${sql.array(newEurocodes.map(e => e.marca))}::varchar[],
        ${sql.array(newEurocodes.map(e => e.modelo || null))}::varchar[]
      )
      ON CONFLICT (prefix) DO NOTHING
    `;
  }
  
  // Retornar estatísticas
  const totalPrefixes = await sql`SELECT COUNT(*) as count FROM eurocodes`;
  
  return cors(200, {
    ok: true,
    message: 'Eurocodes atualizados com sucesso',
    total_received: eurocodes.length,
    already_exists: eurocodes.length - newEurocodes.length,
    added: newEurocodes.length,
    total_prefixes: totalPrefixes[0].count
  });
};
```

#### Passo 3: Criar Função de Lookup
```javascript
// netlify/functions/get-vehicle-from-eurocode.mjs
import { jsonHeaders, sql } from './db.mjs';

export const handler = async (event) => {
  const { eurocode } = JSON.parse(event.body || '{}');
  
  if (!eurocode) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: 'Eurocode é obrigatório' })
    };
  }
  
  const prefix = eurocode.replace(/[#*]/g, '').substring(0, 4);
  
  const result = await sql`
    SELECT marca, modelo FROM eurocodes WHERE prefix = ${prefix}
  `;
  
  if (result.length === 0) {
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, vehicle: null })
    };
  }
  
  const { marca, modelo } = result[0];
  const vehicle = modelo ? `${marca} ${modelo}` : marca;
  
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ ok: true, vehicle })
  };
};
```

#### Passo 4: Migrar Dados Existentes
```javascript
// Script de migração: migrate-eurocodes-to-db.mjs
import { sql } from './netlify/functions/db.mjs';
import { EUROCODE_PREFIX_MAP } from './eurocode-mapping.mjs';

async function migrate() {
  console.log('🔄 A migrar eurocodes para base de dados...');
  
  const entries = Object.entries(EUROCODE_PREFIX_MAP);
  
  for (const [prefix, { marca, modelo }] of entries) {
    await sql`
      INSERT INTO eurocodes (prefix, marca, modelo)
      VALUES (${prefix}, ${marca}, ${modelo})
      ON CONFLICT (prefix) DO NOTHING
    `;
  }
  
  console.log(`✅ ${entries.length} eurocodes migrados com sucesso`);
}

migrate().catch(console.error);
```

### Solução 2: Usar Netlify Blobs (Alternativa)

Netlify oferece um serviço de armazenamento de blobs que permite escrita durante runtime:

```javascript
import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
  const store = getStore('eurocodes');
  
  // Ler dados existentes
  const existingData = await store.get('mapping') || '{}';
  const mapping = JSON.parse(existingData);
  
  // Adicionar novos eurocodes
  for (const eurocode of newEurocodes) {
    mapping[eurocode.prefix] = {
      marca: eurocode.marca,
      modelo: eurocode.modelo
    };
  }
  
  // Guardar dados atualizados
  await store.set('mapping', JSON.stringify(mapping));
  
  return cors(200, { ok: true, message: 'Eurocodes atualizados' });
};
```

**Nota:** Requer instalação de `@netlify/blobs` e configuração adicional.

### Solução 3: Usar Variáveis de Ambiente (Não Recomendada)

Armazenar eurocodes em variáveis de ambiente, mas tem limitações:
- Limite de tamanho (4KB por variável)
- Requer redeploy para atualizar
- Não escalável

## Recomendação Final

**Implementar Solução 1: Migrar para Base de Dados**

### Vantagens:
✅ Persistência garantida  
✅ Escalável (milhares de eurocodes)  
✅ Queries rápidas com índices  
✅ Consistente com o resto do projeto (já usa Neon PostgreSQL)  
✅ Permite auditoria (created_at, updated_at)  
✅ Suporta operações CRUD completas  

### Desvantagens:
❌ Requer migração de dados existentes  
❌ Requer criação de nova função de lookup  
❌ Requer atualização do frontend (se usar lookup)  

## Próximos Passos

1. **Criar tabela `eurocodes` na base de dados**
2. **Migrar dados do ficheiro `eurocode-mapping.mjs` para a tabela**
3. **Refatorar função `upload-eurocodes.mjs` para usar SQL**
4. **Criar função `get-vehicle-from-eurocode.mjs` para lookup**
5. **Atualizar frontend para usar nova API de lookup** (se necessário)
6. **Testar upload de eurocodes**
7. **Testar lookup de veículos**
8. **Remover ficheiro `eurocode-mapping.mjs` (opcional)**

## Conclusão

O problema não é o caminho de importação (que está correto segundo o padrão do projeto), mas sim a **tentativa de escrever em ficheiros estáticos num ambiente serverless**. A solução correta é migrar o armazenamento de eurocodes para a base de dados PostgreSQL já existente no projeto, garantindo persistência, escalabilidade e consistência com a arquitetura atual.

