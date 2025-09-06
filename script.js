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

// ===== Pesquisa ultra-leve (sem observers) =====
(function () {
  // tenta achar a toolbar; se não existir, não faz nada
  const toolbar = document.querySelector('.toolbar');
  const tbody = document.querySelector('#resultsTable tbody, #resultsBody');

  if (!toolbar || !tbody) return;

  // cria o input de pesquisa com estilos inline (para não mexer no CSS)
  const wrap = document.createElement('div');
  wrap.style.marginLeft = 'auto';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Pesquisar… (/ foca, Esc limpa)';
  input.autocomplete = 'off';
  Object.assign(input.style, {
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'inherit',
    padding: '10px 12px',
    borderRadius: '12px',
    minWidth: '220px',
    outline: 'none'
  });
  input.addEventListener('focus', () => {
    input.style.boxShadow = '0 0 0 3px rgba(34,211,238,.12)';
    input.style.borderColor = 'rgba(34,211,238,1)';
  });
  input.addEventListener('blur', () => {
    input.style.boxShadow = 'none';
    input.style.borderColor = 'rgba(255,255,255,0.15)';
  });

  wrap.appendChild(input);
  toolbar.appendChild(wrap);

  // helper: normalizar (sem acentos, lowercase)
  const norm = (s = '') =>
    s.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

  function applyFilter() {
    const q = norm(input.value);
    const rows = Array.from(tbody.querySelectorAll('tr'));
    for (const tr of rows) {
      const c3 = tr.querySelector('td:nth-child(3)');
      const c4 = tr.querySelector('td:nth-child(4)');
      const t3 = norm(c3 ? (c3.innerText || c3.textContent) : '');
      const t4 = norm(c4 ? (c4.innerText || c4.textContent) : '');
      const match = !q || t3.includes(q) || t4.includes(q);
      tr.style.display = match ? '' : 'none';
    }
  }

  // eventos
  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      applyFilter();
    }
  });

  // atalho global: '/' foca pesquisa (se não estás já num input/textarea)
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
})();