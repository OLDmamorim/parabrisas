// APP.JS (BD + Validação de Eurocode + CSS Forçado para Texto Pequeno)
// =========================
// VERSÃO: 19/09/2025 00:27 - PERSISTÊNCIA NA BASE DE DADOS IMPLEMENTADA
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// ===== Auth token helper (auto) =====
const TOKEN_KEY = 'eg_auth_token';

function getSavedToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch(_){
    return '';
  }
}

function saveToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token || ''); } catch(_){}
}

async function promptForToken(message='Cola aqui o token de autenticação') {
  const t = window.prompt(message, getSavedToken() || '');
  if (t && t.trim()) { saveToken(t.trim()); return t.trim(); }
  return null;
}

async function authorizedFetch(url, options={}) {
  const opts = Object.assign({ headers: {} }, options);
  opts.headers = Object.assign({}, opts.headers);
  let token = getSavedToken();
  if (token) {
    opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    opts.headers['x-api-key'] = token;
  }
  let res = await fetch(url, opts);
  if (res.status === 401 || res.status === 403) {
    token = await promptForToken('Token necessário. Cola aqui o token (ex.: Bearer xxxxx ou só o token)');
    if (token) {
      opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      opts.headers['x-api-key'] = token;
      res = await fetch(url, opts);
    }
  }
  return res;
}

// ---- Seletores ----
const fileInput  = document.getElementById('fileInput');
const btnUpload  = document.getElementById('btnUpload');
const btnExport  = document.getElementById('btnExport');
const btnClear   = document.getElementById('btnClear');
const resultsBody= document.getElementById('resultsBody');

const cameraInput  = document.getElementById('cameraInput');
const btnCamera    = document.getElementById('btnCamera');
const mobileStatus = document.getElementById('mobileStatus');
const mobileHistoryList = document.getElementById('mobileHistoryList');

const desktopStatus = document.getElementById('desktopStatus');
const toast = document.getElementById('toast');

// ---- Modal de edição OCR ----
const editOcrModal = document.getElementById('editOcrModal');
const editOcrTextarea = document.getElementById('editOcrTextarea');
const editOcrClose = document.getElementById('editOcrClose');
const editOcrCancel = document.getElementById('editOcrCancel');
const editOcrSave = document.getElementById('editOcrSave');

// ---- Estado ----
let RESULTS = [];
let FILTERED_RESULTS = [];
let currentEditingRow = null;
let currentImageData = null;

// =========================
// CSS forçado (tamanho pequeno)
function addCustomCSS() {
  const style = document.createElement('style');
  style.textContent = `
    #resultsBody td,
    #resultsBody td * {
      font-size: 12px !important;
      line-height: 1.35 !important;
      letter-spacing: normal !important;
      font-weight: 400 !important;
    }
    #resultsBody button { font-size: 11px !important; }
    .table th { font-size: 12px !important; line-height: 1.35 !important; }
    .ocr-text, .ocr-text * {
      font-size: 12px !important; line-height: 1.35 !important;
      white-space: pre-wrap !important; word-break: break-word !important;
    }
  `;
  document.head.appendChild(style);
}

// =========================
// Utils UI
function showToast(msg, type='') {
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2200);
}

function setStatus(el, text, mode='') {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error','success');
  if (mode==='error') el.classList.add('error');
  if (mode==='success') el.classList.add('success');
}

// =========================
// Pesquisa Eurocode
function createSearchField() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;
  if (document.getElementById('searchField')) return;
  const searchHTML = `
    <span style="color: rgba(255,255,255,0.8); font-size: 14px; margin-left: 20px;">🔍</span>
    <input type="text" id="searchField" placeholder="Procurar Eurocode..." 
           style="margin-left: 8px; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.3); 
                  border-radius: 4px; font-size: 14px; background: rgba(255,255,255,0.1); color: white; width: 180px;">
    <button id="clearSearch" style="margin-left: 5px; padding: 6px 8px; background: none; color: rgba(255,255,255,0.7); 
                                   border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; cursor: pointer; font-size: 12px;">
      ✕
    </button>
  `;
  toolbar.innerHTML += searchHTML;
  const searchField = document.getElementById('searchField');
  const clearSearch = document.getElementById('clearSearch');
  searchField.addEventListener('input', (e) => filterResults(e.target.value));
  clearSearch.addEventListener('click', () => { searchField.value = ''; filterResults(''); });
}

function filterResults(searchTerm) {
  if (!searchTerm.trim()) {
    FILTERED_RESULTS = [...RESULTS];
  } else {
    const term = searchTerm.toLowerCase();
    FILTERED_RESULTS = RESULTS.filter(row => (row.eurocode || '').toLowerCase().includes(term));
  }
  renderTable();
}

// =========================
// Extração Eurocodes
function extractAllEurocodes(text) {
  if (!text) return [];
  const t = String(text).toUpperCase();
  const rx = /\b(\d{4})[\s\-_\.]*([A-Z]{2})[\s\-_\.]*([A-Z0-9]{0,10})\b/g;
  const found = [];
  let m;
  while ((m = rx.exec(t)) !== null) {
    const code = (m[1] + m[2] + m[3]).replace(/[^A-Z0-9]/g, '');
    if (code.length >= 6) found.push(code);
  }
  return [...new Set(found)].sort((a,b) => b.length - a.length).slice(0, 4);
}

// =========================
// Modal Validação Eurocode
function showEurocodeValidationModal(ocrText, filename, source, vehicle) {
  const eurocodes = extractAllEurocodes(ocrText);
  if (eurocodes.length === 0) {
    if (confirm('Nenhum Eurocode encontrado. Guardar mesmo assim?')) {
      saveToDatabase(ocrText, '', filename, source, vehicle);
    }
    return;
  }
  // … (resto igual, mantém modal de escolha)
}

// =========================
// Guardar BD
async function saveToDatabase(text, eurocode, filename, source, vehicle) {
  try {
    setStatus(desktopStatus, 'A guardar na base de dados...');
    const brand    = detectBrandFromText(text) || '';
    const carBrand = vehicle || detectVehicleAndModelFromText(text).full || '';
    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, eurocode, filename, source, brand, vehicle: carBrand })
    });
    if (response.ok) {
      showToast('Dados guardados com sucesso!', 'success');
      await loadResults();
    } else throw new Error('Erro ao guardar');
  } catch (error) {
    console.error('Erro ao guardar:', error);
    showToast('Erro ao guardar: ' + error.message, 'error');
  }
}

// =========================
// Modal edição OCR
function openEditOcrModal(row) {
  // … (mantém igual ao teu, não mexi)
}
window.openEditOcrModal = openEditOcrModal;

// =========================
// Normalização
function normalizeRow(r){
  let timestamp = r.timestamp || r.created_at || r.updated_at || r.ts || '';
  if (!timestamp) timestamp = new Date().toLocaleString('pt-PT');
  if (typeof timestamp === 'number') timestamp = new Date(timestamp).toLocaleString('pt-PT');
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    try { timestamp = new Date(timestamp).toLocaleString('pt-PT'); } catch {}
  }
  const text = r.text ?? '';
  let brand = r.brand ?? '';
  if (!brand && text) brand = detectBrandFromText(text) || '';
  return {
    id:        r.id ?? null,
    timestamp: timestamp,
    text:      text,
    eurocode:  r.eurocode ?? '',
    filename:  r.filename ?? '',
    source:    r.source ?? '',
    brand:     brand,
    vehicle:   r.vehicle ?? '',
    matricula: r.matricula ?? '',
    loja:      r.loja ?? 'LOJA',          // ✅ agora incluído
    observacoes: r.observacoes ?? ''      // ✅ agora incluído
  };
}

// =========================
// Carregar resultados
async function loadResults() {
  try {
    const response = await fetch(LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.ok && Array.isArray(data.rows)) {
      RESULTS = data.rows.map(normalizeRow);
      FILTERED_RESULTS = [...RESULTS];
      renderTable();
    }
  } catch (error) {
    console.error('Erro ao carregar:', error);
    RESULTS = []; FILTERED_RESULTS = []; renderTable();
  }
}

// =========================
// Render Tabela
function renderTable() {
  if (!resultsBody) return;
  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;
  if (dataToShow.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Nenhum registo</td></tr>`;
    return;
  }
  resultsBody.innerHTML = dataToShow.map((row, index) => `
    <tr>
      <td>${index+1}</td>
      <td>${row.timestamp}</td>
      <td>${row.vehicle || '—'}</td>
      <td>${row.eurocode}</td>
      <td>${row.brand || '—'}</td>
      <td>
        <input type="text" value="${row.matricula||''}" placeholder="XX-XX-XX"
               onblur="updateMatricula(${row.id}, this.value)">
      </td>
      <td>
        <select onchange="updateLoja(${row.id}, this.value)">
          <option value="LOJA" ${(row.loja||'LOJA')==='LOJA'?'selected':''}>LOJA</option>
          <option value="SM" ${row.loja==='SM'?'selected':''}>SM</option>
        </select>
      </td>
      <td>
        <input type="text" value="${row.observacoes||''}" placeholder="Observações..."
               onblur="updateObservacoes(${row.id}, this.value)">
      </td>
      <td>
        <button onclick="openEditOcrModal(${index})">✏️</button>
        <button onclick="deleteRow(${row.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// =========================
// Update inline
async function updateLoja(id, loja) {
  await fetch(UPDATE_URL, {
    method: 'POST', headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ id, loja })
  });
}
window.updateLoja = updateLoja;

async function updateObservacoes(id, observacoes) {
  await fetch(UPDATE_URL, {
    method: 'POST', headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ id, observacoes })
  });
}
window.updateObservacoes = updateObservacoes;

async function updateMatricula(id, matricula) {
  await fetch(UPDATE_URL, {
    method: 'POST', headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ id, matricula })
  });
}
window.updateMatricula = updateMatricula;

// =========================
// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  addCustomCSS();
  loadResults();
  setTimeout(createSearchField, 100);
  if (btnUpload) btnUpload.addEventListener('click', () => fileInput?.click());
  if (fileInput) fileInput.addEventListener('change', e => { const f=e.target.files[0]; if (f) processImage(f); });
  if (btnCamera) btnCamera.addEventListener('click', () => cameraInput?.click());
  if (cameraInput) cameraInput.addEventListener('change', e => { const f=e.target.files[0]; if (f) processImage(f); });
});
