# 🔐 Variáveis de Ambiente para Vercel

## 📋 Lista Completa de Variáveis

Configure estas **5 variáveis** no Vercel:

---

### 1. NEON_DATABASE_URL ⭐ OBRIGATÓRIA

**Valor:**
```
postgresql://neondb_owner:npg_ag5L8CwJelYZ@ep-round-mountain-ag2nhxlf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Descrição:** Connection string da base de dados PostgreSQL (Neon)

---

### 2. JWT_SECRET ⭐ OBRIGATÓRIA

**Valor:** (já configurado no Netlify)

**Descrição:** Chave secreta para gerar tokens JWT de autenticação

**Como obter:** Está configurado no Netlify. Preciso que aceda ao Netlify para copiar o valor.

**OU** pode gerar um novo:
```bash
# Gerar novo JWT_SECRET (64 caracteres aleatórios)
openssl rand -hex 32
```

---

### 3. ANTHROPIC_API_KEY ⚠️ OPCIONAL

**Valor:** (já configurado no Netlify)

**Descrição:** API key do Claude (Anthropic) para OCR avançado

**Nota:** Se não configurar, OCR pode ter funcionalidade limitada.

---

### 4. GCP_KEY_JSON ⚠️ OPCIONAL

**Valor:** (já configurado no Netlify)

**Descrição:** Credenciais do Google Cloud Platform para Vision API

**Nota:** Se não configurar, OCR do Google não funcionará.

---

### 5. DATABASE_URL (OPCIONAL - Duplicado)

**Valor:** (mesmo que NEON_DATABASE_URL)

**Descrição:** Algumas funções antigas podem usar este nome

---

## 🎯 Variáveis OBRIGATÓRIAS vs OPCIONAIS

### ✅ OBRIGATÓRIAS (Sistema funciona)
1. **NEON_DATABASE_URL** - Base de dados
2. **JWT_SECRET** - Autenticação

### ⚠️ OPCIONAIS (Funcionalidades extra)
3. **ANTHROPIC_API_KEY** - OCR com Claude
4. **GCP_KEY_JSON** - OCR com Google Vision

---

## 📝 Como Configurar no Vercel

### Passo 1: Aceder a Settings
1. Ir para projeto no Vercel
2. Clicar em **"Settings"**
3. Clicar em **"Environment Variables"**

### Passo 2: Adicionar Variáveis
Para cada variável:

1. **Key:** Nome da variável (ex: `NEON_DATABASE_URL`)
2. **Value:** Valor da variável (copiar da lista acima)
3. **Environments:** Selecionar **todos** (Production, Preview, Development)
4. Clicar **"Add"**

### Passo 3: Fazer Redeploy
Após adicionar todas as variáveis:
1. Ir para **"Deployments"**
2. Clicar nos **3 pontos** do último deploy
3. Clicar **"Redeploy"**

---

## 🔍 Onde Encontrar os Valores do Netlify

### JWT_SECRET
1. Aceder: https://app.netlify.com/sites/parabrisas/configuration/env
2. Procurar variável `JWT_SECRET`
3. Clicar em "👁️" para ver o valor
4. Copiar

### ANTHROPIC_API_KEY
1. Mesma página
2. Procurar `ANTHROPIC_API_KEY`
3. Copiar valor

### GCP_KEY_JSON
1. Mesma página
2. Procurar `GCP_KEY_JSON`
3. Copiar valor (é um JSON grande)

---

## ⚡ Configuração Rápida (Mínima)

Se quiser testar rapidamente, configure apenas:

### 1. NEON_DATABASE_URL
```
postgresql://neondb_owner:npg_ag5L8CwJelYZ@ep-round-mountain-ag2nhxlf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 2. JWT_SECRET
Gerar novo:
```bash
# No terminal
openssl rand -hex 32
```

Ou usar um valor temporário:
```
sua_chave_secreta_muito_segura_aqui_com_pelo_menos_32_caracteres
```

---

## 🎯 Resumo

| Variável | Obrigatória? | Valor |
|----------|--------------|-------|
| `NEON_DATABASE_URL` | ✅ SIM | Fornecido acima |
| `JWT_SECRET` | ✅ SIM | Copiar do Netlify OU gerar novo |
| `ANTHROPIC_API_KEY` | ⚠️ NÃO | Copiar do Netlify (opcional) |
| `GCP_KEY_JSON` | ⚠️ NÃO | Copiar do Netlify (opcional) |

---

## 📞 Próximos Passos

1. **Copiar valores** do Netlify (JWT_SECRET, etc.)
2. **Configurar no Vercel** (Settings → Environment Variables)
3. **Fazer deploy**
4. **Testar sistema**

---

**Precisa de ajuda para copiar os valores do Netlify?** Posso guiá-lo passo a passo! 🚀

