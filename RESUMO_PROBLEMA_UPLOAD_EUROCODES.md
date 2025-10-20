# Resumo Executivo: Problema no Upload de Eurocodes

## 🔴 Problema Identificado

O botão de upload de Excel para atualizar a base de dados de eurocodes **não funciona** porque a função Netlify tenta escrever num ficheiro JavaScript estático (`eurocode-mapping.mjs`), o que é impossível em ambientes serverless onde o sistema de ficheiros é **read-only**.

## 📊 Diagnóstico

### Ficheiro Problemático
- **Localização:** `netlify/functions/upload-eurocodes.mjs`
- **Linhas críticas:** 39, 134

### Código Problemático
```javascript
// Linha 39: Tenta obter caminho do ficheiro
const mappingPath = join(process.cwd(), 'eurocode-mapping.mjs');

// Linha 134: Tenta escrever no ficheiro (FALHA)
await writeFile(mappingPath, updatedContent, 'utf-8');
```

### Por que Falha?
Em plataformas serverless como Netlify Functions:
- ✅ Sistema de ficheiros é **read-only** após deploy
- ❌ Não é possível criar ou modificar ficheiros durante runtime
- ❌ Alterações são perdidas entre invocações
- ❌ Não há persistência de dados em ficheiros

## ✅ Solução Implementada

Migrar o armazenamento de eurocodes de **ficheiro estático** para **base de dados PostgreSQL** (Neon).

### Vantagens da Solução
1. ✅ **Persistência garantida** - Dados nunca são perdidos
2. ✅ **Escalável** - Suporta milhares de eurocodes
3. ✅ **Rápido** - Queries otimizadas com índices
4. ✅ **Consistente** - Usa a mesma BD do resto do projeto
5. ✅ **Auditável** - Timestamps de criação e atualização
6. ✅ **Seguro** - Transações ACID

## 📦 Ficheiros Criados

| Ficheiro | Descrição |
|----------|-----------|
| `ANALISE_PROBLEMA_UPLOAD_EUROCODES.md` | Análise técnica detalhada do problema |
| `INSTRUCOES_CORRECAO_UPLOAD_EUROCODES.md` | Guia passo a passo de implementação |
| `migration-create-eurocodes-table.sql` | Script SQL para criar tabela |
| `migrate-eurocodes-data.mjs` | Script para migrar 676 eurocodes existentes |
| `upload-eurocodes-FIXED.mjs` | Versão corrigida da função de upload |
| `get-vehicle-from-eurocode.mjs` | Nova função API para lookup de veículos |

## 🚀 Implementação Rápida

### Passo 1: Criar Tabela
Executar no Neon SQL Editor:
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

### Passo 2: Migrar Dados
Executar localmente:
```bash
export NEON_DATABASE_URL="sua-connection-string"
node migrate-eurocodes-data.mjs
```

### Passo 3: Substituir Função
```bash
cp upload-eurocodes-FIXED.mjs netlify/functions/upload-eurocodes.mjs
cp get-vehicle-from-eurocode.mjs netlify/functions/get-vehicle-from-eurocode.mjs
```

### Passo 4: Deploy
```bash
git add netlify/functions/
git commit -m "Fix: Migrar eurocodes para PostgreSQL"
git push origin main
```

## 📈 Resultado Esperado

Após implementação:
- ✅ Upload de eurocodes funciona corretamente
- ✅ Dados persistem permanentemente na BD
- ✅ 676 eurocodes existentes migrados
- ✅ Novos eurocodes podem ser adicionados via Excel
- ✅ Duplicados são automaticamente ignorados
- ✅ API de lookup disponível

## 🔍 Informação Adicional

### Dados Atuais
- **Total de eurocodes no ficheiro:** 676 prefixos
- **Ficheiro atual:** `eurocode-mapping.mjs` (737 linhas)
- **Formato:** Objeto JavaScript com prefixos de 4 dígitos

### Estrutura de Dados
```javascript
{
  '2436': { marca: 'BMW SERIE', modelo: '3 E46' },
  '2437': { marca: 'BMW SERIE', modelo: '3 E46' },
  '2439': { marca: 'BMW', modelo: 'X5 E53' }
}
```

### Utilizadores Autorizados
Apenas utilizadores com role `gestor` ou `admin` podem fazer upload de eurocodes.

## 📞 Próximos Passos

1. Ler o documento **INSTRUCOES_CORRECAO_UPLOAD_EUROCODES.md** para detalhes completos
2. Seguir os passos de implementação
3. Testar funcionalidade após deploy
4. Verificar migração dos 676 eurocodes existentes

## ⚠️ Notas Importantes

- **Backup:** A função original foi preservada como `upload-eurocodes.mjs.backup`
- **Rollback:** Possível reverter alterações se necessário
- **Compatibilidade:** Solução mantém mesma interface frontend
- **Performance:** Queries otimizadas com índices PostgreSQL

## 📚 Documentação Completa

Para análise técnica detalhada, consultar:
- `ANALISE_PROBLEMA_UPLOAD_EUROCODES.md` - Análise completa do problema
- `INSTRUCOES_CORRECAO_UPLOAD_EUROCODES.md` - Guia de implementação detalhado

