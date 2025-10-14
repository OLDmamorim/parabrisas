# Implementação Claude OCR - Branch Staging

## 🎯 O Que Foi Implementado

Esta branch `staging` contém a implementação do **Claude 3.5 Haiku** como motor de OCR, substituindo o Google Cloud Vision.

## 📝 Alterações Realizadas

### 1. Novo Ficheiro: `netlify/functions/ocr-claude.mjs`

Função Netlify que processa OCR usando Claude 3.5 Haiku.

**Funcionalidades:**
- Extração de texto com compreensão contextual
- Identificação automática de Eurocodes
- Deteção de marca do fabricante
- Identificação de veículo (marca, modelo, anos)
- Extração de características especiais
- Resposta em JSON estruturado
- Logging detalhado para debugging

### 2. Atualizado: `package.json`

Adicionada dependência:
```json
"@anthropic-ai/sdk": "^0.30.0"
```

### 3. Atualizado: `app.js`

Linha 8 alterada de:
```javascript
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
```

Para:
```javascript
const OCR_ENDPOINT = '/.netlify/functions/ocr-claude';
```

## ⚙️ Configuração Necessária no Netlify

**IMPORTANTE**: Antes de fazer deploy, é necessário adicionar a variável de ambiente no Netlify:

1. Acede ao dashboard do Netlify
2. Seleciona o site do projeto
3. Vai a **Site settings** → **Environment variables**
4. Adiciona:
   - **Key**: `ANTHROPIC_API_KEY`
   - **Value**: `sk-ant-api03-...` (a chave que foi fornecida)
   - **Scopes**: Todas (Production, Deploy previews, Branch deploys)

## 🧪 Como Testar

### Opção 1: Deploy Automático da Branch Staging

O Netlify vai automaticamente fazer deploy desta branch. Podes aceder ao URL de preview para testar.

### Opção 2: Testar Localmente

```bash
# 1. Criar ficheiro .env na raiz
echo 'ANTHROPIC_API_KEY=sk-ant-api03-...' > .env
# (Substitui sk-ant-api03-... pela chave real)

# 2. Instalar dependências
npm install

# 3. Iniciar servidor local
netlify dev

# 4. Abrir http://localhost:8888 e testar
```

## ✅ Checklist de Testes

Antes de mergear para `main`, testar:

- [ ] Login funciona
- [ ] Upload de imagem funciona
- [ ] OCR processa imagem com sucesso
- [ ] Eurocode é identificado corretamente
- [ ] Marca e veículo são identificados
- [ ] Dados são guardados na base de dados
- [ ] Testar com imagem clara
- [ ] Testar com imagem em ângulo
- [ ] Testar com imagem de baixa qualidade
- [ ] Verificar logs do Netlify (sem erros)
- [ ] Verificar custos no console Anthropic

## 💰 Custos Esperados

- **Por imagem**: ~$0.00025
- **1000 imagens**: ~$0.25
- **5000 imagens/mês**: ~$1.25/mês

Comparado com Google Vision ($7.50/mês para 5000 imagens) = **83% de economia**

## 📊 Dados Extraídos

O Claude retorna JSON estruturado:

```json
{
  "eurocode": "1234AB567890",
  "eurocodes_alternativos": ["1234AB567891"],
  "marca_fabricante": "PILKINGTON",
  "veiculo_marca": "VW",
  "veiculo_modelo": "Golf",
  "veiculo_anos": "2015-2020",
  "tipo_vidro": "Parabrisas",
  "caracteristicas": ["Sensor de chuva", "Aquecido"],
  "observacoes": "Com ADAS",
  "confianca": "alta",
  "texto_completo": "..."
}
```

## 🔄 Próximos Passos

1. **Configurar variável de ambiente** no Netlify (ANTHROPIC_API_KEY)
2. **Fazer deploy** da branch staging
3. **Testar** extensivamente
4. **Validar** que tudo funciona corretamente
5. **Mergear** para `main` se testes OK

## 🆘 Rollback

Se algo correr mal, é fácil reverter:

```bash
# Voltar para main
git checkout main

# Ou no Netlify, fazer redeploy de um deploy anterior
```

## 📞 Suporte

- **Anthropic Console**: https://console.anthropic.com/
- **Documentação Claude**: https://docs.anthropic.com/
- **Netlify Dashboard**: https://app.netlify.com/

---

**Implementado por**: Manus AI  
**Data**: 14 de outubro de 2025  
**Branch**: staging  
**Status**: Pronto para testes  

