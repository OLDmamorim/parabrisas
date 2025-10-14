// netlify/functions/ocr-claude.mjs
// Função OCR usando Claude 3.5 Haiku para o projeto Parabrisas
// Substitui o Google Cloud Vision OCR

import Anthropic from '@anthropic-ai/sdk';
import { getVehicleFromEurocode } from '../../eurocode-mapping.mjs';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
};

const ok = (data) => ({
  statusCode: 200,
  headers: jsonHeaders,
  body: JSON.stringify(data)
});

const err = (status, message, details = null) => ({
  statusCode: status,
  headers: jsonHeaders,
  body: JSON.stringify({ 
    ok: false, 
    error: message,
    details: details 
  })
});

export const handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return ok({ ok: true });
    }

    if (event.httpMethod !== 'POST') {
      return err(405, 'Método não permitido');
    }

    // Parse do body
    const { imageBase64 } = JSON.parse(event.body || '{}');
    
    if (!imageBase64) {
      return err(400, 'Nenhuma imagem enviada');
    }

    // Validar tamanho da imagem (máx 5MB em base64)
    if (imageBase64.length > 7000000) {
      return err(400, 'Imagem demasiado grande (máx 5MB)');
    }

    console.log('🔍 Processando imagem com Claude 3.5 Haiku...');
    const startTime = Date.now();

    // Chamar Claude API
    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64
              }
            },
            {
              type: "text",
              text: `Analisa esta etiqueta de vidro automotivo da ExpressGlass.

INSTRUÇÕES:
1. Extrai TODAS as informações visíveis na etiqueta
2. Identifica o Eurocode principal (formato típico: 4 dígitos + 2 letras + alfanumérico)
   Exemplos: 1234AB567890, 8765CD123456, 4321EF789012
3. Se houver múltiplos Eurocodes visíveis, lista todos
4. Identifica a marca do fabricante do vidro
   Marcas comuns: PILKINGTON, SAINT-GOBAIN SEKURIT, AGC, SEKURIT, GUARDIAN, VITRO, FUYAO, SHATTERPRUFE
5. Identifica o veículo compatível (marca e modelo)
   IMPORTANTE: Procura por texto como "NISSAN ALMERA", "BMW SERIE 3", "VW GOLF", etc.
   A marca do veículo geralmente aparece ANTES do modelo na mesma linha
   Exemplos: "NISSAN ALMERA" → marca=Nissan, modelo=Almera
            "BMW SERIE 3" → marca=BMW, modelo=Serie 3
            "VW GOLF" → marca=VW, modelo=Golf
6. Identifica o tipo de vidro (parabrisas, lateral, traseiro, etc.)
7. Identifica características especiais visíveis:
   - Sensor de chuva
   - Aquecimento (heated)
   - Acústico (acoustic)
   - ADAS (câmara, sensores)
   - Tonalidade (verde, cinza, azul)
   - Antena integrada
   - Qualquer outra característica técnica

FORMATO DE RESPOSTA:
Responde APENAS com um objeto JSON válido, sem markdown (sem \`\`\`json), sem explicações, sem texto adicional.

{
  "eurocode": "código principal identificado ou null",
  "eurocodes_alternativos": ["outros códigos encontrados"],
  "marca_fabricante": "marca do vidro em MAIÚSCULAS ou null",
  "veiculo_marca": "marca do veículo (ex: Nissan, BMW, VW) ou null",
  "veiculo_modelo": "modelo do veículo (ex: Almera, Serie 3, Golf) ou null",
  "veiculo_anos": "anos compatíveis (ex: 2015-2020) ou null",
  "tipo_vidro": "tipo (ex: Parabrisas, Vidro lateral direito, Vidro traseiro) ou null",
  "caracteristicas": ["lista de características especiais"],
  "observacoes": "qualquer informação adicional relevante ou null",
  "confianca": "alta/média/baixa",
  "texto_completo": "todo o texto visível na imagem"
}

REGRAS IMPORTANTES:
- Se não conseguires identificar algum campo com certeza, usa null
- Para confiança: 
  * "alta" = todos os campos principais estão claros e legíveis
  * "média" = alguns campos têm dúvidas ou imagem parcialmente legível
  * "baixa" = imagem muito pouco legível ou informação muito incerta
- No texto_completo, inclui TODO o texto que consegues ler, linha por linha
- Se vires códigos que parecem Eurocodes mas não tens certeza, inclui em eurocodes_alternativos
- Mantém os nomes das marcas FABRICANTES em MAIÚSCULAS (ex: PILKINGTON, não Pilkington)
- Para marca e modelo do VEÍCULO, usa capitalização normal (ex: Nissan Almera, não NISSAN ALMERA)
- SEMPRE tenta extrair o modelo do veículo se a marca estiver presente na mesma linha

RESPONDE APENAS COM O JSON, SEM MAIS NADA.`
            }
          ]
        }
      ]
    });

    const duration = Date.now() - startTime;

    // Extrair resposta
    const responseText = message.content[0].text;
    console.log('📄 Resposta do Claude (primeiros 200 chars):', responseText.substring(0, 200) + '...');

    // Parse JSON
    let jsonResponse;
    try {
      // Limpar possível markdown ou texto extra
      const cleanText = responseText
        .replace(/```json\n?/g, '')
        .replace(/\n?```/g, '')
        .trim();
      
      jsonResponse = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      console.error('Resposta recebida:', responseText);
      
      // Fallback: retornar texto bruto
      return ok({
        ok: true,
        text: responseText,
        data: null,
        error: 'Resposta não está em formato JSON válido',
        raw: responseText,
        performance: {
          duration_ms: duration,
          model: 'claude-3-5-haiku-20241022'
        }
      });
    }

    // Validar campos obrigatórios
    if (!jsonResponse.eurocode && !jsonResponse.texto_completo) {
      console.warn('⚠️ Nenhum Eurocode ou texto encontrado');
    }

    // Enriquecer com mapeamento de Eurocode (se disponível)
    if (jsonResponse.eurocode) {
      const vehicleFromEurocode = getVehicleFromEurocode(jsonResponse.eurocode);
      
      if (vehicleFromEurocode) {
        console.log('📍 Mapeamento Eurocode encontrado:', vehicleFromEurocode);
        
        // Se o Claude não encontrou marca/modelo, usar do mapeamento
        if (!jsonResponse.veiculo_marca && vehicleFromEurocode.marca) {
          jsonResponse.veiculo_marca = vehicleFromEurocode.marca;
          console.log('✅ Marca definida via Eurocode:', vehicleFromEurocode.marca);
        }
        
        if (!jsonResponse.veiculo_modelo && vehicleFromEurocode.modelo) {
          jsonResponse.veiculo_modelo = vehicleFromEurocode.modelo;
          console.log('✅ Modelo definido via Eurocode:', vehicleFromEurocode.modelo);
        }
        
        // Adicionar fonte da informação
        jsonResponse.fonte_veiculo = vehicleFromEurocode.fonte;
      }
    }

    // Log de sucesso
    console.log('✅ OCR processado com sucesso');
    console.log(`⏱️ Duração: ${duration}ms`);
    console.log(`📊 Tokens: input=${message.usage.input_tokens}, output=${message.usage.output_tokens}`);
    console.log(`🎯 Confiança: ${jsonResponse.confianca}`);
    console.log(`🔢 Eurocode: ${jsonResponse.eurocode || 'não encontrado'}`);

    // Retornar sucesso
    return ok({
      ok: true,
      data: jsonResponse,
      text: jsonResponse.texto_completo || jsonResponse.eurocode || '',
      model: 'claude-3-5-haiku-20241022',
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens
      },
      performance: {
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('❌ Erro no OCR Claude:', error);
    
    // Erros específicos da API Anthropic
    if (error.status === 401) {
      return err(401, 'API Key inválida ou expirada', 'Verifica a variável ANTHROPIC_API_KEY no Netlify');
    }
    
    if (error.status === 429) {
      return err(429, 'Limite de requisições excedido', 'Aguarda alguns segundos e tenta novamente');
    }
    
    if (error.status === 529) {
      return err(529, 'API temporariamente indisponível', 'Serviço da Anthropic está sobrecarregado, tenta novamente em alguns minutos');
    }

    if (error.status === 400) {
      return err(400, 'Requisição inválida', error.message);
    }

    // Erro genérico
    return err(500, 'Erro ao processar OCR com Claude', error.message);
  }
};

