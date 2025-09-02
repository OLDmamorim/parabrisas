import fetch from 'node-fetch';
import Jimp from 'jimp';
import jsQR from 'jsqr';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, imageUrl, qrOnly = false } = req.body || {};
  if (!imageBase64 && !imageUrl) {
    return res.status(400).json({ error: 'Falta imageBase64 ou imageUrl' });
  }

  try {
    const buffer = await getImageBuffer(imageBase64, imageUrl);
    let qr = null;
    try {
      qr = await decodeQR(buffer);
    } catch (_) {}
    if (!qrOnly) {
      const ocr = await googleOCR(buffer);
      return res.status(200).json({ ok: true, ocr, qr });
    } else {
      return res.status(200).json({ ok: true, qr });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

async function getImageBuffer(imageBase64, imageUrl){
  if (imageBase64 && imageBase64.startsWith('data:')) {
    const base64 = imageBase64.split(',')[1];
    return Buffer.from(base64, 'base64');
  }
  if (imageUrl) {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error('Falha a obter imagem do URL');
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('Sem imagem');
}

async function googleOCR(buffer){
  const apiKey = process.env.OCR_API_KEY;
  if (!apiKey) throw new Error('OCR_API_KEY não definido');
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const imgB64 = buffer.toString('base64');
  const body = {
    requests: [{ image: { content: imgB64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }]
  };
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message || 'Erro Vision API');
  const fullText = json?.responses?.[0]?.fullTextAnnotation?.text || '';
  const blocks = json?.responses?.[0]?.textAnnotations || [];
  return { text: fullText, blocks };
}

async function decodeQR(buffer){
  const img = await Jimp.read(buffer);
  const { data, width, height } = img.bitmap;
  const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const result = jsQR(clamped, width, height);
  if (result) return { text: result.data, location: result.location };
  return null;
}
