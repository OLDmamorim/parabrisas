// APP.JS (Receção material) — versão com patchExistingMobileLis
// ============================================================

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
// CSS forçado (texto pequeno)
function addCustomCSS() {
  const style = document.createElement('style');
  style.textContent = `
    #resultsBody td, #resultsBody td * { font-size: 12px !important; line-height: 1.35 !important; }
    #resultsBody button { font-size: 11px !important; }
    .table th { font-size: 12px !important; line-height: 1.35 !important; }
    .ocr-text, .ocr-text * { font-size: 12px !important; line-height: 1.35 !important; white-space: pre-wrap !important; }
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
  const base = (FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS).slice(0, 5);

  base.forEach(row => {
    const vehicle =
      (row.vehicle && row.vehicle.trim()) ||
      (row.text && detectVehicleAndModelFromText(row.text).full) ||
      (row.brand || '—');
    const euro = row.eurocode || '—';

    const li = document.createElement('li');
    li.innerHTML = `<strong>${vehicle}</strong> – <span style="color:#007acc; font-weight:bold;">${euro}</span>`;
    mobileHistoryList.appendChild(li);
  });
}

// =========================
// PATCH MINÍMO: atualiza os <li> já existentes no HTML antigo
function patchExistingMobileLis() {
  const rows = (FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS).slice(0, 5);
  const lis  = document.querySelectorAll('#mobileHistoryList li');

  lis.forEach((li, i) => {
    const r = rows[i];
    if (!r) return;

    const vehicle = (r.vehicle && r.vehicle.trim())
      || (r.text && detectVehicleAndModelFromText(r.text).full)
      || (r.brand || '—');
    const euro = r.eurocode || '—';

    const title = li.querySelector('.title, .label, span');
    if (title) title.textContent = `${vehicle} – ${euro}`;
    else li.textContent = `${vehicle} – ${euro}`;
  });
}

// =========================
// Barra de procura (Eurocode)
function createSearchField() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || document.getElementById('searchField')) return;

  toolbar.insertAdjacentHTML('beforeend', `
    <span style="color: rgba(255,255,255,0.8); font-size: 14px; margin-left: 20px;">🔍</span>
    <input type="text" id="searchField" placeholder="Procurar Eurocode..." 
           style="margin-left: 8px; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.3); 
                  border-radius: 4px; font-size: 14px; background: rgba(255,255,255,0.1); color: white; width: 180px;">
    <button id="clearSearch" style="margin-left: 5px; padding: 6px 8px; background: none; color: rgba(255,255,255,0.7); 
                                   border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; cursor: pointer; font-size: 12px;">✕</button>
  `);

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
    FILTERED_RESULTS = RESULTS.filter(r => (r.eurocode || '').toLowerCase().includes(term));
  }
  renderTable();
  renderMobileHistory();
  patchExistingMobileLis(); // <-- patch mínimo
}

// =========================
// Extração de Eurocodes
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
  const unique = [...new Set(found)];
  return unique.sort((a,b)=>b.length-a.length).slice(0,4);
}

// =========================
// Modal de Validação de Eurocode
function showEurocodeValidationModal(ocrText, filename, source, vehicle) {
  const eurocodes = extractAllEurocodes(ocrText);
  if (eurocodes.length === 0) {
    if (confirm('Nenhum Eurocode encontrado no texto. Deseja guardar sem Eurocode?')) {
      saveToDatabase(ocrText, '', filename, source, vehicle);
    }
    return;
  }

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    display: flex; justify-content: center; align-items: center; z-index: 10000;
  `;
  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;
    max-height: 80vh; overflow-y: auto;
  `;
  content.innerHTML = `
    <h3 style="margin-top: 0; text-align:center;">🔍 Selecionar Eurocode</h3>
    <p style="color:#666">Clique no correto:</p>
    <div style="margin-bottom: 14px;">
      ${eurocodes.map(code => `
        <button onclick="selectEurocode('${code}')" 
                style="display:block;width:100%;padding:12px;margin:6px 0;background:#007acc;color:#fff;border:0;border-radius:6px;font-weight:700;">
          ${code}
        </button>`).join('')}
    </div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button onclick="selectEurocode('')" style="padding:10px 20px;background:#6c757d;color:#fff;border:0;border-radius:6px;">Sem Eurocode</button>
      <button onclick="closeEurocodeModal()" style="padding:10px 20px;background:#dc3545;color:#fff;border:0;border-radius:6px;">Cancelar</button>
    </div>
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);

  window.currentEurocodeModal = modal;
  window.currentImageData = {
    ocrText, filename, source,
    vehicle: detectVehicleAndModelFromText(ocrText).full || ''
  };
  window.selectEurocode = function(selectedCode) {
    const { ocrText, filename, source, vehicle } = window.currentImageData;
    closeEurocodeModal();
    saveToDatabase(ocrText, selectedCode, filename, source, vehicle);
  };
  window.closeEurocodeModal = function() {
    if (window.currentEurocodeModal) {
      document.body.removeChild(window.currentEurocodeModal);
      window.currentEurocodeModal = null;
      window.currentImageData = null;
    }
  };
}

// =========================
// Guardar na Base de Dados
async function saveToDatabase(text, eurocode, filename, source, vehicle) {
  try {
    setStatus(desktopStatus, 'A guardar na base de dados...');
    setStatus(mobileStatus,  'A guardar na base de dados...');

    const brand    = detectBrandFromText(text) || '';
    const carBrand = vehicle || detectVehicleAndModelFromText(text).full || '';

    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, eurocode, filename, source, brand, vehicle: carBrand })
    });

    if (response.ok) {
      showToast('Dados guardados com sucesso!', 'success');
      setStatus(desktopStatus, 'Dados guardados com sucesso!', 'success');
      setStatus(mobileStatus,  'Dados guardados com sucesso!', 'success');
      await loadResults();
    } else {
      throw new Error('Erro ao guardar na base de dados');
    }
  } catch (error) {
    console.error('Erro ao guardar:', error);
    showToast('Erro ao guardar na base de dados: ' + error.message, 'error');
    setStatus(desktopStatus, 'Erro ao guardar na base de dados', 'error');
    setStatus(mobileStatus,  'Erro ao guardar na base de dados', 'error');
  }
}

// =========================
// Modal de edição OCR
function openEditOcrModal(row) {
  if (!editOcrModal || !editOcrTextarea) return;

  currentEditingRow = row;
  editOcrTextarea.value = row.text || '';
  editOcrModal.style.display = 'flex';
  editOcrTextarea.focus();

  const handleSave = async () => {
    const newText = editOcrTextarea.value.trim();
    if (!newText) { showToast('Texto não pode estar vazio', 'error'); return; }

    try {
      const newBrand = detectBrandFromText(newText) || '';
      const response = await fetch(UPDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id, text: newText,
          eurocode: row.eurocode || '',
          filename: row.filename || '',
          source: row.source || '',
          brand: newBrand
        })
      });
      if (response.ok) {
        await response.json();
        showToast('Texto atualizado com sucesso!', 'success');
        await loadResults();
        handleCancel();
      } else {
        const t = await response.text();
        throw new Error(`Erro ${response.status}: ${t}`);
      }
    } catch (e) {
      console.error('Erro ao atualizar:', e);
      showToast('Erro ao atualizar: ' + e.message, 'error');
    }
  };

  const handleCancel = () => {
    editOcrModal.style.display = 'none';
    currentEditingRow = null;
    cleanup();
  };

  const handleKeydown = (e) => { if (e.key==='Escape') handleCancel(); else if (e.key==='Enter' && e.ctrlKey) handleSave(); };
  const handleBackdropClick = (e) => { if (e.target === editOcrModal) handleCancel(); };

  function cleanup() {
    editOcrSave?.removeEventListener('click', handleSave);
    editOcrCancel?.removeEventListener('click', handleCancel);
    editOcrClose?.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKeydown);
    editOcrModal.removeEventListener('click', handleBackdropClick);
  }

  editOcrSave?.addEventListener('click', handleSave);
  editOcrCancel?.addEventListener('click', handleCancel);
  editOcrClose?.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeydown);
  editOcrModal.addEventListener('click', handleBackdropClick);
}
window.openEditOcrModal = openEditOcrModal;

// =========================
// Normalização
function normalizeRow(r){
  let timestamp = r.timestamp || r.datahora || r.created_at || r.createdAt || 
                  r.date || r.datetime || r.data || r.hora || r.created || 
                  r.updated_at || r.updatedAt || r.ts || '';

  if (!timestamp) timestamp = new Date().toLocaleString('pt-PT');
  if (typeof timestamp === 'number') timestamp = new Date(timestamp).toLocaleString('pt-PT');
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    try { timestamp = new Date(timestamp).toLocaleString('pt-PT'); } catch {}
  }

  const text = r.text ?? r.ocr_text ?? r.ocr ?? r.texto ?? '';
  let brand = r.brand ?? '';
  if (!brand && text) brand = detectBrandFromText(text) || '';

  return {
    id:        r.id ?? r.rowId ?? r.uuid ?? r._id ?? null,
    timestamp: timestamp,
    text:      text,
    eurocode:  r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? r.codigo ?? '',
    filename:  r.filename ?? r.file ?? '',
    source:    r.source ?? r.origem ?? '',
    brand:     brand,
    vehicle:   r.vehicle ?? '' // "Marca" ou "Marca Modelo"
  };
}

// =========================
// OCR (com retry base64 -> dataURL)
async function runOCR(payload) {
  async function postToOCR(imageBase64) {
    const res = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.text || data.fullText || data.raw || '';
  }

  try {
    let text = await postToOCR(
      typeof payload === 'string' && payload.startsWith('data:')
        ? payload.split(',')[1]
        : payload
    );
    if (!text) {
      const dataURL = typeof payload === 'string' && payload.startsWith('data:')
        ? payload
        : `data:image/jpeg;base64,${payload}`;
      text = await postToOCR(dataURL);
    }
    return text;
  } catch (err) {
    console.error('Erro no OCR:', err);
    showToast('Erro no OCR', 'error');
    return '';
  }
}

// =========================
/* Carregar resultados da API */
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
      renderMobileHistory();
      patchExistingMobileLis();           // <-- patch mínimo
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
    renderMobileHistory();
    patchExistingMobileLis();             // <-- patch mínimo
  }
}

// =========================
// Render (Desktop)
function renderTable() {
  if (!resultsBody) return;

  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToShow.length === 0) {
    const searchField = document.getElementById('searchField');
    const isSearching = searchField && searchField.value.trim();
    const message = isSearching
      ? 'Nenhum registo encontrado para esta procura'
      : 'Nenhum registo encontrado';
    resultsBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">${message}</td></tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, index) => {
    const originalIndex = RESULTS.findIndex(r => r.id === row.id);
    const glassType = detectGlassType(row.eurocode);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${row.timestamp}</td>
        <td style="font-weight:600;color:#16a34a;">${glassType}</td>
        <td>${row.vehicle || '—'}</td>
        <td style="font-weight:700;color:#007acc;">${row.eurocode}</td>
        <td>${row.brand || '—'}</td>
        <td>
          <div style="display:flex;gap:8px;align-items:center;">
            <button onclick="openEditOcrModal(RESULTS[${originalIndex}])" style="padding:4px 8px;background:none;color:#666;border:none;cursor:pointer;border-radius:3px;">✏️ Editar</button>
            <button onclick="deleteRow(${row.id})" style="padding:4px 8px;background:none;color:#dc3545;border:none;cursor:pointer;border-radius:3px;">🗑️ Apagar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// =========================
// Eliminar registo
async function deleteRow(id) {
  if (!confirm('Tem a certeza que quer eliminar este registo?')) return;
  try {
    const response = await fetch(DELETE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (response.ok) { showToast('Registo eliminado com sucesso!', 'success'); await loadResults(); }
    else throw new Error('Erro ao eliminar');
  } catch (e) {
    console.error('Erro ao eliminar:', e);
    showToast('Erro ao eliminar registo', 'error');
  }
}
window.deleteRow = deleteRow;

// =========================
// Processar imagem (downscale + fallback)
async function processImage(file) {
  if (!file) return;
  setStatus(desktopStatus, 'A processar imagem...');
  setStatus(mobileStatus,  'A processar imagem...');

  try {
    const dataURL = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    let base64Reduced = null;
    try { base64Reduced = await downscaleImageToBase64(file, 1800, 0.8); } catch {}

    let ocrText = await runOCR(base64Reduced || dataURL);
    if (!ocrText) ocrText = await runOCR(dataURL);
    if (!ocrText) throw new Error('Nenhum texto encontrado na imagem');

    const vehicle = detectVehicleAndModelFromText(ocrText).full || '';
    setStatus(desktopStatus, 'Texto extraído! Selecione o Eurocode...', 'success');
    setStatus(mobileStatus,  'Texto extraído! Selecione o Eurocode...', 'success');
    showEurocodeValidationModal(ocrText, file.name, 'upload', vehicle);
  } catch (e) {
    console.error('Erro ao processar imagem:', e);
    showToast('Erro ao processar imagem', 'error');
    setStatus(desktopStatus, 'Erro ao processar imagem', 'error');
    setStatus(mobileStatus,  'Erro ao processar imagem', 'error');
  }
}

// =========================
// Export CSV
function exportCSV() {
  const data = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;
  if (data.length === 0) { showToast('Nenhum dado para exportar', 'error'); return; }

  const headers = ['#','Data/Hora','Texto OCR','Eurocode','Ficheiro'];
  const csv = [
    headers.join(','),
    ...data.map((row, i) => [
      i + 1,
      `"${row.timestamp}"`,
      `"${(row.text || '').replace(/"/g,'""')}"`,
      `"${row.eurocode || ''}"`,
      `"${row.filename || ''}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `expressglass_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  showToast('CSV exportado com sucesso!', 'success');
}

// =========================
// Limpar tabela
async function clearTable() {
  if (!confirm('Tem a certeza que quer limpar todos os dados?')) return;
  try {
    const response = await fetch('/.netlify/functions/clear-ocr', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) { showToast('Tabela limpa com sucesso!', 'success'); await loadResults(); }
    else throw new Error('Erro ao limpar tabela');
  } catch (e) {
    console.error('Erro ao limpar tabela:', e);
    showToast('Erro ao limpar tabela', 'error');
  }
}

// =========================
// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  addCustomCSS();
  loadResults();
  setTimeout(createSearchField, 100);

  btnUpload?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) processImage(f); });
  btnCamera?.addEventListener('click', () => cameraInput?.click());
  cameraInput?.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) processImage(f); });
  btnExport?.addEventListener('click', exportCSV);
  btnClear?.addEventListener('click', clearTable);

  const isMobile = window.innerWidth <= 768;
  const mobileView = document.getElementById('mobileView');
  const desktopView = document.getElementById('desktopView');
  const viewBadge = document.getElementById('viewBadge');
  if (isMobile) { mobileView && (mobileView.style.display='block'); desktopView && (desktopView.style.display='none'); viewBadge && (viewBadge.textContent='Mobile'); }
  else { mobileView && (mobileView.style.display='none'); desktopView && (desktopView.style.display='block'); viewBadge && (viewBadge.textContent='Desktop'); }
});

// =========================
// Atualização automática
setInterval(loadResults, 30000);

// =========================
// Tipologia de vidro (pela 1.ª letra do eurocode)
function detectGlassType(eurocode) {
  if (!eurocode || typeof eurocode !== 'string') return '—';
  const m = eurocode.trim().toUpperCase().match(/[A-Z]/);
  if (!m) return '—';
  switch (m[0]) {
    case 'A': return 'Parabrisas';
    case 'B': return 'Óculo';
    case 'L':
    case 'R': return 'Lateral';
    case 'T': return 'Teto';
    default:  return '—';
  }
}

// ====== BRAND DETECTION ======
function normBrandText(s){
  return String(s||"").toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').replace(/O/g,'0').replace(/I/g,'1').trim();
}
const BRAND_PATTERNS = [
  { canon: "AGC", rx: /\bA[GC]C\b|\bAG[0O]\b|\bASAH[1I]\b|\bASAH1\b/ },
  { canon: "Pilkington", rx: /\bP[1I]LK[1I]NGT[0O]N\b|\bPILKINGTON\b|\bPILK\b|\bP1LK1NGT0N\b/ },
  { canon: "Saint-Gobain Sekurit", rx: /\bSEKUR[1I]T\b|\bSA[1I]NT\s*G[0O]BA[1I]N\b|\bSEKUR1T\b/ },
  { canon: "Guardian", rx: /\bGUARD[1I]AN\b|\bGUARDIAN\b/ },
  { canon: "Fuyao (FYG/FUYAO)", rx: /\bFUYA[0O]\b|\bFYG\b|\bFUYA0\b/ },
  { canon: "XYG", rx: /\bXYG\b|\bXY[6G]\b/ },
  { canon: "NordGlass", rx: /\bN[0O]RDGLASS\b|\bNORDGLASS\b|\bN0RDGLASS\b/ },
  { canon: "Splintex", rx: /\bSPL[1I]NTEX\b|\bSPLINTEX\b/ },
  { canon: "Sicursiv", rx: /\bS[1I]CURS[1I]V\b|\bSICURSIV\b|\bS1CURS1V\b/ },
  { canon: "Carlite", rx: /\bCARL[1I]TE\b|\bCARLITE\b/ },
  { canon: "PPG", rx: /\bPPG\b|\bPP[6G]\b/ },
  { canon: "Mopar", rx: /\bM[0O]PAR\b|\bMOPAR\b/ },
  { canon: "Shatterprufe", rx: /\bSHATTERPRUFE\b|\bSHATTERPRUF\b/ },
  { canon: "Protec", rx: /\bPR[0O]TEC\b|\bPROTEC\b/ },
  { canon: "Lamilex", rx: /\bLAM[1I][1I]LEX\b|\bLAMILEX\b/ },
  { canon: "Vitro", rx: /\bV[1I]TR[0O]\b|\bVITRO\b|\bV1TR0\b/ },
  { canon: "Toyota (OEM)", rx: /\bT[0O]Y[0O]TA\b|\bTOYOTA\b|\bT0Y0TA\b/ },
  { canon: "Ford (Carlite)", rx: /\bF[0O]RD\b|\bFORD\b/ },
  { canon: "GM", rx: /\bGENERAL\s*M[0O]T[0O]RS\b|\bGM\b|\b[6G]M\b/ },
  { canon: "VW (OEM)", rx: /\bV[0O]LKSWAGEN\b|\bVW\b|\bV0LKSWAGEN\b/ },
  { canon: "Hyundai (OEM)", rx: /\bHYUNDA[1I]\b|\bHYUNDAI\b/ },
  { canon: "Kia (OEM)", rx: /\bK[1I]A\b|\bKIA\b/ },
  { canon: "Xinyi", rx: /\bX[1I]NY[1I]\b|\bXINYI\b|\bX1NY1\b/ },
  { canon: "CSG", rx: /\bCSG\b|\bC[5S][6G]\b/ },
  { canon: "Benson", rx: /\bBENS[0O]N\b|\bBENSON\b/ },
  { canon: "Lucas", rx: /\bLUCAS\b|\bLUC4S\b|\bLUCA5\b/ }
];
function detectBrandFromText(rawText){
  if (!rawText || typeof rawText !== 'string') return null;
  const text = normBrandText(rawText);
  for (const {canon, rx} of BRAND_PATTERNS) if (rx.test(text)) return canon;
  const candidates = Array.from(new Set(text.split(' '))).filter(w => w.length>=3 && w.length<=15);
  const targets = ["PILKINGTON","SEKURIT","AGC","ASAHI","FUYAO","FYG","GUARDIAN","NORDGLASS","SPLINTEX","XYG","SICURSIV","CARLITE","VITRO","PPG","PROTEC","LAMILEX","VOLKSWAGEN","TOYOTA","HYUNDAI","KIA","FORD","GENERAL","MOTORS","VW","GM","XINYI","CSG","BENSON","SHATTERPRUFE","LUCAS"];
  let best = {canon:null, dist:3};
  for (const w of candidates){
    for (const t of targets){
      const d = editDistance(w, t);
      if (d < best.dist){
        const guess = guessCanonFromToken(t);
        if (guess) best = {canon: guess, dist:d};
      }
    }
  }
  return best.canon;
}
function editDistance(a,b){
  a=String(a); b=String(b);
  const dp = Array(a.length+1).fill(null).map(()=>Array(b.length+1).fill(0));
  for (let i=0;i<=a.length;i++) dp[i][0]=i;
  for (let j=0;j<=b.length;j++) dp[0][j]=j;
  for (let i=1;i<=a.length;i++){
    for (let j=1;j<=b.length;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[a.length][b.length];
}
function guessCanonFromToken(t){
  t=String(t).toUpperCase();
  if (t.includes('PILK')) return "Pilkington";
  if (t.includes('SEKURIT')||t.includes('SAINT')) return "Saint-Gobain Sekurit";
  if (t.includes('AGC')||t.includes('ASAHI')) return "AGC";
  if (t.includes('FUYAO')||t.includes('FYG')) return "Fuyao (FYG/FUYAO)";
  if (t.includes('GUARD')) return "Guardian";
  if (t.includes('NORD')) return "NordGlass";
  if (t.includes('SPLINTEX')) return "Splintex";
  if (t.includes('XYG')) return "XYG";
  if (t.includes('SICURSIV')) return "Sicursiv";
  if (t.includes('CARLITE')) return "Carlite";
  if (t.includes('MOPAR')) return "Mopar";
  if (t.includes('VITRO')) return "Vitro";
  if (t.includes('PPG')) return "PPG";
  if (t.includes('PROTEC')) return "Protec";
  if (t.includes('LAMILEX')) return "Lamilex";
  if (t.includes('SHATTERPRUFE')||t.includes('SHATTERPRUF')) return "Shatterprufe";
  if (t==='VW'||t.includes('VOLKSWAGEN')) return "VW (OEM)";
  if (t==='GM'||t.includes('GENERAL')||t.includes('MOTORS')) return "GM";
  if (t.includes('TOYOTA')) return "Toyota (OEM)";
  if (t.includes('HYUNDAI')) return "Hyundai (OEM)";
  if (t.includes('KIA')) return "Kia (OEM)";
  if (t.includes('FORD')) return "Ford (Carlite)";
  if (t.includes('XINYI')) return "Xinyi";
  if (t.includes('CSG')) return "CSG";
  if (t.includes('BENSON')) return "Benson";
  if (t.includes('LUCAS')) return "Lucas";
  return null;
}

// (opcional) reduzir imagem
async function downscaleImageToBase64(file, maxDim=1800, quality=0.75) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  return base64;
}

// ====== VEHICLE DETECTION ======
function normVehicleText(s){
  return String(s||"").toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s\-]/g,' ').replace(/\s+/g,' ').trim();
}
const VEHICLE_PATTERNS = [
  { canon:"BMW", rx:/\bBMW\b/ },
  { canon:"Mercedes-Benz", rx:/\bMERCEDES(?:[-\s]?BENZ)?\b|\bMERCEDES\b/ },
  { canon:"Audi", rx:/\bAUDI\b/ },
  { canon:"Volkswagen", rx:/\bVOLKSWAGEN\b|\bVW\b/ },
  { canon:"Seat", rx:/\bSEAT\b/ },
  { canon:"Škoda", rx:/\bSKODA\b/ },
  { canon:"Opel", rx:/\bOPEL\b|\bVAUXHALL\b/ },
  { canon:"Peugeot", rx:/\bPEUGEOT\b/ },
  { canon:"Citroën", rx:/\bCITRO[ËE]N\b|\bCITROEN\b/ },
  { canon:"Renault", rx:/\bRENAULT\b|\bRN\b/ },
  { canon:"Dacia", rx:/\bDACIA\b/ },
  { canon:"Fiat", rx:/\bFIAT\b/ },
  { canon:"Alfa Romeo", rx:/\bALFA\s*ROMEO\b/ },
  { canon:"Lancia", rx:/\bLANCIA\b/ },
  { canon:"Ford", rx:/\bFORD\b/ },
  { canon:"Toyota", rx:/\bTOYOTA\b/ },
  { canon:"Honda", rx:/\bHONDA\b/ },
  { canon:"Nissan", rx:/\bNISSAN\b/ },
  { canon:"Mazda", rx:/\bMAZDA\b/ },
  { canon:"Mitsubishi", rx:/\bMITSUBISHI\b/ },
  { canon:"Subaru", rx:/\bSUBARU\b/ },
  { canon:"Suzuki", rx:/\bSUZUKI\b/ },
  { canon:"Hyundai", rx:/\bHYUNDAI\b/ },
  { canon:"Kia", rx:/\bKIA\b/ },
  { canon:"Volvo", rx:/\bVOLVO\b/ },
  { canon:"Saab", rx:/\bSAAB\b/ },
  { canon:"Jaguar", rx:/\bJAGUAR\b/ },
  { canon:"Land Rover", rx:/\bLAND\s*ROVER\b/ },
  { canon:"Range Rover", rx:/\bRANGE\s*ROVER\b/ },
  { canon:"Mini", rx:/\bMINI\b/ },
  { canon:"Porsche", rx:/\bPORSCHE\b/ },
  { canon:"Smart", rx:/\bSMART\b/ },
  { canon:"Tesla", rx:/\bTESLA\b/ }
];
function detectVehicleFromText(rawText) {
  const text = normVehicleText(rawText);
  for (const { canon, rx } of VEHICLE_PATTERNS) if (rx.test(text)) return canon;
  const tokens = Array.from(new Set(text.split(' '))).filter(w => w.length>=3 && w.length<=12);
  const TARGETS = ["BMW","MERCEDES","MERCEDESBENZ","AUDI","VOLKSWAGEN","VW","SEAT","SKODA","OPEL","VAUXHALL","PEUGEOT","CITROEN","RENAULT","DACIA","FIAT","ALFAROMEO","LANCIA","FORD","TOYOTA","HONDA","NISSAN","MAZDA","MITSUBISHI","SUBARU","SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR","MINI","PORSCHE","SMART","TESLA"];
  let best = { canon:null, dist:2 };
  for (const w of tokens) for (const t of TARGETS) {
    const d = editDistance(w,t);
    if (d < best.dist) best = { canon: guessVehicleFromToken(t), dist:d };
  }
  return best.canon;
}
function guessVehicleFromToken(t){
  t=String(t).toUpperCase();
  if (t.includes("MERCEDES")) return "Mercedes-Benz";
  if (t==="VW"||t.includes("VOLKSWAGEN")) return "Volkswagen";
  if (t.includes("SKODA")) return "Škoda";
  if (t.includes("VAUXHALL")||t.includes("OPEL")) return "Opel";
  if (t.includes("PEUGEOT")) return "Peugeot";
  if (t.includes("CITROEN")) return "Citroën";
  if (t.includes("RENAULT")) return "Renault";
  if (t.includes("DACIA")) return "Dacia";
  if (t.includes("ALFAROMEO")) return "Alfa Romeo";
  if (t.includes("LANDROVER")) return "Land Rover";
  if (t.includes("RANGEROOVER")||t.includes("RANGERO")) return "Range Rover";
  const simple = ["BMW","AUDI","SEAT","FIAT","LANCIA","FORD","TOYOTA","HONDA","NISSAN","MAZDA","MITSUBISHI","SUBARU","SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR","MINI","PORSCHE","SMART","TESLA"];
  if (simple.includes(t)) return t[0] + t.slice(1).toLowerCase();
  return null;
}
// Marca + Modelo
function detectVehicleAndModelFromText(rawText) {
  const text = normVehicleText(rawText);
  const tokens = text.split(/\s+/);
  let brand = null, brandIdx = -1;
  for (let i=0;i<tokens.length && !brand;i++){
    for (const {canon,rx} of VEHICLE_PATTERNS){ if (rx.test(tokens[i])) { brand=canon; brandIdx=i; break; } }
  }
  if (!brand) return { full: '' };

  const BAD = new Set(['LOT','MATERIAL','NO','NR','HU','NORDGLASS','SEKURIT','PILKINGTON','AGC','ASAHI','XYG','FYG','GESTGLASS','BARCODE','FORNECEDOR','XINYI','PB1-U44','PB1','XUG']);
  const DOOR_OR_TRIM = /^(?:\dP|\dD|SW|TOURER|VAN|COMBI|ESTATE|COUPE|CABRIO)$/;
  const isGoodModel = (s) => !!s && !BAD.has(s) && !DOOR_OR_TRIM.test(s) && s.length<=12 && !/^\d{2,4}$/.test(s);
  const titleCase = (w) => /^[A-Z]{3,}$/.test(w) ? w[0]+w.slice(1).toLowerCase() : w;

  let models = [];
  for (let j=brandIdx+1; j<Math.min(brandIdx+5, tokens.length); j++){
    const tok = tokens[j].replace(/[^\w\-]/g,'');
    if (isGoodModel(tok)){
      models.push(titleCase(tok));
      if (j+1<tokens.length){
        const nxt = tokens[j+1].replace(/[^\w\-]/g,'');
        if (isGoodModel(nxt) && /^[A-Z\-]+$/.test(nxt)) models.push(titleCase(nxt));
      }
      break;
    }
  }
  return { full: brand + (models.length ? ' ' + models.join(' ') : '') };
}