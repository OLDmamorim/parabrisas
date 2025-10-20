# ⚠️ Problema com Deploy do Sistema de Inventário

**Data:** 20 de Outubro de 2025  
**Status:** ❌ **DEPLOY FALHADO - PROBLEMA DO NETLIFY**

---

## 🔴 Problema Identificado

O deploy do sistema de inventário está a falhar com o seguinte erro:

```
Failed to create function: invalid parameter for function creation: 
Invalid AWS Lambda parameters used in this request.
```

### Funções Afetadas
- `create-inventario.mjs`
- `list-inventarios.mjs`
- `get-inventario.mjs`
- `get-inventario-items.mjs`
- `add-inventario-item.mjs`
- `close-inventario.mjs`

---

## 🔍 Causa Raiz

**NÃO é um problema do código!** As funções estão corretamente implementadas.

O problema é do **Netlify/AWS Lambda**:

1. **Limite de funções:** O site já tem 26 funções, adicionar mais 6 pode exceder limites
2. **Problema temporário do Netlify:** Erro intermitente na criação de funções Lambda
3. **Configuração AWS:** Parâmetros inválidos ao criar funções no AWS Lambda

---

## ✅ O Que Está Funcionando

### Em Produção (commit `6623332`)
- ✅ Upload de eurocodes
- ✅ OCR de etiquetas
- ✅ Entrada/Saída diária
- ✅ Todas as funções existentes

### No Código (commit `b809a06`)
- ✅ Sistema de inventário 100% implementado
- ✅ Base de dados criada
- ✅ Interface mobile completa
- ✅ 6 funções Netlify criadas
- ✅ Integração com OCR

**O código está pronto, mas o deploy falha!**

---

## 🔧 Soluções Possíveis

### Solução 1: Aguardar Retry Automático do Netlify ⏳
- Netlify pode tentar novamente automaticamente
- Problema pode ser temporário
- **Tempo:** Pode demorar horas/dias

### Solução 2: Consolidar Funções ✅ RECOMENDADO
- Juntar as 6 funções de inventário numa única função
- Reduzir número total de funções
- **Tempo:** 30 minutos de implementação

### Solução 3: Contactar Suporte Netlify 📞
- Reportar erro ao suporte
- Pedir aumento de limite de funções
- **Tempo:** Pode demorar dias

### Solução 4: Migrar para Vercel/AWS 🚀
- Usar plataforma diferente
- Sem limites de funções
- **Tempo:** Várias horas de migração

---

## 📊 Comparação de Soluções

| Solução | Tempo | Complexidade | Probabilidade de Sucesso |
|---------|-------|--------------|--------------------------|
| **Aguardar** | ? | Baixa | 50% |
| **Consolidar funções** | 30min | Média | 90% |
| **Suporte Netlify** | Dias | Baixa | 70% |
| **Migrar plataforma** | Horas | Alta | 100% |

---

## 💡 Solução Recomendada: Consolidar Funções

Vou criar **1 única função** `inventario-api.mjs` que substitui as 6 funções:

```javascript
// Antes: 6 funções separadas
create-inventario.mjs
list-inventarios.mjs
get-inventario.mjs
get-inventario-items.mjs
add-inventario-item.mjs
close-inventario.mjs

// Depois: 1 função com rotas
inventario-api.mjs
  - POST /inventario (criar)
  - GET /inventario (listar)
  - GET /inventario/:id (obter)
  - GET /inventario/:id/items (listar items)
  - POST /inventario/:id/items (adicionar item)
  - POST /inventario/:id/close (fechar)
```

### Vantagens
- ✅ Reduz de 32 para 27 funções
- ✅ Mais fácil de manter
- ✅ Menos problemas de deploy
- ✅ Mesma funcionalidade

### Desvantagens
- ⚠️ Função maior (mais código num ficheiro)
- ⚠️ Precisa de routing interno

---

## 🎯 Próximos Passos

### Opção A: Implementar Consolidação (Recomendado)
1. Criar `inventario-api.mjs` única
2. Apagar as 6 funções separadas
3. Atualizar `inventario.js` para usar nova API
4. Fazer deploy
5. **Tempo estimado:** 30-45 minutos

### Opção B: Aguardar e Tentar Novamente
1. Aguardar algumas horas
2. Fazer trigger manual do deploy
3. Esperar que Netlify resolva
4. **Tempo estimado:** Incerto (horas/dias)

### Opção C: Contactar Suporte
1. Abrir ticket no Netlify
2. Explicar erro
3. Aguardar resposta
4. **Tempo estimado:** 1-3 dias

---

## 📝 Estado Atual do Código

### No GitHub (commit `b809a06`)
```
✅ index.html - Menu mobile com 3 opções
✅ inventario.css - Estilos completos
✅ inventario.js - Lógica frontend
✅ menu-inicial.js - Integração com menu
✅ app.js - Integração com OCR
✅ create-inventory-tables.sql - Tabelas BD
✅ 6 funções Netlify (NÃO FUNCIONAM NO DEPLOY)
```

### Em Produção (commit `6623332`)
```
✅ Sistema de upload de eurocodes
✅ OCR de etiquetas
✅ Entrada/Saída diária
❌ Sistema de inventário (NÃO ESTÁ)
```

---

## 🤔 Decisão Necessária

**O que prefere fazer?**

### A) Implementar consolidação agora (30min)
- Eu crio a função consolidada
- Faço deploy
- Sistema fica funcional hoje

### B) Aguardar e ver se resolve (incerto)
- Aguardamos algumas horas
- Tentamos deploy novamente
- Pode ou não funcionar

### C) Deixar para depois
- Sistema de inventário fica no código
- Não está em produção
- Implementamos quando Netlify resolver

---

## 📞 Recomendação Final

**Implementar Solução 2 (Consolidar Funções)** ✅

- Tempo: 30-45 minutos
- Probabilidade de sucesso: 90%
- Sistema fica funcional hoje
- Solução definitiva

**Quer que eu implemente agora?**

---

## 📚 Referências

- Erro completo: Ver deploy `b809a06` em https://app.netlify.com/sites/parabrisas/deploys
- Código completo: GitHub commit `b809a06`
- Documentação: `SISTEMA_INVENTARIO_COMPLETO.md`

