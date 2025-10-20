# Instruções para Correção do Upload de Eurocodes

## Resumo do Problema

O botão de upload de Excel para atualizar eurocodes não funciona porque a função Netlify tenta escrever num ficheiro estático (`eurocode-mapping.mjs`), o que não é possível em ambientes serverless onde o sistema de ficheiros é read-only.

## Solução Implementada

Migrar o armazenamento de eurocodes de um ficheiro JavaScript estático para a base de dados PostgreSQL (Neon) já utilizada no projeto.

## Ficheiros Criados

1. **migration-create-eurocodes-table.sql** - Script SQL para criar a tabela
2. **migrate-eurocodes-data.mjs** - Script Node.js para migrar dados existentes
3. **upload-eurocodes-FIXED.mjs** - Versão corrigida da função de upload
4. **get-vehicle-from-eurocode.mjs** - Nova função para lookup de veículos

## Passo a Passo de Implementação

### Passo 1: Criar a Tabela na Base de Dados

Existem duas formas de criar a tabela:

#### Opção A: Executar SQL manualmente no Neon Dashboard
1. Aceder ao dashboard do Neon: https://console.neon.tech
2. Selecionar o projeto ExpressGlass
3. Abrir o SQL Editor
4. Copiar e executar o conteúdo de `migration-create-eurocodes-table.sql`

#### Opção B: Criar função Netlify temporária
1. Criar ficheiro `netlify/functions/init-eurocodes-table.mjs`:
```javascript
import { sql } from './db.mjs';
import { jsonHeaders } from './db.mjs';

export const handler = async () => {
  try {
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
    
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_prefix ON eurocodes(prefix)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_eurocodes_marca ON eurocodes(marca)`;
    
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, message: 'Tabela criada com sucesso' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

2. Fazer deploy
3. Aceder a `https://seu-site.netlify.app/.netlify/functions/init-eurocodes-table`
4. Apagar o ficheiro após execução

### Passo 2: Migrar Dados Existentes

#### Opção A: Executar script localmente (RECOMENDADO)

**Pré-requisitos:**
- Node.js instalado
- Variável de ambiente `NEON_DATABASE_URL` configurada

**Passos:**
```bash
# 1. Navegar para a pasta do projeto
cd /caminho/para/parabrisas

# 2. Instalar dependências (se ainda não instaladas)
npm install

# 3. Configurar variável de ambiente
export NEON_DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# 4. Executar script de migração
node migrate-eurocodes-data.mjs
```

**Resultado esperado:**
```
🔄 A iniciar migração de eurocodes para base de dados...

📋 A criar tabela eurocodes...
🔍 A criar índices...
📊 Eurocodes existentes na BD: 0

📁 Eurocodes no ficheiro: 676

⏳ A migrar eurocodes...
   ✓ 50 eurocodes migrados...
   ✓ 100 eurocodes migrados...
   ...
   ✓ 650 eurocodes migrados...

✅ Migração concluída!

📊 Estatísticas:
   • Total no ficheiro: 676
   • Adicionados: 676
   • Já existiam: 0
   • Erros: 0

📈 Total de eurocodes na BD: 676

📝 Exemplos de eurocodes migrados:
   • 2436: BMW SERIE 3 E46
   • 2437: BMW SERIE 3 E46
   • 2439: BMW X5 E53
   • 2440: BMW NEW MINI
   • 2442: VQL BMW E46 COMPACT

🎉 Migração concluída com sucesso!

👋 A terminar...
```

#### Opção B: Criar função Netlify temporária

Se não for possível executar localmente, criar função Netlify:

1. Criar ficheiro `netlify/functions/migrate-eurocodes.mjs`:
```javascript
import { sql } from './db.mjs';
import { jsonHeaders } from './db.mjs';
import { requireAdmin } from './auth-utils.mjs';

// Importar dados do ficheiro (ajustar caminho se necessário)
import { EUROCODE_PREFIX_MAP } from '../../eurocode-mapping.mjs';

export const handler = async (event) => {
  try {
    // Verificar autenticação (apenas admin)
    await requireAdmin(event);
    
    const entries = Object.entries(EUROCODE_PREFIX_MAP);
    let addedCount = 0;
    
    for (const [prefix, { marca, modelo }] of entries) {
      const result = await sql`
        INSERT INTO eurocodes (prefix, marca, modelo)
        VALUES (${prefix}, ${marca}, ${modelo})
        ON CONFLICT (prefix) DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) addedCount++;
    }
    
    const totalCount = await sql`SELECT COUNT(*) as count FROM eurocodes`;
    
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        ok: true, 
        message: 'Migração concluída',
        total_file: entries.length,
        added: addedCount,
        total_db: totalCount[0].count
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};
```

2. Fazer deploy
3. Fazer login como admin
4. Aceder a `https://seu-site.netlify.app/.netlify/functions/migrate-eurocodes` com token de autenticação
5. Apagar o ficheiro após execução

### Passo 3: Substituir Função de Upload

1. **Fazer backup da função original:**
```bash
cp netlify/functions/upload-eurocodes.mjs netlify/functions/upload-eurocodes.mjs.backup
```

2. **Substituir pela versão corrigida:**
```bash
cp upload-eurocodes-FIXED.mjs netlify/functions/upload-eurocodes.mjs
```

3. **Verificar o conteúdo:**
```bash
cat netlify/functions/upload-eurocodes.mjs
```

### Passo 4: Adicionar Função de Lookup (Opcional)

Se o sistema usar a função `getVehicleFromEurocode()` do ficheiro `eurocode-mapping.mjs`, é necessário criar uma API equivalente:

1. **Copiar função para pasta Netlify:**
```bash
cp get-vehicle-from-eurocode.mjs netlify/functions/get-vehicle-from-eurocode.mjs
```

2. **Atualizar código frontend que usa a função:**

**Antes (código antigo):**
```javascript
import { getVehicleFromEurocode } from './eurocode-mapping.mjs';

const vehicle = getVehicleFromEurocode(eurocode);
```

**Depois (código novo):**
```javascript
async function getVehicleFromEurocode(eurocode) {
  const response = await fetch('/.netlify/functions/get-vehicle-from-eurocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eurocode })
  });
  
  const data = await response.json();
  return data.vehicle;
}

const vehicle = await getVehicleFromEurocode(eurocode);
```

### Passo 5: Fazer Deploy

1. **Commit das alterações:**
```bash
git add netlify/functions/upload-eurocodes.mjs
git add netlify/functions/get-vehicle-from-eurocode.mjs
git commit -m "Fix: Migrar eurocodes para base de dados PostgreSQL"
```

2. **Push para GitHub:**
```bash
git push origin main
```

3. **Aguardar deploy automático no Netlify**

### Passo 6: Testar Funcionalidade

1. **Fazer login no sistema como gestor ou admin**

2. **Aceder à página de upload:**
   - URL: `https://seu-site.netlify.app/upload-eurocodes.html`

3. **Preparar ficheiro Excel de teste:**
   - Criar ficheiro `test-eurocodes.xlsx`
   - Adicionar dados:
     | Coluna A | Coluna B | Coluna C |
     |----------|----------|----------|
     | 9999 | MARCA TESTE | MODELO TESTE |
     | 9998 | OUTRA MARCA | OUTRO MODELO |

4. **Fazer upload do ficheiro:**
   - Selecionar ficheiro
   - Clicar em "Processar e Atualizar"
   - Verificar mensagem de sucesso

5. **Verificar resultado esperado:**
```json
{
  "ok": true,
  "message": "Eurocodes atualizados com sucesso",
  "total_received": 2,
  "already_exists": 0,
  "added": 2,
  "total_prefixes": 678
}
```

6. **Testar lookup (se implementado):**
```bash
curl -X POST https://seu-site.netlify.app/.netlify/functions/get-vehicle-from-eurocode \
  -H "Content-Type: application/json" \
  -d '{"eurocode":"9999"}'
```

**Resultado esperado:**
```json
{
  "ok": true,
  "vehicle": "MARCA TESTE MODELO TESTE",
  "marca": "MARCA TESTE",
  "modelo": "MODELO TESTE",
  "prefix": "9999",
  "found": true
}
```

## Verificação de Sucesso

### Checklist de Testes

- [ ] Tabela `eurocodes` criada na base de dados
- [ ] 676 eurocodes migrados do ficheiro para a BD
- [ ] Upload de novos eurocodes funciona sem erros
- [ ] Eurocodes duplicados são ignorados corretamente
- [ ] Estatísticas são retornadas corretamente
- [ ] Função de lookup retorna veículos corretos (se implementada)
- [ ] Apenas gestores e admins conseguem fazer upload

### Comandos SQL para Verificação

```sql
-- Verificar total de eurocodes
SELECT COUNT(*) FROM eurocodes;

-- Verificar últimos eurocodes adicionados
SELECT prefix, marca, modelo, created_at 
FROM eurocodes 
ORDER BY created_at DESC 
LIMIT 10;

-- Procurar eurocode específico
SELECT * FROM eurocodes WHERE prefix = '2436';

-- Verificar eurocodes por marca
SELECT COUNT(*) as total, marca 
FROM eurocodes 
GROUP BY marca 
ORDER BY total DESC 
LIMIT 10;
```

## Rollback (Se Necessário)

Se algo correr mal, é possível reverter:

1. **Restaurar função original:**
```bash
cp netlify/functions/upload-eurocodes.mjs.backup netlify/functions/upload-eurocodes.mjs
git add netlify/functions/upload-eurocodes.mjs
git commit -m "Rollback: Restaurar versão original do upload-eurocodes"
git push origin main
```

2. **Apagar tabela (se necessário):**
```sql
DROP TABLE IF EXISTS eurocodes CASCADE;
```

## Melhorias Futuras (Opcional)

### 1. Adicionar Auditoria
```sql
ALTER TABLE eurocodes ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE eurocodes ADD COLUMN updated_by INTEGER REFERENCES users(id);
```

### 2. Adicionar Soft Delete
```sql
ALTER TABLE eurocodes ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE eurocodes ADD COLUMN deleted_by INTEGER REFERENCES users(id);
```

### 3. Criar Histórico de Alterações
```sql
CREATE TABLE eurocodes_history (
  id SERIAL PRIMARY KEY,
  eurocode_id INTEGER REFERENCES eurocodes(id),
  prefix VARCHAR(4),
  marca VARCHAR(100),
  modelo VARCHAR(100),
  action VARCHAR(20), -- 'INSERT', 'UPDATE', 'DELETE'
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Adicionar Cache
Implementar cache Redis ou Netlify Edge Functions para melhorar performance de lookup.

### 5. Adicionar Validação de Dados
- Validar formato de prefixo (4 dígitos)
- Validar comprimento de marca e modelo
- Normalizar texto (uppercase, trim)

## Suporte

Se encontrar problemas durante a implementação:

1. Verificar logs do Netlify Functions
2. Verificar logs da base de dados Neon
3. Verificar variáveis de ambiente configuradas
4. Testar funções individualmente

## Conclusão

Após seguir estes passos, o sistema de upload de eurocodes estará totalmente funcional e os dados estarão persistidos de forma segura na base de dados PostgreSQL, permitindo escalabilidade e consistência com o resto da aplicação.

