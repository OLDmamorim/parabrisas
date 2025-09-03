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

// --- Instância do cliente Vision com validações legíveis
let client;
function getVisionClient() {
  const raw = process.env.GCP_KEY_JSON;
  if (!raw) throw new Error('GCP_KEY_JSON ausente nas variáveis de ambiente');

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    throw new Error('GCP_KEY_JSON inválido (não é JSON válido)');
  }
  if (!creds.private_key || !creds.client_email) {
    throw new Error('GCP_KEY_JSON incompleto (falta private_key/client_email)');
  }

  if (!client) {
    client = new vision.ImageAnnotatorClient({ credentials: creds });
  }
  return client;
}

// --- Lê o body multipart/form-data e devolve {buffer, filename, mimetype}
async function readMultipartFile(event) {
  return await new Promise((resolve, reject) => {
    try {
      const bb = Busboy({ headers: event.headers });
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
    } catch (e) {
      reject(e);
    }
  });
}

// --- Normaliza a imagem: converte HEIC/HEIF e limita tamanho (máx 1600px)
async function normalizeImage({ buffer, mimetype }) {
  if (!buffer?.length) throw new Error('Sem ficheiro recebido');

  // Tenta identificar formato com o sharp
  let img = sharp(buffer, { failOn: false });

  // Se for HEIC/HEIF (ou formato estranho) convertemos para JPEG
  const isHeic = /heic|heif/i.test(mimetype || '');
  if (isHeic) {
    img = sharp(buffer, { failOn: false });
  }

  // Reduz para máx 1600px (mantém proporção), e exporta JPEG de qualidade 80
  // (Mesmo que já seja JPG/PNG, isto garante tamanho razoável para o Vision)
  const out = await img
    .rotate()                         // respeita EXIF
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return out;
}

// --- OCR propriamente dito
async function doOCR(imageBuffer) {
  const vClient = getVisionClient();
  const [result] = await vClient.textDetection({ image: { content: imageBuffer } });
  const text = result?.fullTextAnnotation?.text || '';
  return text;
}

export const handler = async (event) => {
  // Preflight/CORS básico (se precisares)
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

  // Health-check simples
  if (event.httpMethod === 'GET') {
    try {
      // também valida as credenciais aqui; se falhar, devolve erro legível
      getVisionClient();
      return {
        statusCode: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ ok: true, message: 'ocr-proxy com Vision pronto' }),
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: TEXT_HEADERS,
        body: `OCR health error: ${e.message}`,
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: TEXT_HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const { buffer, filename, mimetype } = await readMultipartFile(event);
    const normalized = await normalizeImage({ buffer, mimetype });
    const text = await doOCR(normalized);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ text, filename }),
    };
  } catch (e) {
    // Log detalhado (aparece em Netlify → Functions → Logs)
    console.error('OCR ERROR:', e?.message, e?.stack);
    return {
      statusCode: 500,
      headers: TEXT_HEADERS,
      body: `OCR failure: ${e?.message || 'unknown'}`,
    };
  }
};