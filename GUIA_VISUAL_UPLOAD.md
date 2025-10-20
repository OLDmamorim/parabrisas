# 📸 Guia Visual - Onde Fazer Upload de Eurocodes

## 🎯 Localização do Botão

Veja na imagem da sua página principal:

```
┌─────────────────────────────────────────────────────────────┐
│                    RECEÇÃO MATERIAL                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [📦 INVENTÁRIO] [🖨️ Imprimir] [🗑️ Limpar Tabela]          │
│                                                             │
│  👉 [📊 Upload Eurocodes] 👈  ⭐ ESTE É O BOTÃO! ⭐        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 Passo a Passo com Imagens

### 1️⃣ Encontrar o Botão

**Localização:** Na barra de ferramentas, ao lado dos outros botões

- À **esquerda** está: 📦 INVENTÁRIO, 🖨️ Imprimir, 🗑️ Limpar Tabela
- O botão é **LARANJA** com o ícone 📊
- Texto: **"Upload Eurocodes"**

**Cor:** 🟧 **LARANJA** (diferente dos outros que são azuis e vermelhos)

---

### 2️⃣ Clicar no Botão

Quando clicar no botão **📊 Upload Eurocodes**, abre uma janela (modal) como esta:

```
┌────────────────────────────────────────────┐
│  📊 Upload de Eurocodes              [X]   │
├────────────────────────────────────────────┤
│                                            │
│  ☑️ Selecionar Ficheiro Excel              │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │    📁                                │ │
│  │                                      │ │
│  │  Clique ou arraste o ficheiro       │ │
│  │  Excel aqui                          │ │
│  │                                      │ │
│  │  Formatos: .xlsx, .xls               │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  O Excel deve ter:                         │
│  • Coluna A = Prefixo (4 dígitos)         │
│  • Coluna B = Marca                        │
│  • Coluna C = Modelo                       │
│                                            │
│  📊 Resultado                              │
│  Nenhum ficheiro selecionado              │
│                                            │
│  [Cancelar]  [🚀 Processar e Atualizar]   │
│                                            │
└────────────────────────────────────────────┘
```

---

### 3️⃣ Selecionar Ficheiro

**Duas formas:**

**A) Clicar na área tracejada**
- Clicar onde diz "Clique ou arraste o ficheiro Excel aqui"
- Abre janela de seleção de ficheiros
- Escolher o ficheiro Excel
- Clicar "Abrir"

**B) Arrastar e largar (Drag & Drop)**
- Arrastar o ficheiro Excel do explorador de ficheiros
- Largar em cima da área tracejada
- Ficheiro é carregado automaticamente

---

### 4️⃣ Processar

Depois de selecionar o ficheiro:

1. Ver o nome do ficheiro aparecer na área "Resultado"
2. Clicar no botão **"🚀 Processar e Atualizar"**
3. Aguardar processamento (alguns segundos)
4. Ver mensagem de sucesso:

```
✅ Upload concluído com sucesso!

📊 Estatísticas:
   • Total recebidos: 10
   • Adicionados: 8
   • Já existiam: 2
   • Total na base de dados: 684
```

---

## 🔍 Se Não Vê o Botão

### Verificar Login

O botão **só aparece** se estiver autenticado como **Admin** ou **Gestor**.

**Verificar:**
1. Olhar no canto superior direito
2. Deve dizer: **"Administrador (Admin)"**
3. Se não disser, fazer login:
   - Email: `mramorim78@gmail.com`
   - Password: `XGl@55#2021ab2021`

### Recarregar Página

Se fez login e ainda não vê o botão:
1. Pressionar **F5** (recarregar página)
2. Ou clicar no ícone de recarregar do browser
3. Aguardar página carregar completamente

---

## 📋 Formato do Ficheiro Excel

### Estrutura Obrigatória

O ficheiro Excel deve ter **exatamente 3 colunas** (A, B, C):

| A (Prefixo) | B (Marca) | C (Modelo) |
|-------------|-----------|------------|
| 2436 | BMW | SERIE 3 E46 |
| 1234 | MERCEDES | CLASSE A |
| 5678 | AUDI | A4 |

### Regras

✅ **Coluna A (Prefixo):**
- Obrigatória
- 4 dígitos numéricos
- Exemplo: 2436, 1234, 5678

✅ **Coluna B (Marca):**
- Obrigatória
- Texto (até 100 caracteres)
- Exemplo: BMW, MERCEDES, AUDI

✅ **Coluna C (Modelo):**
- Opcional
- Texto (até 100 caracteres)
- Exemplo: SERIE 3 E46, CLASSE A, A4

---

## 🎬 Resumo Visual

```
PASSO 1: Aceder ao site
👇
https://parabrisas.netlify.app

PASSO 2: Fazer login (se necessário)
👇
Email: mramorim78@gmail.com
Password: XGl@55#2021ab2021

PASSO 3: Procurar barra de ferramentas
👇
[📦 INVENTÁRIO] [🖨️ Imprimir] [🗑️ Limpar Tabela] [📊 Upload Eurocodes]
                                                    ☝️ ESTE BOTÃO!

PASSO 4: Clicar no botão laranja "📊 Upload Eurocodes"
👇
Abre janela modal

PASSO 5: Selecionar ficheiro Excel
👇
Clicar na área ou arrastar ficheiro

PASSO 6: Clicar "🚀 Processar e Atualizar"
👇
✅ Sucesso!
```

---

## 🖼️ Referência Visual

### Localização Exata na Página

```
┌─────────────────────────────────────────────────────────┐
│  EXPRESSGLASS                                           │
│  RECEÇÃO MATERIAL                    Admin [SAIR]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  👥 Visualizar dados de: [Selecione...]                │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │  [📦 INVENTÁRIO]  [🖨️ Imprimir]                │   │
│  │                                                 │   │
│  │  [🗑️ Limpar Tabela]  [📊 Upload Eurocodes] ⭐  │   │
│  │                           ☝️ AQUI!              │   │
│  │                                                 │   │
│  │  [Procurar Eurocode...]                         │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ DATA/HORA │ TIPO │ VEÍCULO │ EUROCODE │ ...    │   │
│  ├─────────────────────────────────────────────────┤   │
│  │           Nenhum registo encontrado             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ❓ Perguntas Frequentes

### P: Onde está o botão?
**R:** Na barra de ferramentas, é o **4º botão**, cor **LARANJA**, com ícone 📊

### P: Não vejo o botão
**R:** Verificar se está autenticado como Admin/Gestor. Recarregar página (F5).

### P: O botão está cinzento
**R:** Não deve estar cinzento. Se estiver, recarregar página.

### P: Cliquei mas não acontece nada
**R:** Aguardar 1-2 segundos. Se não abrir modal, recarregar página.

### P: Que ficheiro devo usar?
**R:** Ficheiro Excel (.xlsx ou .xls) com 3 colunas: Prefixo, Marca, Modelo

---

## 🎯 Teste Rápido

**Para confirmar que está a ver o botão correto:**

1. ✅ É **LARANJA** (não azul, não vermelho)
2. ✅ Tem ícone **📊** (gráfico)
3. ✅ Texto diz **"Upload Eurocodes"**
4. ✅ Está ao lado de "Limpar Tabela"
5. ✅ Está na **mesma linha** que Inventário e Imprimir

**Se todas as respostas forem SIM → É o botão correto!** ✅

---

## 📞 Ainda com Dúvidas?

Se ainda não consegue encontrar o botão:

1. **Tirar screenshot** da página principal
2. **Enviar** para análise
3. Posso indicar **exatamente** onde está

---

**Criado por:** Manus AI  
**Data:** 20 de Outubro de 2025  
**Versão:** 1.0

