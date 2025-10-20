# 📤 Como Fazer Upload de Novos Eurocodes

## 🎯 Acesso Rápido

**URL do Upload:** https://parabrisas.netlify.app/upload-eurocodes.html

---

## 📋 Passo a Passo Completo

### 1️⃣ Aceder à Página de Upload

1. Abrir o browser
2. Ir para: **https://parabrisas.netlify.app/upload-eurocodes.html**
3. Fazer login (se ainda não estiver autenticado)
   - Email: `mramorim78@gmail.com`
   - Password: `XGl@55#2021ab2021`

### 2️⃣ Preparar o Ficheiro Excel

O ficheiro Excel deve ter **3 colunas** (A, B, C):

| Coluna A | Coluna B | Coluna C |
|----------|----------|----------|
| **Prefixo** | **Marca** | **Modelo** |
| 2436 | BMW | SERIE 3 E46 |
| 1234 | MERCEDES | CLASSE A |
| 5678 | AUDI | A4 |

**Formato aceite:**
- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)

**Regras importantes:**
- ✅ **Coluna A:** Prefixo do eurocode (4 dígitos, ex: 2436)
- ✅ **Coluna B:** Marca do veículo (ex: BMW, MERCEDES)
- ✅ **Coluna C:** Modelo do veículo (ex: SERIE 3 E46) - pode estar vazio
- ⚠️ **Nota:** Eurocodes duplicados são automaticamente ignorados

### 3️⃣ Fazer Upload

1. Na página de upload, clicar em **"Clique ou arraste o ficheiro Excel aqui"**
2. Selecionar o ficheiro Excel preparado
3. Clicar no botão **"🚀 Processar e Atualizar"**
4. Aguardar processamento (alguns segundos)
5. ✅ Ver mensagem de sucesso com estatísticas:
   - Total recebidos
   - Adicionados
   - Já existiam
   - Total na base de dados

---

## 📊 Exemplo de Ficheiro Excel

### Criar Ficheiro de Teste

**No Excel ou Google Sheets:**

```
A1: 9999    B1: MARCA TESTE      C1: MODELO TESTE
A2: 9998    B2: OUTRA MARCA      C2: OUTRO MODELO
A3: 9997    B3: TERCEIRA MARCA   C3: (vazio)
```

Guardar como: `novos-eurocodes.xlsx`

---

## 🔐 Permissões

**Apenas utilizadores com as seguintes funções podem fazer upload:**
- ✅ **Admin**
- ✅ **Gestor**

Outros utilizadores verão mensagem de erro: "Acesso negado"

---

## 📍 Localização no Sistema Principal

### Opção 1: Acesso Direto
- URL: https://parabrisas.netlify.app/upload-eurocodes.html

### Opção 2: Através do Sistema Principal
1. Aceder a: https://parabrisas.netlify.app
2. Fazer login
3. Clicar no botão **"📊 Upload Eurocodes"** (no topo da página)

---

## ✅ Como Verificar se Funcionou

### Verificação Rápida
Após o upload, a página mostra:
```
✅ Upload concluído com sucesso!

📊 Estatísticas:
   • Total recebidos: 10
   • Adicionados: 8
   • Já existiam: 2
   • Total na base de dados: 684
```

### Verificação na Base de Dados
No Neon SQL Editor (https://console.neon.tech):
```sql
-- Ver total de eurocodes
SELECT COUNT(*) FROM eurocodes;

-- Ver últimos eurocodes adicionados
SELECT prefix, marca, modelo, created_at 
FROM eurocodes 
ORDER BY created_at DESC 
LIMIT 10;

-- Procurar eurocode específico
SELECT * FROM eurocodes WHERE prefix = '9999';
```

---

## ❓ Problemas Comuns

### Problema 1: "Erro 500" ou "Erro no servidor"
**Causa:** Variável de ambiente não configurada no Netlify  
**Solução:** Ver ficheiro `CONFIGURACAO_FINAL.md` para configurar `NEON_DATABASE_URL`

### Problema 2: "Acesso negado"
**Causa:** Utilizador não é Admin nem Gestor  
**Solução:** Fazer login com conta de Admin (`mramorim78@gmail.com`)

### Problema 3: "Formato de ficheiro inválido"
**Causa:** Ficheiro não é Excel (.xlsx ou .xls)  
**Solução:** Guardar ficheiro como Excel (não CSV ou TXT)

### Problema 4: "Dados inválidos"
**Causa:** Colunas A ou B vazias  
**Solução:** Garantir que todas as linhas têm Prefixo (coluna A) e Marca (coluna B)

---

## 🎯 Fluxo Completo

```
1. Preparar Excel
   ↓
2. Aceder a https://parabrisas.netlify.app/upload-eurocodes.html
   ↓
3. Fazer login (se necessário)
   ↓
4. Selecionar ficheiro Excel
   ↓
5. Clicar "Processar e Atualizar"
   ↓
6. Aguardar processamento
   ↓
7. ✅ Ver mensagem de sucesso
   ↓
8. Eurocodes disponíveis no sistema!
```

---

## 📱 Acesso Móvel

O sistema também funciona em **dispositivos móveis**:
1. Abrir browser no telemóvel/tablet
2. Ir para: https://parabrisas.netlify.app/upload-eurocodes.html
3. Fazer login
4. Selecionar ficheiro Excel (do Google Drive, Dropbox, etc.)
5. Fazer upload

---

## 🔄 Atualizar Eurocodes Existentes

**Como funciona:**
- Se o **prefixo já existe** na BD → é **ignorado** (não atualiza)
- Se o **prefixo é novo** → é **adicionado**

**Para atualizar um eurocode existente:**
1. Eliminar o eurocode antigo da BD (via SQL)
2. Fazer upload do novo

**SQL para eliminar:**
```sql
DELETE FROM eurocodes WHERE prefix = '2436';
```

---

## 📞 Suporte

Se tiver problemas:
1. Verificar se está autenticado como Admin/Gestor
2. Verificar formato do ficheiro Excel
3. Ver mensagem de erro na página
4. Consultar ficheiro `CONFIGURACAO_FINAL.md` para verificar configuração

---

## 🎉 Resumo

**URL de Upload:** https://parabrisas.netlify.app/upload-eurocodes.html

**Formato Excel:**
- Coluna A: Prefixo (4 dígitos)
- Coluna B: Marca
- Coluna C: Modelo (opcional)

**Permissões:** Admin ou Gestor

**Após configurar `NEON_DATABASE_URL` no Netlify, está tudo pronto a funcionar! 🚀**

