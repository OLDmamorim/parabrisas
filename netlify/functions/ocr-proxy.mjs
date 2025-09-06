// netlify/functions/ocr-proxy.mjs
import vision from "@google-cloud/vision";
import Busboy from "busboy";

const makeVisionClient = () => {
  // Lê a credencial do env var GCP_KEY_JSON (string)
  const key = process.env.GCP_KEY_JSON;
  if (!key) throw new Error("Missing GCP_KEY_JSON env var");
  const credentials = JSON.parse(key);
  return new vision.ImageAnnotatorClient({ credentials });
};

async function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const headers = event.headers || {};
    const contentType = headers["content-type"] || headers["Content-Type"];
    if (!contentType) return reject(new Error("No content-type"));

    const bb = Busboy({ headers: { "content-type": contentType } });
    const buffers = [];
    let filename = "upload.jpg";

    bb.on("file", (_name, file, info) => {
      if (info?.filename) filename = info.filename;
      file.on("data", (d) => buffers.push(d));
      file.on("limit", () => reject(new Error("File too large")));
    });
    bb.on("error", reject);
    bb.on("finish", () => resolve({
      fileBuffer: Buffer.concat(buffers),
      filename
    }));

    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
    bb.end(body);
  });
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const client = makeVisionClient();

    // Aceita JSON (imageBase64) ou multipart (file)
    const ct = (event.headers["content-type"] || event.headers["Content-Type"] || "").toLowerCase();
    let imageBuffer;
    if (ct.includes("application/json")) {
      const { imageBase64 } = JSON.parse(event.body || "{}");
      if (!imageBase64) return { statusCode: 400, body: JSON.stringify({ error: "Sem imageBase64" }) };
      const base64 = imageBase64.split(",")[1] || imageBase64; // aceita dataURL ou só base64
      imageBuffer = Buffer.from(base64, "base64");
    } else if (ct.includes("multipart/form-data")) {
      const { fileBuffer } = await parseMultipart(event);
      if (!fileBuffer?.length) return { statusCode: 400, body: JSON.stringify({ error: "Nenhum ficheiro enviado" }) };
      imageBuffer = fileBuffer;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Content-Type inválido" }) };
    }

    const [result] = await client.textDetection({ image: { content: imageBuffer } });
    const text = result?.textAnnotations?.[0]?.description || "";

    return { statusCode: 200, body: JSON.stringify({ ok: true, text }) };
  } catch (err) {
    console.error("OCR error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "OCR failure", details: err.message }) };
  }
};