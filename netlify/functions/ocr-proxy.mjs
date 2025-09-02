// netlify/functions/ocr-proxy.mjs
import { Buffer } from "node:buffer";
import Busboy from "busboy";

/* Lê multipart e devolve { fileBuffer, filename } */
function parseMultipart(event){
  return new Promise((resolve, reject)=>{
    const ct = event.headers["content-type"] || event.headers["Content-Type"] || "";
    const busboy = Busboy({ headers: { "content-type": ct } });

    let fileBuffer = Buffer.alloc(0);
    let filename = "upload";

    busboy.on("file", (_name, file, info)=>{
      if (info?.filename) filename = info.filename;
      file.on("data", d => fileBuffer = Buffer.concat([fileBuffer, d]));
    });

    busboy.on("finish", ()=> resolve({ fileBuffer, filename }));
    busboy.on("error", reject);

    busboy.end(Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8"));
  });
}

export const handler = async (event) => {
  // CORS / preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode:
