const fileInput = document.getElementById('fileInput');
const imageUrl = document.getElementById('imageUrl');
const btnUrl = document.getElementById('btnUrl');
const btnRun = document.getElementById('btnRun');
const output = document.getElementById('output');
const preview = document.getElementById('preview');
const qrOnly = document.getElementById('qrOnly');

let payload = {};

btnUrl.addEventListener('click', () => {
  if (!imageUrl.value) return;
  payload = { imageUrl: imageUrl.value.trim() };
  showPreviewURL(imageUrl.value.trim());
});

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const buf = await f.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mime = f.type || 'image/png';
  payload = { imageBase64: `data:${mime};base64,${base64}` };
  showPreviewFile(f);
});

btnRun.addEventListener('click', async () => {
  if (!payload.imageUrl && !payload.imageBase64) {
    output.textContent = '⚠️ Escolhe um ficheiro ou cola um URL primeiro.';
    return;
  }
  output.textContent = '⏳ A processar…';
  try {
    const res = await fetch('/.netlify/functions/ocr-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, qrOnly: qrOnly.checked })
    });
    const data = await res.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = 'Erro: ' + err.message;
  }
});

function showPreviewURL(url){
  preview.innerHTML = '';
  const img = new Image();
  img.src = url;
  img.alt = 'preview';
  preview.appendChild(img);
}

function showPreviewFile(file){
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.onload = ()=> URL.revokeObjectURL(img.src);
  preview.appendChild(img);
}