# Separação entre Receção e Inventário - ExpressGlass

## Data: 16 de Outubro de 2025

## Resumo das Alterações

Este documento descreve a separação completa entre os sistemas de **Receção** e **Inventário** no sistema ExpressGlass/Parabrisas.

---

## Arquitetura do Sistema

### 1. Sistema de Receção (Entrada e Saída de Stock)

**Página:** `index.html`  
**Script:** `app.js`  
**Tabela de Base de Dados:** `ocr_results`

#### Funções Netlify:
- `save-ocr.mjs` - Guardar registos de receção
- `list-ocr.mjs` - Listar registos de receção
- `clear-ocr.mjs` - Limpar todos os registos de receção
- `delete-ocr.mjs` - Eliminar registo específico
- `edit-ocr.mjs` - Editar registo existente
- `update-ocr.mjs` - Atualizar registo

#### Funcionalidades:
- ✅ Captura de imagens via câmera com OCR
- ✅ Modal REDE/COMPLEMENTAR/OEM antes da captura
- ✅ Prefixos automáticos (# para complementar, * para OEM)
- ✅ Modo Entrada (adicionar vidros ao stock)
- ✅ Modo Saída (remover vidros do stock)
- ✅ Edição inline de registos na tabela
- ✅ Exportação para Excel
- ✅ Impressão de registos
- ✅ Autenticação JWT

---

### 2. Sistema de Inventário (Stock Disponível)

**Página:** `inventario.html`  
**Script:** `inventario-novo.js`  
**Tabela de Base de Dados:** `inventario`

#### Funções Netlify:
- `save-inventario.mjs` - Guardar itens no inventário
- `list-inventario.mjs` - Listar itens do inventário
- `clear-inventario.mjs` - Limpar todo o inventário
- `delete-inventario.mjs` - Eliminar item específico

#### Funcionalidades:
- ✅ Captura de imagens via câmera com OCR
- ✅ Modal REDE/COMPLEMENTAR/OEM antes da captura
- ✅ Prefixos automáticos (# para complementar, * para OEM)
- ✅ Listagem de itens em cards
- ✅ Totalizadores por tipo (Total, REDE, Complementar, OEM)
- ✅ Eliminação individual de itens
- ✅ Exportação para Excel
- ✅ Autenticação JWT
- ✅ Interface mobile-first

---

## Estrutura da Base de Dados

### Tabela: `ocr_results` (Receção)

```sql
CREATE TABLE ocr_results (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT NOW(),
  text TEXT,
  eurocode TEXT,
  brand TEXT,
  vehicle TEXT,
  filename TEXT,
  source TEXT,
  matricula TEXT,
  loja TEXT DEFAULT 'LOJA',
  observacoes TEXT,
  tipo TEXT DEFAULT 'recepcao',
  user_id INTEGER NOT NULL
);
```

### Tabela: `inventario` (Inventário)

```sql
CREATE TABLE inventario (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT NOW(),
  text TEXT,
  eurocode TEXT,
  brand TEXT,
  vehicle TEXT,
  filename TEXT,
  source TEXT,
  matricula TEXT,
  loja TEXT DEFAULT 'LOJA',
  observacoes TEXT,
  user_id INTEGER NOT NULL
);

CREATE INDEX idx_inventario_user_id ON inventario(user_id);
```

---

## Navegação do Sistema

### Menu Inicial (Mobile)

O menu inicial em mobile (`menu-inicial.js`) oferece três opções:

1. **ENTRADA** → Abre `index.html` em modo entrada
2. **SAÍDA** → Abre `index.html` em modo saída
3. **INVENTÁRIO** → Redireciona para `inventario.html`

### Desktop

No desktop, o utilizador acede diretamente a `index.html` para Receção ou navega manualmente para `inventario.html` para ver o Inventário.

---

## Alterações Realizadas

### 1. Remoção de Tabs no index.html

**Antes:** O `index.html` tinha tabs "RECEÇÃO" e "INVENTÁRIO" que alternavam entre duas vistas na mesma página.

**Depois:** Removidas as tabs e toda a lógica de `switchView()`. O `index.html` agora é exclusivamente para Receção.

**Ficheiros alterados:**
- `index.html` - Removidas tabs HTML e CSS
- `app.js` - Removida função `loadInventario()` e lógica de `currentView`

### 2. Criação de Página Dedicada para Inventário

**Novo ficheiro:** `inventario.html`  
**Novo script:** `inventario-novo.js`

Esta página é completamente independente e usa a sua própria tabela de base de dados (`inventario`).

### 3. Funções Netlify Separadas

Todas as funções Netlify foram duplicadas e adaptadas para usar as tabelas corretas:

- Receção → `ocr_results`
- Inventário → `inventario`

### 4. Migração de Base de Dados

**Ficheiro:** `netlify/functions/migrate-db.mjs`

Esta função cria a tabela `inventario` e adiciona as colunas necessárias à tabela `ocr_results`.

**Executar migração:**
```
POST /.netlify/functions/migrate-db
```

---

## Fluxo de Dados

### Receção (Entrada)
1. Utilizador captura imagem com câmera
2. Modal pergunta tipo de vidro (REDE/COMPLEMENTAR/OEM)
3. OCR processa imagem e extrai eurocode
4. Dados são guardados em `ocr_results` via `save-ocr.mjs`
5. Tabela é atualizada automaticamente

### Receção (Saída)
1. Utilizador ativa modo saída no menu inicial
2. Tabela mostra registos existentes com botão "DAR SAÍDA"
3. Ao clicar, o registo é **eliminado** de `ocr_results`
4. Tabela é atualizada automaticamente

### Inventário
1. Utilizador acede a `inventario.html`
2. Captura imagem com câmera
3. Modal pergunta tipo de vidro (REDE/COMPLEMENTAR/OEM)
4. OCR processa imagem e extrai eurocode
5. Dados são guardados em `inventario` via `save-inventario.mjs`
6. Cards são atualizados com totalizadores

---

## Diferenças Principais

| Aspeto | Receção | Inventário |
|--------|---------|------------|
| **Tabela BD** | `ocr_results` | `inventario` |
| **Página** | `index.html` | `inventario.html` |
| **Script** | `app.js` | `inventario-novo.js` |
| **Propósito** | Entrada e saída de vidros | Stock disponível |
| **Visualização** | Tabela com edição inline | Cards com totalizadores |
| **Modo Saída** | Elimina registos | Não aplicável |
| **Exportação** | Excel + Impressão | Excel apenas |

---

## Testes Recomendados

### Receção
1. ✅ Capturar imagem em modo entrada
2. ✅ Verificar se eurocode aparece na tabela
3. ✅ Editar campos inline (marca, veículo, observações)
4. ✅ Ativar modo saída e dar saída a um vidro
5. ✅ Verificar se registo foi eliminado
6. ✅ Exportar para Excel
7. ✅ Imprimir registos
8. ✅ Limpar tabela

### Inventário
1. ✅ Aceder a `inventario.html`
2. ✅ Capturar imagem via câmera
3. ✅ Selecionar tipo de vidro (REDE/COMPLEMENTAR/OEM)
4. ✅ Verificar se item aparece nos cards
5. ✅ Verificar totalizadores (Total, REDE, Complementar, OEM)
6. ✅ Eliminar item individual
7. ✅ Exportar para Excel
8. ✅ Verificar que dados não aparecem em Receção

---

## Ficheiros Principais

### Receção
- `index.html` - Interface principal
- `app.js` - Lógica de negócio
- `menu-inicial.js` - Menu mobile
- `modal-saida.js` - Modal de saída
- `netlify/functions/save-ocr.mjs`
- `netlify/functions/list-ocr.mjs`
- `netlify/functions/clear-ocr.mjs`
- `netlify/functions/delete-ocr.mjs`

### Inventário
- `inventario.html` - Interface de inventário
- `inventario-novo.js` - Lógica de inventário
- `netlify/functions/save-inventario.mjs`
- `netlify/functions/list-inventario.mjs`
- `netlify/functions/clear-inventario.mjs`
- `netlify/functions/delete-inventario.mjs`

### Partilhados
- `auth.js` - Autenticação JWT
- `auth-utils.mjs` - Utilitários de autenticação
- `db.mjs` - Conexão à base de dados
- `eurocode-mapping.mjs` - Mapeamento de eurocodes
- `style.css` - Estilos globais

---

## Conclusão

O sistema está agora completamente separado em dois módulos independentes:

1. **Receção** - Para entrada e saída de vidros
2. **Inventário** - Para visualização e gestão de stock disponível

Cada módulo usa a sua própria tabela de base de dados, garantindo que os dados não se misturam e que cada sistema pode evoluir de forma independente.

---

**Autor:** Sistema Manus AI  
**Data:** 16 de Outubro de 2025  
**Versão:** 1.0

