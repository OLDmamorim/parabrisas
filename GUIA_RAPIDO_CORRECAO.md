# Guia Rápido de Correção - Upload de Eurocodes

## ⚠️ Erro que Encontrou

O erro `ERROR: syntax error at or near "migration" (SQLSTATE 42601)` acontece porque está a tentar executar o ficheiro SQL diretamente como comando.

## ✅ Solução Correta (3 Passos Simples)

### Passo 1: Criar a Tabela via Interface Web

Criei uma página HTML que faz isso automaticamente:

1. **Fazer commit e push dos novos ficheiros:**
```bash
cd /home/ubuntu/parabrisas
git add netlify/functions/init-eurocodes-table.mjs
git add init-eurocodes-table.html
git commit -m "Add: Função para inicializar tabela de eurocodes"
git push origin main
```

2. **Aguardar deploy no Netlify** (1-2 minutos)

3. **Aceder à página:**
   - URL: `https://seu-site.netlify.app/init-eurocodes-table.html`
   - Fazer login se necessário
   - Clicar no botão "Criar Tabela de Eurocodes"
   - Aguardar mensagem de sucesso

4. **Resultado esperado:**
   ```
   ✅ Tabela criada com sucesso!
   Registos existentes: 0
   ```

---

### Passo 2: Migrar os 676 Eurocodes Existentes

Agora precisa de importar os dados do ficheiro `eurocode-mapping.mjs` para a base de dados.

**Opção A: Executar Localmente (RECOMENDADO)**

```bash
# 1. Configurar variável de ambiente
export NEON_DATABASE_URL="sua-connection-string-aqui"

# 2. Executar script de migração
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
✅ Migração concluída!
📊 Estatísticas:
   • Total no ficheiro: 676
   • Adicionados: 676
   • Já existiam: 0
   • Erros: 0
📈 Total de eurocodes na BD: 676
🎉 Migração concluída com sucesso!
```

**Opção B: Via Função Netlify (se não conseguir executar localmente)**

Vou criar uma função que pode executar via browser.

---

### Passo 3: Substituir a Função de Upload

```bash
# 1. Fazer backup da função original
cp netlify/functions/upload-eurocodes.mjs netlify/functions/upload-eurocodes.mjs.backup

# 2. Substituir pela versão corrigida
cp upload-eurocodes-FIXED.mjs netlify/functions/upload-eurocodes.mjs

# 3. Adicionar função de lookup
cp get-vehicle-from-eurocode.mjs netlify/functions/get-vehicle-from-eurocode.mjs

# 4. Commit e push
git add netlify/functions/
git commit -m "Fix: Migrar upload de eurocodes para PostgreSQL"
git push origin main
```

---

## 🧪 Testar Funcionalidade

Após os 3 passos:

1. **Aceder a:** `https://seu-site.netlify.app/upload-eurocodes.html`
2. **Fazer login como gestor ou admin**
3. **Criar ficheiro Excel de teste** com:
   - Coluna A: `9999`
   - Coluna B: `MARCA TESTE`
   - Coluna C: `MODELO TESTE`
4. **Fazer upload**
5. **Verificar mensagem de sucesso:**
   ```
   ✅ Eurocodes atualizados com sucesso!
   Recebidos: 1
   Adicionados: 1
   Já Existiam: 0
   Total na BD: 677
   ```

---

## 🔍 Verificar na Base de Dados

Se tiver acesso ao Neon Dashboard:

```sql
-- Ver total
SELECT COUNT(*) FROM eurocodes;

-- Ver últimos adicionados
SELECT prefix, marca, modelo, created_at 
FROM eurocodes 
ORDER BY created_at DESC 
LIMIT 10;

-- Procurar específico
SELECT * FROM eurocodes WHERE prefix = '2436';
```

---

## ❓ Precisa de Ajuda com o Passo 2?

Se não conseguir executar o script localmente (Opção A), posso criar uma função Netlify para migrar os dados via browser (Opção B). Informe-me se precisa dessa alternativa.

---

## 📋 Checklist de Progresso

- [ ] Passo 1: Tabela criada via `init-eurocodes-table.html`
- [ ] Passo 2: 676 eurocodes migrados via `migrate-eurocodes-data.mjs`
- [ ] Passo 3: Função de upload substituída e deploy feito
- [ ] Teste: Upload de eurocode novo funciona
- [ ] Verificação: Total de 676+ eurocodes na base de dados

---

## 🆘 Resolução de Problemas

### Erro: "Não autenticado"
**Solução:** Fazer login no sistema antes de aceder às páginas

### Erro: "NEON_DATABASE_URL não definido"
**Solução:** Configurar variável de ambiente no Netlify ou localmente

### Erro: "Table already exists"
**Solução:** Normal, a tabela já foi criada. Pode prosseguir para o Passo 2

### Erro ao migrar dados
**Solução:** Verificar se a variável `NEON_DATABASE_URL` está correta

---

## 📞 Próximos Passos

1. Execute o **Passo 1** agora (criar tabela via interface web)
2. Informe-me quando concluir para eu ajudar com o **Passo 2** (migração de dados)
3. Depois faremos o **Passo 3** (substituir função e testar)

Vamos fazer isto passo a passo! 🚀

