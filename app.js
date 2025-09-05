// =========================
// APP.JS - OCR + Eurocode
// =========================

// Seletores comuns
const fileInput = document.getElementById('fileInput');
const btnUpload = document.getElementById('btnUpload');
const btnExport = document.getElementById('btnExport');
const btnClear  = document.getElementById('btnClear');
const resultsTable = document.getElementById('resultsTable');
const resultsBody  = document.getElementById('resultsBody');

const cameraInput  = document.getElementById('cameraInput');
const btnCamera    = document.getElementById('btnCamera');
const mobileStatus = document.getElementById('mobileStatus');
const mobileHistoryList = document.getElementById('mobileHistoryList');

const desktopStatus = document.getElementById('desktopStatus');
const toast = document.getElementById('toast');

// Base de dados local (array)
let results = [];
let counter = 1;

// =========================
// Toast
// =========================
function showToast(msg, type='') {
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// =========================
// OCR - chamada API
// =========================
async function runOCR(imageBase64) {
  try {
    // tenta primeiro endpoint original
    let res = await fetch('/api/ocr-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 })
    });

    if (!res.ok) {
      // fallback para Netlify functions
      res = await fetch('/.netlify/functions/ocr-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 })
      });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.text || '';
  } catch (err) {
    console.error('Erro no OCR:', err);
    showToast('Erro no OCR: ' + err.message, 'error');
    return '';
  }
}

// =========================
// Eurocode regex
// =========================
function extractEurocode(text) {
  // regra: 4 dígitos + 2 a 9 caracteres (letras/números)
  const regex = /\b\d{4}[A-Z0-9]{2,9}\b/i;
  const match = text.match(regex);
  return match ? match[0] : '';
}

// =========================
// Render table
// =========================
function renderTable() {
  resultsBody.innerHTML = '';
  results.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${row.timestamp}</td>
      <td class="ocr-text">${row.text}</td>
      <td>${row.eurocode || ''}</td>
      <td>
        <button class="btn btn-mini danger" onclick="deleteRow(${idx})">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  updateMobileHistory();
}

function deleteRow(i) {
  results.splice(i,1);
  renderTable();
}

// =========================
// Atualiza histórico mobile
// =========================
function updateMobileHistory() {
  mobileHistoryList.innerHTML = '';
  if (results.length === 0) {
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há capturas realizadas.</p>';
    return;
  }
  results.forEach(r => {
    if (r.eurocode) {
      const div = document.createElement('div');
      div.className = 'history-item-text';
      div.textContent = r.eurocode;
      mobileHistoryList.appendChild(div);
    }
  });
}

// =========================
// Upload Desktop
// =========================
btnUpload?.addEventListener('click', ()=> fileInput.click());
fileInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  desktopStatus.textContent = '⏳ A processar…';
  const buf = await f.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mime = f.type || 'image/png';
  const img64 = `data:${mime};base64,${base64}`;
  const text = await runOCR(img64);
  const euro = extractEurocode(text);
  const ts = new Date().toLocaleString('pt-PT');
  if (euro) {
    results.push({ timestamp: ts, text, eurocode: euro });
    renderTable();
    showToast('Eurocode adicionado ✅','success');
  } else {
    showToast('Nenhum Eurocode válido encontrado','error');
  }
  desktopStatus.textContent = '';
});

// =========================
// Câmera Mobile
// =========================
btnCamera?.addEventListener('click', ()=> cameraInput.click());
cameraInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  mobileStatus.textContent = '⏳ A processar…';
  const buf = await f.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mime = f.type || 'image/png';
  const img64 = `data:${mime};base64,${base64}`;
  const text = await runOCR(img64);
  const euro = extractEurocode(text);
  const ts = new Date().toLocaleString('pt-PT');
  if (euro) {
    results.push({ timestamp: ts, text, eurocode: euro });
    renderTable();
    showToast('Eurocode guardado ✅','success');
  } else {
    showToast('Nenhum Eurocode válido encontrado','error');
  }
  mobileStatus.textContent = '';
});

// =========================
// Exportar CSV
// =========================
btnExport?.addEventListener('click', () => {
  if (results.length === 0) {
    showToast('Não há dados para exportar','error');
    return;
  }
  const rows = [
    ['#','Data/Hora','Texto','Eurocode'],
    ...results.map((r,i)=> [i+1,r.timestamp,r.text,r.eurocode])
  ];
  const csv = rows.map(r => r.map(c => `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'capturas.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// =========================
// Limpar Tabela
// =========================
btnClear?.addEventListener('click', () => {
  if (!confirm('Tens a certeza que queres limpar todos os registos?')) return;
  results = [];
  renderTable();
  showToast('Tabela limpa','success');
});