import { GoogleAuth } from 'google-auth-library';

// Lista de marcas de vidros conhecidas
const MARCAS_VIDROS = [
  // Marcas principais
  'PILKINGTON', 'GUARDIAN', 'SAINT-GOBAIN', 'SEKURIT', 'FUYAO', 'XINYI', 'AGC', 'ASAHI', 'VITRO', 'CARDINAL',
  
  // Marcas europeias
  'CARGLASS', 'BELRON', 'SAFELITE', 'AUTOGLASS', 'SPEEDY GLASS', 'GLASS DOCTOR',
  
  // Marcas asiáticas
  'NIPPON SHEET GLASS', 'NSG', 'CENTRAL GLASS', 'SISECAM',
  
  // Marcas específicas de parabrisas
  'SPLINTEX', 'LAMEX', 'TEMPERLITE', 'SOLEXIA', 'COOL-LITE', 'SUNGATE', 'CLIMAGUARD', 'ENERGY ADVANTAGE',
  
  // Variações e abreviações comuns
  'AGC AUTOMOTIVE', 'GUARDIAN AUTOMOTIVE', 'PILKINGTON AUTOMOTIVE', 'SAINT GOBAIN', 'SAINT-GOBAIN SEKURIT', 
  'SEKURIT SAINT-GOBAIN', 'FUYAO GLASS', 'XINYI GLASS',
  
  // Marcas portuguesas/ibéricas
  'CRISAL', 'VIDRIOS LIRQUEN', 'GUARDIAN LUXGUARD', 'CEBRACE',
  
  // Outras marcas conhecidas
  'CORNING', 'SCHOTT', 'GUARDIAN GLASS', 'VITRO AUTOMOTIVE', 'MAGNA MIRRORS'
];

// Função para detectar marca no texto OCR
function detectarMarca(textoOCR) {
  console.log('=== DEBUG DETECÇÃO MARCA ===');
  console.log('Texto OCR recebido:', textoOCR);
  
  if (!textoOCR || typeof textoOCR !== 'string') {
    console.log('Texto OCR inválido ou vazio');
    return null;
  }
  
  const textoUpper = textoOCR.toUpperCase();
  console.log('Texto em maiúsculas:', textoUpper);
  
  // Procurar por cada marca na lista
  for (const marca of MARCAS_VIDROS) {
    if (textoUpper.includes(marca.toUpperCase())) {
      console.log('MARCA ENCONTRADA:', marca);
      return marca;
    }
  }
  
  console.log('Nenhuma marca encontrada no texto');
  return null;
}

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { imageBase64 } = JSON.parse(event.body);
    
    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing imageBase64' })
      };
    }

    // Google Cloud Vision API
    const auth = new GoogleAuth({
      credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    const projectId = process.env.GOOGLE_PROJECT_ID;

    const visionRequest = {
      requests: [{
        image: { content: imageBase64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
      }]
    };

    const response = await authClient.request({
      url: `https://vision.googleapis.com/v1/images:annotate`,
      method: 'POST',
      data: visionRequest
    });

    const detections = response.data.responses[0];
    
    if (detections.error) {
      throw new Error(detections.error.message);
    }

    const text = detections.textAnnotations?.[0]?.description || '';
    console.log('Texto extraído pelo Google Vision:', text);
    
    // Detectar marca no texto OCR
    const marcaDetectada = detectarMarca(text);
    console.log('Marca detectada final:', marcaDetectada);

    const resposta = {
      text: text,
      marca: marcaDetectada
    };
    console.log('Resposta final do OCR:', resposta);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(resposta)
    };

  } catch (error) {
    console.error('OCR Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'OCR processing failed',
        details: error.message 
      })
    };
  }
};

