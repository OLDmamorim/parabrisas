# Checklist de Testes - ExpressGlass/Parabrisas

## Data: 16 de Outubro de 2025

---

## 📋 Testes de Receção (index.html)

### Modo Entrada

- [ ] **Teste 1.1:** Aceder ao menu inicial em mobile
- [ ] **Teste 1.2:** Selecionar opção "ENTRADA"
- [ ] **Teste 1.3:** Clicar no botão de câmera
- [ ] **Teste 1.4:** Modal REDE/COMPLEMENTAR/OEM aparece
- [ ] **Teste 1.5:** Selecionar "REDE" e capturar imagem
- [ ] **Teste 1.6:** OCR processa imagem e extrai eurocode
- [ ] **Teste 1.7:** Eurocode aparece na coluna "EUROCODE" da tabela
- [ ] **Teste 1.8:** Veículo aparece apenas com modelo (não concatenado)
- [ ] **Teste 1.9:** Marca aparece na coluna "MARCA VIDRO"
- [ ] **Teste 1.10:** Data/hora estão corretas

### Prefixos REDE/COMPLEMENTAR/OEM

- [ ] **Teste 2.1:** Capturar vidro REDE - eurocode sem prefixo
- [ ] **Teste 2.2:** Capturar vidro COMPLEMENTAR - eurocode com prefixo #
- [ ] **Teste 2.3:** Capturar vidro OEM - eurocode com prefixo *

### Edição Inline

- [ ] **Teste 3.1:** Clicar em campo "MARCA VIDRO" e editar
- [ ] **Teste 3.2:** Clicar em campo "VEÍCULO" e editar
- [ ] **Teste 3.3:** Clicar em campo "OBSERVAÇÕES" e editar
- [ ] **Teste 3.4:** Alterações são guardadas automaticamente
- [ ] **Teste 3.5:** Recarregar página e verificar que alterações persistem

### Modo Saída

- [ ] **Teste 4.1:** Voltar ao menu inicial
- [ ] **Teste 4.2:** Selecionar opção "SAÍDA"
- [ ] **Teste 4.3:** Tabela mostra registos existentes
- [ ] **Teste 4.4:** Botão "DAR SAÍDA" aparece em cada linha
- [ ] **Teste 4.5:** Clicar em "DAR SAÍDA" para um registo
- [ ] **Teste 4.6:** Registo é eliminado da tabela
- [ ] **Teste 4.7:** Verificar que registo não aparece mais na base de dados

### Exportação e Impressão

- [ ] **Teste 5.1:** Clicar em "📊 Exportar Excel"
- [ ] **Teste 5.2:** Ficheiro Excel é descarregado
- [ ] **Teste 5.3:** Abrir Excel e verificar dados corretos
- [ ] **Teste 5.4:** Clicar em "🖨️ Imprimir"
- [ ] **Teste 5.5:** Modal de impressão abre
- [ ] **Teste 5.6:** Pré-visualização mostra dados corretos
- [ ] **Teste 5.7:** Imprimir ou guardar como PDF

### Limpar Tabela

- [ ] **Teste 6.1:** Clicar em "🗑️ Limpar Tabela"
- [ ] **Teste 6.2:** Confirmação aparece
- [ ] **Teste 6.3:** Confirmar limpeza
- [ ] **Teste 6.4:** Todos os registos são eliminados
- [ ] **Teste 6.5:** Tabela fica vazia

### Desktop

- [ ] **Teste 7.1:** Aceder a `index.html` em desktop (largura > 768px)
- [ ] **Teste 7.2:** Tabela ocupa largura completa
- [ ] **Teste 7.3:** Todas as colunas são visíveis
- [ ] **Teste 7.4:** Botão "Saída" NÃO aparece na tabela desktop
- [ ] **Teste 7.5:** Botão "INVENTÁRIO" mudou de nome para "INVENTÁRIO"

---

## 📦 Testes de Inventário (inventario.html)

### Acesso e Interface

- [ ] **Teste 8.1:** Aceder ao menu inicial em mobile
- [ ] **Teste 8.2:** Selecionar opção "INVENTÁRIO"
- [ ] **Teste 8.3:** Redireciona para `inventario.html`
- [ ] **Teste 8.4:** Logo ExpressGlass aparece
- [ ] **Teste 8.5:** Título "📦 INVENTÁRIO" aparece
- [ ] **Teste 8.6:** Botão circular de câmera aparece
- [ ] **Teste 8.7:** Estatísticas (Total, REDE, Complementar, OEM) aparecem

### Adicionar Itens

- [ ] **Teste 9.1:** Clicar no botão de câmera
- [ ] **Teste 9.2:** Modal REDE/COMPLEMENTAR/OEM aparece
- [ ] **Teste 9.3:** Selecionar "REDE" e capturar imagem
- [ ] **Teste 9.4:** OCR processa imagem
- [ ] **Teste 9.5:** Item aparece nos cards
- [ ] **Teste 9.6:** Eurocode está correto (sem prefixo para REDE)
- [ ] **Teste 9.7:** Marca e veículo estão corretos
- [ ] **Teste 9.8:** Data está correta

### Prefixos no Inventário

- [ ] **Teste 10.1:** Adicionar vidro REDE - eurocode sem prefixo
- [ ] **Teste 10.2:** Adicionar vidro COMPLEMENTAR - eurocode com #
- [ ] **Teste 10.3:** Adicionar vidro OEM - eurocode com *

### Totalizadores

- [ ] **Teste 11.1:** Adicionar 3 vidros REDE
- [ ] **Teste 11.2:** Total REDE = 3
- [ ] **Teste 11.3:** Adicionar 2 vidros COMPLEMENTAR
- [ ] **Teste 11.4:** Total COMPLEMENTAR = 2
- [ ] **Teste 11.5:** Adicionar 1 vidro OEM
- [ ] **Teste 11.6:** Total OEM = 1
- [ ] **Teste 11.7:** Total Geral = 6

### Eliminar Itens

- [ ] **Teste 12.1:** Clicar no botão 🗑️ de um item
- [ ] **Teste 12.2:** Confirmação aparece
- [ ] **Teste 12.3:** Confirmar eliminação
- [ ] **Teste 12.4:** Item desaparece dos cards
- [ ] **Teste 12.5:** Totalizadores são atualizados
- [ ] **Teste 12.6:** Recarregar página e verificar que item não existe

### Exportação

- [ ] **Teste 13.1:** Clicar em "📊 Exportar Excel"
- [ ] **Teste 13.2:** Ficheiro Excel é descarregado
- [ ] **Teste 13.3:** Nome do ficheiro: `Inventario_YYYY-MM-DD.xlsx`
- [ ] **Teste 13.4:** Abrir Excel e verificar dados
- [ ] **Teste 13.5:** Colunas: Eurocode, Marca Vidro, Veículo, Loja, Data

### Navegação

- [ ] **Teste 14.1:** Clicar em "← Voltar"
- [ ] **Teste 14.2:** Redireciona para `index.html`

### Desktop

- [ ] **Teste 15.1:** Aceder a `inventario.html` em desktop
- [ ] **Teste 15.2:** Estatísticas aparecem em 4 colunas
- [ ] **Teste 15.3:** Cards são responsivos

---

## 🔐 Testes de Autenticação

### Login

- [ ] **Teste 16.1:** Aceder sem estar autenticado
- [ ] **Teste 16.2:** Redireciona para página de login
- [ ] **Teste 16.3:** Fazer login com credenciais válidas
- [ ] **Teste 16.4:** Redireciona para `index.html`

### Autorização

- [ ] **Teste 17.1:** Tentar aceder a funções Netlify sem token
- [ ] **Teste 17.2:** Retorna erro 401 Unauthorized
- [ ] **Teste 17.3:** Aceder com token válido
- [ ] **Teste 17.4:** Funções executam normalmente

### Isolamento de Dados

- [ ] **Teste 18.1:** Fazer login com utilizador A
- [ ] **Teste 18.2:** Adicionar vidros em Receção
- [ ] **Teste 18.3:** Adicionar vidros em Inventário
- [ ] **Teste 18.4:** Fazer logout
- [ ] **Teste 18.5:** Fazer login com utilizador B
- [ ] **Teste 18.6:** Verificar que não vê dados do utilizador A

---

## 🗄️ Testes de Base de Dados

### Separação de Tabelas

- [ ] **Teste 19.1:** Adicionar vidro em Receção
- [ ] **Teste 19.2:** Verificar que vai para tabela `ocr_results`
- [ ] **Teste 19.3:** Adicionar vidro em Inventário
- [ ] **Teste 19.4:** Verificar que vai para tabela `inventario`
- [ ] **Teste 19.5:** Confirmar que dados NÃO se misturam

### Migração

- [ ] **Teste 20.1:** Executar `POST /.netlify/functions/migrate-db`
- [ ] **Teste 20.2:** Verificar resposta de sucesso
- [ ] **Teste 20.3:** Confirmar que tabela `inventario` existe
- [ ] **Teste 20.4:** Confirmar que colunas foram adicionadas a `ocr_results`

---

## 📱 Testes Mobile

### Responsividade

- [ ] **Teste 21.1:** Testar em iPhone (iOS)
- [ ] **Teste 21.2:** Testar em Android
- [ ] **Teste 21.3:** Menu inicial aparece corretamente
- [ ] **Teste 21.4:** Botões são clicáveis
- [ ] **Teste 21.5:** Câmera abre nativamente
- [ ] **Teste 21.6:** OCR funciona em mobile

### Contraste e Visibilidade

- [ ] **Teste 22.1:** Tabs (se existirem) têm contraste adequado
- [ ] **Teste 22.2:** Texto é legível em todos os ecrãs
- [ ] **Teste 22.3:** Botões têm tamanho adequado para toque

---

## 🐛 Testes de Erros

### Tratamento de Erros

- [ ] **Teste 23.1:** Capturar imagem sem eurocode
- [ ] **Teste 23.2:** Mensagem de erro aparece
- [ ] **Teste 23.3:** Tentar guardar sem dados obrigatórios
- [ ] **Teste 23.4:** Validação impede submissão
- [ ] **Teste 23.5:** Perder conexão durante operação
- [ ] **Teste 23.6:** Mensagem de erro de rede aparece

---

## ✅ Resumo de Validação

### Receção
- [ ] Todas as funcionalidades de entrada funcionam
- [ ] Modo saída elimina registos corretamente
- [ ] Edição inline funciona
- [ ] Exportação e impressão funcionam
- [ ] Dados vão para tabela `ocr_results`

### Inventário
- [ ] Adicionar itens funciona
- [ ] Totalizadores estão corretos
- [ ] Eliminação funciona
- [ ] Exportação funciona
- [ ] Dados vão para tabela `inventario`

### Separação
- [ ] Receção e Inventário usam tabelas diferentes
- [ ] Dados não se misturam
- [ ] Navegação entre páginas funciona
- [ ] Cada sistema é independente

---

## 📝 Notas

- Todos os testes devem ser realizados em **mobile** e **desktop**
- Testar com **diferentes utilizadores** para validar isolamento de dados
- Verificar **logs do navegador** para erros JavaScript
- Testar **diferentes tipos de imagens** para OCR
- Validar **performance** com muitos registos (100+)

---

**Status:** ⏳ Aguardando testes  
**Responsável:** Utilizador  
**Data prevista:** 16 de Outubro de 2025

