// netlify/functions/ocr-proxy.mjs
import vision from "@google-cloud/vision";
import Busboy from "busboy";

// Inicializar cliente do Google Vision
const client = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(process.env.GCP_KEY_JSON)
});

// Função para ler ficheiro de upload (multipart/form-data)
async function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: event.headers });
    const formData = {};
    let fileBuffer = Buffer.alloc(0);

    busboy.on("file", (_, file, info) => {
      file.on("data", (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
      file.on("end", () => {
        formData.file = fileBuffer;
        formData.filename = info.filename;
      });
    });

    busboy.on("field", (fieldname, value) => {
      formData[fieldname] = value;
    });

    busboy.on("finish", () => {
      resolve(formData);
    });

    busboy.on("error", (err) => reject(err));

    busboy.end(Buffer.from(event.body, "base64"));
  });
}

// Função handler Netlify
export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Método não permitido" })
      };
    }

    const formData = await parseMultipartForm(event);
    if (!formData.file) {
      return { statusCode: 400, body: JSON.stringify({ error: "Nenhum ficheiro enviado" }) };
    }

    // Chamada ao Google Vision (⚠️ removido failOn inválido)
    const [result] = await client.textDetection({
      image: { content: formData.file },
      imageContext: {
        languageHints: ["pt", "en"] // opcional
      }
    });

    const detections = result.textAnnotations || [];
    const text = detections.length ? detections[0].description : "";

    return {
      statusCode: 200,
      body: JSON.stringify({
        text,
        filename: formData.filename || "upload.jpg",
        ok: true
      })
    };

  } catch (err) {
    console.error("Erro no OCR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "OCR failure",
        details: err.message
      })
    };
  }
};