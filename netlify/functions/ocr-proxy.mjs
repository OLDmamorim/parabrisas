import vision from "@google-cloud/vision";

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
  if (!textoOCR || typeof textoOCR !== 'string') {
    return null;
  }
  
  const textoUpper = textoOCR.toUpperCase();
  
  // Procurar por cada marca na lista
  for (const marca of MARCAS_VIDROS) {
    if (textoUpper.includes(marca.toUpperCase())) {
      return marca;
    }
  }
  
  return null;
}

// Inicializar cliente do Google Vision
const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GCP_KEY_JSON)
});

const jsonHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*'
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Método não permitido" })
      };
    }

    // Parse do body JSON (não multipart)
    const { imageBase64 } = JSON.parse(event.body || '{}');
    
    if (!imageBase64) {
      return { 
        statusCode: 400, 
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Nenhuma imagem enviada" }) 
      };
    }

    // Converter base64 para buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Chamada ao Google Vision
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
      imageContext: {
        languageHints: ["pt", "en"]
      }
    });

    const detections = result.textAnnotations || [];
    const text = detections.length ? detections[0].description : "";

    // Detectar marca no texto OCR
    const marcaDetectada = detectarMarca(text);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        text,
        marca: marcaDetectada,
        ok: true
      })
    };

  } catch (err) {
    console.error("Erro no OCR:", err);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: "OCR failure",
        details: err.message
      })
    };
  }
};

