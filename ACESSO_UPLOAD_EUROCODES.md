# 📤 Como Aceder ao Upload de Eurocodes

## ✅ SIM! Tem Acesso pela Página Principal

Após fazer login como **Admin** ou **Gestor**, verá o botão **"📊 Upload Eurocodes"** na barra de ferramentas, ao lado dos outros botões.

---

## 🎯 Duas Formas de Aceder

### Opção 1: Através da Página Principal (RECOMENDADO)

1. Aceder a: **https://parabrisas.netlify.app**
2. Fazer login com:
   - Email: `mramorim78@gmail.com`
   - Password: `XGl@55#2021ab2021`
3. Procurar a barra de ferramentas com os botões:
   ```
   [📦 INVENTÁRIO] [🖨️ Imprimir] [🗑️ Limpar Tabela] [📊 Upload Eurocodes]
   ```
4. Clicar em **"📊 Upload Eurocodes"**
5. Abre um modal onde pode fazer upload do ficheiro Excel

### Opção 2: Acesso Direto (URL)

Se preferir, pode aceder diretamente:
- URL: **https://parabrisas.netlify.app/upload-eurocodes.html**

---

## 🔐 Permissões

O botão **só aparece** para utilizadores com função:
- ✅ **Admin**
- ✅ **Gestor**

Outros utilizadores **não vêem** o botão.

---

## 📊 Como Usar o Modal de Upload

Quando clicar no botão, abre um modal com:

### 1. Área de Upload
- Clicar ou arrastar ficheiro Excel
- Formatos aceites: `.xlsx`, `.xls`

### 2. Formato do Excel
O ficheiro deve ter **3 colunas**:

| Coluna A | Coluna B | Coluna C |
|----------|----------|----------|
| **Prefixo** | **Marca** | **Modelo** |
| 2436 | BMW | SERIE 3 E46 |
| 1234 | MERCEDES | CLASSE A |

### 3. Processar
- Após selecionar o ficheiro, o sistema mostra quantos eurocodes encontrou
- Clicar em **"🚀 Processar e Atualizar"**
- Aguardar processamento
- Ver mensagem de sucesso com estatísticas

---

## 🎨 Localização Visual

Na página principal, após login, verá:

```
┌─────────────────────────────────────────────────────────┐
│  EXPRESSGLASS • Receção material                        │
│                                                          │
│  [📦 INVENTÁRIO] [🖨️ Imprimir] [🗑️ Limpar Tabela]      │
│  [📊 Upload Eurocodes] ← ESTE BOTÃO                     │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  Eurocode: [___________] 🔍              │          │
│  │                                           │          │
│  │  Tabela de registos...                   │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

O botão **"📊 Upload Eurocodes"** tem cor **laranja** para se destacar dos outros.

---

## ⚠️ Importante: Configuração Necessária

**Antes de usar**, é necessário configurar a variável de ambiente no Netlify:

1. Netlify Dashboard → Site settings → Environment variables
2. Adicionar `NEON_DATABASE_URL`
3. Fazer redeploy

Ver ficheiro **CONFIGURACAO_FINAL.md** para instruções detalhadas.

---

## 🧪 Testar Agora

Após o deploy (1-2 minutos):

1. Ir para: https://parabrisas.netlify.app
2. Fazer login como Admin
3. ✅ Ver o botão **"📊 Upload Eurocodes"** na barra de ferramentas
4. Clicar e testar!

---

## 📝 Resumo

**Sim, tem acesso pela página principal!**

- ✅ Botão visível após login como Admin/Gestor
- ✅ Localizado na barra de ferramentas
- ✅ Abre modal para upload de Excel
- ✅ Processo simples e intuitivo

**Deploy realizado:** O botão já está visível na produção (após 1-2 minutos de deploy)

---

**Precisa de ajuda para configurar a variável de ambiente no Netlify?** 🚀

