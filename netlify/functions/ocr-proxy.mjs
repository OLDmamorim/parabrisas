// netlify/functions/ocr-proxy.mjs
import { Buffer } from "node:buffer";
import Busboy from "busboy";

/* Lê multipart e devolve { fileBuffer, filename } */
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

export const handler = async (event) => {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    };
  }

  // Testar GET direto no browser
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, message: "ocr-proxy está operacional" })
    };
  }

  // Apenas aceitamos POST para imagens
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Usa POST multipart/form-data com campo 'file'." };
  }

  try {
    const { fileBuffer, filename } = await parseMultipart(event);
    if (!fileBuffer?.length) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: "Nenhum ficheiro recebido."
      };
    }

    // Resposta dummy
    const payload = {
      filename,
      text: "backend ok (dummy OCR)",
      qr: null,
      bytes: fileBuffer.length
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    console.error("Proxy error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `Erro: ${err.message || err}`
    };
  }
};