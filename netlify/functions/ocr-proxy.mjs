// netlify/functions/ocr-proxy.mjs
import { Buffer } from "node:buffer";
import Busboy from "busboy";
import sharp from "sharp";
import jsQR from "jsqr";
import vision from "@google-cloud/vision";

/* ---- utils ---- */
function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const headers = event.headers || {};
    const contentType = headers["content-type"] || headers["Content-Type"] || "";
    const busboy = Busboy({ headers: { "content-type": contentType } });

    let fileBuffer = Buffer.alloc(0);
    let filename = "upload";

    busboy.on("file", (_name, file, info) => {
      if (info?.filename) filename = info.filename;
      file.on("data", (d) => (fileBuffer = Buffer.concat([fileBuffer, d])));
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve({ fileBuffer, filename }));

    const body = event.body || "";
    busboy.end(Buffer.from(body, event.isBase64Encoded ? "base64" : "utf8"));
  });
}

async function tryReadQR(fileBuffer) {
  try {
    const img = sharp(fileBuffer);
    const { data, info } = await img
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      info.width,
      info.height
    );
    return code?.data || null;
  } catch {
    return null;
  }
}

function createVisionClient() {
  const json = process.env.GCP_KEY_JSON;
  if (!json) throw new Error("Falta env GCP_KEY_JSON (Service Account JSON).");
  const credentials = JSON.parse(json);
  return new vision.ImageAnnotatorClient({ credentials });
}

/* ---- handler ---- */
export const handler = async (event) => {
  // CORS
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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Usa POST com multipart/form-data (campo 'file')." };
  }

  try {
    const { fileBuffer, filename } = await parseMultipart(event);
    if (!fileBuffer?.length) {
      return { statusCode: 400, body: "Nenhum ficheiro recebido." };
    }

    const qr = await tryReadQR(fileBuffer);
    const qrOnly = /qrOnly=1/.test(event.rawUrl || "");

    let text = "";
    if (!qrOnly) {
      const client = createVisionClient();
      const [result] = await client.documentTextDetection({ image: { content: fileBuffer } });
      text =
        result?.fullTextAnnotation?.text ||
        result?.textAnnotations?.[0]?.description ||
        "";
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ filename, text, qr }),
    };
  } catch (err) {
    console.error("OCR error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `Erro: ${err.message || err}`,
    };
  }
};