// netlify/functions/ocr-proxy.mjs
import { Buffer } from "node:buffer";
import Busboy from "busboy";
import sharp from "sharp";
import jsQR from "jsqr";
import vision from "@google-cloud/vision";

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const busboy = Busboy({ headers: { "content-type": ct } });

    let fileBuffer = Buffer.alloc(0);
    let filename = "upload";

    busboy.on("file", (_name, file, info) => {
      if (info?.filename) filename = info.filename;
      file.on("data", d => fileBuffer = Buffer.concat([fileBuffer, d]));
    });

    busboy.on("finish", () => resolve({ fileBuffer, filename }));
    busboy.on("error", reject);

    const body = event.body || "";
    busboy.end(Buffer.from(body, event.isBase64Encoded ? "base64" : "utf8"));
  });
}

async function tryReadQR(fileBuffer) {
  try {
    const { data, info } = await sharp(fileBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
    const code = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      info.width,
      info.height
    );
    return code?.data || null;
  } catch { return null; }
}

function createVisionClient() {
  const json = process.env.GCP_KEY_JSON;
  if (!json) throw new Error("Falta a variável GCP_KEY_JSON no Netlify (cole o JSON da Service Account).");
  return new vision.ImageAnnotatorClient({ credentials: JSON.parse(json) });
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    };
  }

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, message: "ocr-proxy com Vision pronto" }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Usa POST multipart/form-data com campo 'file'." };
  }

  try {
    const { fileBuffer, filename } = await parseMultipart(event);
    if (!fileBuffer?.length) {
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: "Nenhum ficheiro recebido." };
    }

    // QR primeiro (rápido)
    const qr = await tryReadQR(fileBuffer);

    // OCR com Google Vision
    const client = createVisionClient();
    const [result] = await client.documentTextDetection({ image: { content: fileBuffer } });
    const text =
      result?.fullTextAnnotation?.text ||
      result?.textAnnotations?.[0]?.description ||
      "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ filename, text, qr }),
    };
  } catch (err) {
    console.error("OCR error:", err);
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: `Erro: ${err.message || err}` };
  }
};