
// netlify/functions/ocr-proxy.mjs
import vision from '@google-cloud/vision';
import Busboy from 'busboy';
import sharp from 'sharp';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
};
const TEXT_HEADERS = {
  'content-type': 'text/plain; charset=utf-8',
  'access-control-allow-origin': '*',
};

// --- Cliente Vision com validações claras
let client;
function getVisionClient() {
  const raw = process.env.GCP_KEY_JSON;
  if (!raw) throw new Error('GCP_KEY_JSON ausente nas variáveis de ambiente');

  let creds;
  try { creds = JSON.parse(raw); }
  catch { throw new Error('GCP_KEY_JSON inválido (não é JSON válido)'); }

  if (!creds.private_key || !creds.client_email) {
    throw new Error('GCP_KEY_JSON incompleto (falta private_key/client_email)');
  }
  if (!client) client = new vision.ImageAnnotatorClient({ credentials: creds });
  return client;
}

// --- Lê o body multipart/form-data e devolve {buffer, filename, mimetype}
async function readMultipartFile(event) {
  const ct = event.headers['content-type'] || event.headers['Content-Type'];
  if (!ct || !ct.toLowerCase().startsWith('multipart/')) {
    throw new Error('Content-Type inválido (esperado multipart/form-data)');
  }

  return await new Promise((resolve, reject) => {
    try {
      const bb = Busboy({ headers: { 'content-type': ct }, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
      const chunks = [];
      let filename = 'upload';
      let mimetype = 'application/octet-stream';

      bb.on('file', (_name, file, info) => {
        if (info?.filename) filename = info.filename;
        if (info?.mimeType) mimetype = info.mimeType;
        file.on('data', (d) => chunks.push(d));
        file.on('limit', () => reject(new Error('Ficheiro demasiado grande')));
        file.on('end', () => resolve({
          buffer: Buffer.concat(chunks),
          filename,
          mimetype
        }));
      });
      bb.on('error', reject);

      const body = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64')
        : Buffer.from(event.body || '', 'utf8');

      bb.end(body);
    } catch (e) { reject(e); }
  });
}

// --- Normaliza imagem (HEIC→JPEG, resize máx 1600px)
async function normalizeImage({ buffer }) {
  if (!buffer?.length) throw new Error('Sem ficheiro recebido');

  const out = await sharp(buffer, { failOn: false })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return out;
}

async function doOCR(imageBuffer) {
  const vClient = getVisionClient();
  const [result] = await vClient.textDetection({ image: { content: imageBuffer } });
  const text = result?.fullTextAnnotation?.text || '';
  return text;
}

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...TEXT_HEADERS,
        'access-control-allow-methods': 'POST,GET,OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '',
    };
  }

  // Health-check
  if (event.httpMethod === 'GET') {
    try {
      getVisionClient();
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, message: 'ocr-proxy com Vision pronto' }) };
    } catch (e) {
      return { statusCode: 500, headers: TEXT_HEADERS, body: `OCR health error: ${e.message}` };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: TEXT_HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const { buffer, filename } = await readMultipartFile(event);
    const normalized = await normalizeImage({ buffer });
    const text = await doOCR(normalized);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ text, filename }),
    };
  } catch (e) {
    console.error('OCR ERROR:', e?.message, e?.stack);
    return { statusCode: 500, headers: TEXT_HEADERS, body: `OCR failure: ${e?.message || 'unknown'}` };
  }
};