// APP.JS (BD + Validação de Eurocode + CSS Forçado para Texto Pequeno)
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

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
      letter-spacing: normal !important; font-weight: 400 !important;
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
// Render Mobile History (Últimas Capturas)
function renderMobileHistory() {
  if (!mobileHistoryList) return;

  mobileHistoryList.innerHTML = '';

  // Mostra as últimas 5 capturas
  const lastFive = RESULTS.slice(0, 5);

  lastFive.forEach(row => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${row.vehicle || '—'}</strong> – 
      <span style="color:#007acc; font-weight:bold;">
        ${row.eurocode || '—'}
      </span>
    `;
    mobileHistoryList.appendChild(li);
  });
}

// =========================
// Procura de Eurocode (Na mesma linha)
function createSearchField() { /* ... sem alterações ... */ }

// =========================
// Extração de Eurocodes
function extractAllEurocodes(text) { /* ... sem alterações ... */ }

// =========================
// Modal de Validação de Eurocode
function showEurocodeValidationModal(ocrText, filename, source, vehicle) { /* ... sem alterações ... */ }

// =========================
// Guardar na Base de Dados
async function saveToDatabase(text, eurocode, filename, source, vehicle) { /* ... sem alterações ... */ }

// =========================
// Modal de edição OCR
function openEditOcrModal(row) { /* ... sem alterações ... */ }
window.openEditOcrModal = openEditOcrModal;

// =========================
// Normalização
function normalizeRow(r){ /* ... sem alterações ... */ }

// =========================
// OCR
async function runOCR(imageBase64) { /* ... sem alterações ... */ }

// =========================
// Carregar resultados da API
async function loadResults() {
  try {
    setStatus(desktopStatus, 'A carregar dados...');
    const response = await fetch(LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.ok && Array.isArray(data.rows)) {
      RESULTS = data.rows.map(normalizeRow);
      FILTERED_RESULTS = [...RESULTS];
      renderTable();
      renderMobileHistory(); // <<< ADICIONADO AQUI
      setStatus(desktopStatus, `${RESULTS.length} registos carregados`, 'success');
    } else {
      throw new Error('Formato de resposta inválido');
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    setStatus(desktopStatus, 'Erro a carregar dados', 'error');
    RESULTS = [];
    FILTERED_RESULTS = [];
    renderTable();
    renderMobileHistory(); // garante que limpa o histórico no mobile também
  }
}

// =========================
// Render desktop
function renderTable() { /* ... sem alterações ... */ }

// =========================
// Eliminar registo
async function deleteRow(id) { /* ... sem alterações ... */ }
window.deleteRow = deleteRow;

// =========================
// Processar imagem
async function processImage(file) { /* ... sem alterações ... */ }

// =========================
// Export CSV
function exportCSV() { /* ... sem alterações ... */ }

// =========================
// Limpar tabela
async function clearTable() { /* ... sem alterações ... */ }

// =========================
// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  addCustomCSS();
  loadResults();
  setTimeout(createSearchField, 100);

  if (btnUpload) btnUpload.addEventListener('click', () => fileInput?.click());
  if (fileInput)  fileInput.addEventListener('change', (e) => { const f=e.target.files[0]; if (f) processImage(f); });
  if (btnCamera)  btnCamera.addEventListener('click', () => cameraInput?.click());
  if (cameraInput)cameraInput.addEventListener('change', (e) => { const f=e.target.files[0]; if (f) processImage(f); });
  if (btnExport)  btnExport.addEventListener('click', exportCSV);
  if (btnClear)   btnClear.addEventListener('click', clearTable);

  const isMobile = window.innerWidth <= 768;
  const mobileView = document.getElementById('mobileView');
  const desktopView = document.getElementById('desktopView');
  const viewBadge = document.getElementById('viewBadge');

  if (isMobile) {
    if (mobileView) mobileView.style.display = 'block';
    if (desktopView) desktopView.style.display = 'none';
    if (viewBadge) viewBadge.textContent = 'Mobile';
  } else {
    if (mobileView) mobileView.style.display = 'none';
    if (desktopView) desktopView.style.display = 'block';
    if (viewBadge) viewBadge.textContent = 'Desktop';
  }
});

// =========================
// Atualização automática
setInterval(loadResults, 30000);

// =========================
// Detecção de tipologia vidro
function detectGlassType(eurocode) { /* ... sem alterações ... */ }

// ====== BRAND DETECTION ======
function normBrandText(s){ /* ... sem alterações ... */ }
const BRAND_PATTERNS = [ /* ... sem alterações ... */ ];
function detectBrandFromText(rawText){ /* ... sem alterações ... */ }
function editDistance(a,b){ /* ... sem alterações ... */ }
function guessCanonFromToken(t){ /* ... sem alterações ... */ }

// (opcional) reduzir imagem
async function downscaleImageToBase64(file, maxDim = 1800, quality = 0.75) { /* ... sem alterações ... */ }

// ====== VEHICLE DETECTION ======
function normVehicleText(s){ /* ... sem alterações ... */ }
const VEHICLE_PATTERNS = [ /* ... sem alterações ... */ ];
function detectVehicleFromText(rawText) { /* ... sem alterações ... */ }
function guessVehicleFromToken(t) { /* ... sem alterações ... */ }
function detectVehicleAndModelFromText(rawText) { /* ... sem alterações ... */ }