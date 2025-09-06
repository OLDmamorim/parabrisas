import vision from "@google-cloud/vision";

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

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        text,
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