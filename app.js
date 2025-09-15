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
// Procura de Eurocode (Na mesma linha)
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
  clearSearch.addEventListener('mouseover', () => { clearSearch.style.background = 'rgba(255,255,255,0.1)'; });
  clearSearch.addEventListener('mouseout', () => { clearSearch.style.background = 'none'; });
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
// Extração de Eurocodes (robusta)
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
  return unique.sort((a, b) => b.length - a.length).slice(0, 4);
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
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center;
    z-index: 10000; font-family: Arial, sans-serif;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;
    max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;

  content.innerHTML = `
    <h3 style="margin-top: 0; color: #333; text-align: center;">🔍 Selecionar Eurocode</h3>
    
    <p style="margin-bottom: 15px; color: #666;">
      <strong>Eurocodes encontrados:</strong> Clique no correto
    </p>
    <div id="eurocodeOptions" style="margin-bottom: 20px;">
      ${eurocodes.map((code) => `
        <button onclick="selectEurocode('${code}')" 
                style="display: block; width: 100%; padding: 12px; margin-bottom: 8px; 
                       background: #007acc; color: white; border: none; border-radius: 5px; 
                       cursor: pointer; font-size: 16px; font-weight: bold; letter-spacing: 1px;"
                onmouseover="this.style.background='#005a9e'" 
                onmouseout="this.style.background='#007acc'">
          ${code}
        </button>
      `).join('')}
    </div>
    <div style="display: flex; gap: 10px; justify-content: center;">
      <button onclick="selectEurocode('')" 
              style="padding: 10px 20px; background: #6c757d; color: white; border: none; 
                     border-radius: 5px; cursor: pointer;">Sem Eurocode</button>
      <button onclick="closeEurocodeModal()" 
              style="padding: 10px 20px; background: #dc3545; color: white; border: none; 
                     border-radius: 5px; cursor: pointer;">Cancelar</button>
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
} // <-- fecha showEurocodeValidationModal

// =========================
// Guardar na Base de Dados (brand + vehicle)
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
  if (!editOcrModal || !editOcrTextarea) {
    console.error('Modal de edição não encontrado');
    return;
  }

  currentEditingRow = row;
  editOcrTextarea.value = row.text || '';
  editOcrModal.style.display = 'flex';
  editOcrTextarea.focus();

  const handleSave = async () => {
    const newText = editOcrTextarea.value.trim();
    if (!newText) {
      showToast('Texto não pode estar vazio', 'error');
      return;
    }

    try {
      const newBrand = detectBrandFromText(newText) || '';
      const response = await fetch(UPDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          text: newText,
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
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      showToast('Erro ao atualizar: ' + error.message, 'error');
    }
  };

  const handleCancel = () => {
    editOcrModal.style.display = 'none';
    currentEditingRow = null;
    cleanup();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') handleCancel();
    else if (e.key === 'Enter' && e.ctrlKey) handleSave();
  };

  const handleBackdropClick = (e) => {
    if (e.target === editOcrModal) handleCancel();
  };

  function cleanup() {
    if (editOcrSave) editOcrSave.removeEventListener('click', handleSave);
    if (editOcrCancel) editOcrCancel.removeEventListener('click', handleCancel);
    if (editOcrClose) editOcrClose.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKeydown);
    editOcrModal.removeEventListener('click', handleBackdropClick);
  }

  if (editOcrSave) editOcrSave.addEventListener('click', handleSave);
  if (editOcrCancel) editOcrCancel.addEventListener('click', handleCancel);
  if (editOcrClose) editOcrClose.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeydown);
  editOcrModal.addEventListener('click', handleBackdropClick);
}
window.openEditOcrModal = openEditOcrModal;

// =========================
// Normalização (inclui brand/vehicle)
function normalizeRow(r){
  let timestamp = r.timestamp || r.datahora || r.created_at || r.createdAt || 
                  r.date || r.datetime || r.data || r.hora || r.created || 
                  r.updated_at || r.updatedAt || r.ts || '';

  if (!timestamp) timestamp = new Date().toLocaleString('pt-PT');
  if (typeof timestamp === 'number') timestamp = new Date(timestamp).toLocaleString('pt-PT');
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    try { timestamp = new Date(timestamp).toLocaleString('pt-PT'); } catch (e) {}
  }

  const text = r.text ?? r.ocr_text ?? r.ocr ?? r.texto ?? '';
  let brand = r.brand ?? '';
  
  if (!brand && text) {
    brand = detectBrandFromText(text) || '';
    console.log('Reprocessando marca para registo existente:', brand);
  }

  return {
    id:        r.id ?? r.rowId ?? r.uuid ?? r._id ?? null,
    timestamp: timestamp,
    text:      text,
    eurocode:  r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? r.codigo ?? '',
    filename:  r.filename ?? r.file ?? '',
    source:    r.source ?? r.origem ?? '',
    brand:     brand,
    vehicle:   r.vehicle ?? '',
    matricula: r.matricula ?? ''
  };
}

// =========================
// OCR
async function runOCR(imageBase64) {
  try {
    const res = await fetch(OCR_ENDPOINT, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ imageBase64 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.text || data.fullText || data.raw || '';
  } catch (err) {
    console.error('Erro no OCR:', err);
    showToast('Erro no OCR', 'error');
    return '';
  }
}

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
  }
}

// =========================
// Render
function renderTable() {
  if (!resultsBody) return;

  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToShow.length === 0) {
    const searchField = document.getElementById('searchField');
    const isSearching = searchField && searchField.value.trim();
    const message = isSearching
      ? 'Nenhum registo encontrado para esta procura'
      : 'Nenhum registo encontrado';
    resultsBody.innerHTML =
      `<tr><td colspan="8" style="text-align:center; padding:20px;">${message}</td></tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, index) => {
    const originalIndex = RESULTS.findIndex(r => r.id === row.id);
    const glassType = detectGlassType(row.eurocode);

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${row.timestamp}</td>
        <td style="font-weight: 600; color: #16a34a;">${glassType}</td>
        <td>${row.vehicle || '—'}</td>
        <td style="font-weight: bold; color: #007acc;">${row.eurocode}</td>
        <td>${row.brand || '—'}</td>
        <td>
          <input type="text" 
                 value="${row.matricula || ''}" 
                 placeholder="XX-XX-XX"
                 maxlength="8"
                 style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; text-align: center; text-transform: uppercase;"
                 onblur="updateMatricula(${row.id}, this.value)"
                 onkeypress="if(event.key==='Enter') this.blur()"
                 oninput="formatMatriculaInput(this)">
        </td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button onclick="openEditOcrModal(RESULTS[${originalIndex}])"
                    style="padding: 4px 8px; background: none; color: #666; border: none; cursor: pointer; border-radius: 3px;"
                    title="Editar texto OCR"
                    onmouseover="this.style.background='rgba(0,0,0,0.05)'; this.style.color='#333'" 
                    onmouseout="this.style.background='none'; this.style.color='#666'">
              ✏️ Editar
            </button>
            <button onclick="deleteRow(${row.id})"
                    style="padding: 4px 8px; background: none; color: #dc3545; border: none; cursor: pointer; border-radius: 3px;"
                    title="Eliminar registo"
                    onmouseover="this.style.background='rgba(220,53,69,0.1)'" 
                    onmouseout="this.style.background='none'">
              🗑️ Apagar
            </button>
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (response.ok) {
      showToast('Registo eliminado com sucesso!', 'success');
      await loadResults();
    } else {
      throw new Error('Erro ao eliminar');
    }
  } catch (error) {
    console.error('Erro ao eliminar:', error);
    showToast('Erro ao eliminar registo', 'error');
  }
}
window.deleteRow = deleteRow;

// =========================
// Processar imagem
async function processImage(file) {
  if (!file) return;

  setStatus(desktopStatus, 'A processar imagem...');
  setStatus(mobileStatus, 'A processar imagem...');

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const ocrText = await runOCR(base64);
    if (!ocrText) throw new Error('Nenhum texto encontrado na imagem');

    const vehicle = detectVehicleAndModelFromText(ocrText).full || '';

    setStatus(desktopStatus, 'Texto extraído! Selecione o Eurocode...', 'success');
    setStatus(mobileStatus, 'Texto extraído! Selecione o Eurocode...', 'success');

    showEurocodeValidationModal(ocrText, file.name, 'upload', vehicle);
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    showToast('Erro ao processar imagem: ' + error.message, 'error');
    setStatus(desktopStatus, 'Erro ao processar imagem', 'error');
    setStatus(mobileStatus, 'Erro ao processar imagem', 'error');
  }
}

// =========================
// Export CSV
function exportCSV() {
  const dataToExport = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToExport.length === 0) {
    showToast('Nenhum dado para exportar', 'error');
    return;
  }

  const headers = ['#', 'Data/Hora', 'Texto OCR', 'Eurocode', 'Ficheiro'];
  const csvContent = [
    headers.join(','),
    ...dataToExport.map((row, index) => [
      index + 1,
      `"${row.timestamp}"`,
      `"${(row.text || '').replace(/"/g, '""')}"`,
      `"${row.eurocode || ''}"`,
      `"${row.filename || ''}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `expressglass_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();

  showToast('CSV exportado com sucesso!', 'success');
}

// =========================
// Limpar tabela
async function clearTable() {
  if (!confirm('Tem a certeza que quer limpar todos os dados? Esta ação não pode ser desfeita.')) return;

  try {
    const response = await fetch('/.netlify/functions/clear-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      showToast('Tabela limpa com sucesso!', 'success');
      await loadResults();
    } else {
      throw new Error('Erro ao limpar tabela');
    }
  } catch (error) {
    console.error('Erro ao limpar tabela:', error);
    showToast('Erro ao limpar tabela', 'error');
  }
}

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
// Detecção de tipologia de vidro baseada na primeira letra do eurocode
function detectGlassType(eurocode) {
  if (!eurocode || typeof eurocode !== 'string') return '—';
  
  const code = eurocode.trim().toUpperCase();
  const match = code.match(/[A-Z]/);
  if (!match) return '—';
  
  const firstLetter = match[0];
  
  switch (firstLetter) {
    case 'A':
      return 'Parabrisas';
    case 'B':
      return 'Óculo';
    case 'L':
    case 'R':
      return 'Lateral';
    case 'T':
      return 'Teto';
    default:
      return '—';
  }
}

// ====== BRAND DETECTION (helpers) ======
function normBrandText(s){
  return String(s || "")
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .replace(/O/g,'0')
    .replace(/I/g,'1')
    .trim();
}

const BRAND_PATTERNS = [
  { canon: "AGC",                  rx: /\bA[GC]C\b|\bAG[0O]\b|\bASAH[1I]\b|\bASAH1\b/ },
  { canon: "Pilkington",           rx: /\bP[1I]LK[1I]NGT[0O]N\b|\bPILKINGTON\b|\bPILK\b|\bP1LK1NGT0N\b/ },
  { canon: "Saint-Gobain Sekurit", rx: /\bSEKUR[1I]T\b|\bSA[1I]NT\s*G[0O]BA[1I]N\b|\bSEKUR1T\b/ },
  { canon: "Guardian",             rx: /\bGUARD[1I]AN\b|\bGUARDIAN\b/ },
  { canon: "Fuyao (FYG/FUYAO)",    rx: /\bFUYA[0O]\b|\bFYG\b|\bFUYA0\b/ },
  { canon: "XYG",                  rx: /\bXYG\b|\bXY[6G]\b/ },
  { canon: "NordGlass",            rx: /\bN[0O]RDGLASS\b|\bNORDGLASS\b|\bN0RDGLASS\b/ },
  { canon: "Splintex",             rx: /\bSPL[1I]NTEX\b|\bSPLINTEX\b/ },
  { canon: "Sicursiv",             rx: /\bS[1I]CURS[1I]V\b|\bSICURSIV\b|\bS1CURS1V\b/ },
  { canon: "Carlite",              rx: /\bCARL[1I]TE\b|\bCARLITE\b/ },
  { canon: "PPG",                  rx: /\bPPG\b|\bPP[6G]\b/ },
  { canon: "Mopar",                rx: /\bM[0O]PAR\b|\bMOPAR\b/ },
  { canon: "Shatterprufe",         rx: /\bSHATTERPRUFE\b|\bSHATTERPRUF\b/ },
  { canon: "Protec",               rx: /\bPR[0O]TEC\b|\bPROTEC\b/ },
  { canon: "Lamilex",              rx: /\bLAM[1I][1I]LEX\b|\bLAMILEX\b/ },
  { canon: "Vitro",                rx: /\bV[1I]TR[0O]\b|\bVITRO\b|\bV1TR0\b/ },
  { canon: "Toyota (OEM)",         rx: /\bT[0O]Y[0O]TA\b|\bTOYOTA\b|\bT0Y0TA\b/ },
  { canon: "Ford (Carlite)",       rx: /\bF[0O]RD\b|\bFORD\b/ },
  { canon: "GM",                   rx: /\bGENERAL\s*M[0O]T[0O]RS\b|\bGM\b|\b[6G]M\b/ },
  { canon: "VW (OEM)",             rx: /\bV[0O]LKSWAGEN\b|\bVW\b|\bV0LKSWAGEN\b/ },
  { canon: "Hyundai (OEM)",        rx: /\bHYUNDA[1I]\b|\bHYUNDAI\b/ },
  { canon: "Kia (OEM)",            rx: /\bK[1I]A\b|\bKIA\b/ },
  { canon: "Xinyi",                rx: /\bX[1I]NY[1I]\b|\bXINYI\b|\bX1NY1\b/ },
  { canon: "CSG",                  rx: /\bCSG\b|\bC[5S][6G]\b/ },
  { canon: "Benson",               rx: /\bBENS[0O]N\b|\bBENSON\b/ },
  { canon: "Lucas",                rx: /\bLUCAS\b|\bLUC4S\b|\bLUCA5\b/ },
  { canon: "Scania",               rx: /\bSCANIA\b/ },
  { canon: "MAN",                  rx: /\bMAN\b/ },
  { canon: "DAF",                  rx: /\bDAF\b/ },
  { canon: "Volvo",                rx: /\bVOLVO\b/ }
];

function detectBrandFromText(rawText){
  if (!rawText || typeof rawText !== 'string') return null;
  const text = normBrandText(rawText);
  for (const {canon, rx} of BRAND_PATTERNS) {
    if (rx.test(text)) return canon;
  }
  const candidates = Array.from(new Set(text.split(' '))).filter(w => w.length>=3 && w.length<=15);
  const targets = [
    "PILKINGTON","SEKURIT","AGC","ASAHI","FUYAO","FYG","GUARDIAN","NORDGLASS","SPLINTEX","XYG",
    "SICURSIV","CARLITE","MOPAR","VITRO","PPG","PROTEC","LAMILEX","VOLKSWAGEN","TOYOTA","HYUNDAI",
    "KIA","FORD","GENERAL","MOTORS","VW","GM","XINYI","CSG","BENSON","SHATTERPRUFE","LUCAS",
    "SCANIA","MAN","DAF","VOLVO"
  ];
  let best = {canon:null, dist:3};
  for (const w of candidates){
    for (const t of targets){
      const d = editDistance(w, t);
      if (d < best.dist){
        const guessed = guessCanonFromToken(t);
        if (guessed) best = {canon: guessed, dist:d};
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
  t = String(t).toUpperCase();
  if (t.includes('PILK')) return "Pilkington";
  if (t.includes('SEKURIT') || t.includes('SAINT')) return "Saint-Gobain Sekurit";
  if (t.includes('AGC') || t.includes('ASAHI')) return "AGC";
  if (t.includes('FUYAO') || t.includes('FYG')) return "Fuyao (FYG/FUYAO)";
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
  if (t.includes('SHATTERPRUFE') || t.includes('SHATTERPRUF')) return "Shatterprufe";
  if (t === 'VW' || t.includes('VOLKSWAGEN')) return "VW (OEM)";
  if (t === 'GM' || t.includes('GENERAL') || t.includes('MOTORS')) return "GM";
  if (t.includes('TOYOTA')) return "Toyota (OEM)";
  if (t.includes('HYUNDAI')) return "Hyundai (OEM)";
  if (t.includes('KIA')) return "Kia (OEM)";
  if (t.includes('FORD')) return "Ford (Carlite)";
  if (t.includes('XINYI')) return "Xinyi";
  if (t.includes('CSG')) return "CSG";
  if (t.includes('BENSON')) return "Benson";
  if (t.includes('LUCAS')) return "Lucas";
  if (t.includes('SCANIA')) return "Scania";
  if (t === 'MAN') return "MAN";
  if (t.includes('DAF')) return "DAF";
  if (t.includes('VOLVO')) return "Volvo";
  return null;
}

// ====== VEHICLE (car brand) DETECTION ======
function normVehicleText(s){
  return String(s || "")
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s\-]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

const VEHICLE_PATTERNS = [
  { canon:"BMW", rx:/\bBMW\b|\bBM\b/ },
  { canon: "Mercedes-Benz", rx: /\bMERCEDES(?:[-\s]?BENZ)?\b|\bMERCEDES\b|\bMB\b/ },
  { canon: "Audi",          rx: /\bAUDI\b/ },
  { canon: "Volkswagen",    rx: /\bVOLKSWAGEN\b|\bVW\b/ },
  { canon: "Seat",          rx: /\bSEAT\b/ },
  { canon: "Jeep",          rx: /\bJEEP\b/ },
  { canon: "Škoda",         rx: /\bSKODA\b/ },
  { canon: "Opel",          rx: /\bOPEL\b|\bVAUXHALL\b|\bOP\b/ },
  { canon: "Peugeot",       rx: /\bPEUGEOT\b/ },
  { canon: "Citroën",       rx: /\bCITRO[ËE]N\b|\bCITROEN\b/ },
  { canon: "Renault",       rx: /\bRENAULT\b|\bRN\b/ },
  { canon: "Dacia",         rx: /\bDACIA\b/ },
  { canon: "Fiat",          rx: /\bFIAT\b/ },
  { canon: "Alfa Romeo",    rx: /\bALFA\s*ROMEO\b/ },
  { canon: "Lancia",        rx: /\bLANCIA\b/ },
  { canon: "Ford",          rx: /\bFORD\b/ },
  { canon: "Toyota",        rx: /\bTOYOTA\b/ },
  { canon: "Honda",         rx: /\bHONDA\b/ },
  { canon: "Nissan",        rx: /\bNISSAN\b/ },
  { canon: "Mazda",         rx: /\bMAZDA\b/ },
  { canon: "Mitsubishi",    rx: /\bMITSUBISHI\b/ },
  { canon: "Subaru",        rx: /\bSUBARU\b/ },
  { canon: "Suzuki",        rx: /\bSUZUKI\b/ },
  { canon: "Hyundai",       rx: /\bHYUNDAI\b/ },
  { canon: "Kia",           rx: /\bKIA\b/ },
  { canon: "Volvo",         rx: /\bVOLVO\b/ },
  { canon: "Saab",          rx: /\bSAAB\b/ },
  { canon: "Jaguar",        rx: /\bJAGUAR\b/ },
  { canon: "Land Rover",    rx: /\bLAND\s*ROVER\b/ },
  { canon: "Land Rover",    rx: /\bROVER\b/ },
  { canon: "Range Rover",   rx: /\bRANGE\s*ROVER\b/ },
  { canon: "Mini",          rx: /\bMINI\b/ },
  { canon: "Porsche",       rx: /\bPORSCHE\b/ },
  { canon: "Smart",         rx: /\bSMART\b/ },
  { canon: "Tesla",         rx: /\bTESLA\b/ },
  { canon: "Scania",        rx: /\bSCANIA\b/ },
  { canon: "MAN",           rx: /\bMAN\b/ },
  { canon: "DAF",           rx: /\bDAF\b/ }
];

function detectVehicleFromText(rawText) {
  const text = normVehicleText(rawText);
  for (const { canon, rx } of VEHICLE_PATTERNS) if (rx.test(text)) return canon;
  const tokens = Array.from(new Set(text.split(' '))).filter(w => w.length >= 3 && w.length <= 12);
  const TARGETS = [
    "BMW","MERCEDES","MERCEDESBENZ","AUDI","VOLKSWAGEN","VW","SEAT","SKODA",
    "OPEL","VAUXHALL","PEUGEOT","CITROEN","RENAULT","DACIA","FIAT","ALFAROMEO",
    "LANCIA","FORD","TOYOTA","HONDA","NISSAN","MAZDA","MITSUBISHI","SUBARU",
    "SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR","LANDROVER","RANGEROOVER",
    "MINI","PORSCHE","SMART","TESLA","SCANIA","MAN","DAF"
  ];
  let best = { canon: null, dist: 2 };
  for (const w of tokens) {
    for (const t of TARGETS) {
      const d = editDistance(w, t);
      if (d < best.dist) best = { canon: guessVehicleFromToken(t), dist: d };
    }
  }
  return best.canon;
}

function guessVehicleFromToken(t) {
  t = String(t).toUpperCase();
  if (t.includes("MERCEDES")) return "Mercedes-Benz";
  if (t === "VW" || t.includes("VOLKSWAGEN")) return "Volkswagen";
  if (t.includes("SKODA")) return "Škoda";
  if (t.includes("VAUXHALL") || t.includes("OPEL")) return "Opel";
  if (t.includes("PEUGEOT")) return "Peugeot";
  if (t.includes("CITROEN")) return "Citroën";
  if (t.includes("RENAULT")) return "Renault";
  if (t.includes("BM")) return "BMW";
  if (t.includes("DACIA")) return "Dacia";
  if (t.includes("ALFAROMEO")) return "Alfa Romeo";
  if (t.includes("LANDROVER")) return "Land Rover";
  if (t.includes("RANGEROOVER") || t.includes("RANGERO")) return "Range Rover";
  if (t.includes("SCANIA")) return "Scania";
  if (t === "MAN") return "MAN";
  if (t.includes("DAF")) return "DAF";
  const simple = [
    "BMW","AUDI","SEAT","FIAT","LANCIA","FORD","TOYOTA","HONDA","NISSAN","MAZDA",
    "MITSUBISHI","SUBARU","SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR","MINI",
    "PORSCHE","SMART","TESLA"
  ];
  if (simple.includes(t)) return t[0] + t.slice(1).toLowerCase();
  return null;
}

function detectVehicleAndModelFromText(rawText) {
  const text = normVehicleText(rawText);
  const tokens = text.split(/\s+/);
  let brand = null;
  let brandIdx = -1;
  for (let i = 0; i < tokens.length && !brand; i++) {
    for (const { canon, rx } of VEHICLE_PATTERNS) {
      if (rx.test(tokens[i])) { brand = canon; brandIdx = i; break; }
    }
  }
  if (!brand) return { full: '' };
  const BAD = new Set([
    'LOT','MATERIAL','NO','NR','HU','NORDGLASS','SEKURIT','PILKINGTON','AGC','ASAHI',
    'XYG','FYG','GESTGLASS','BARCODE','FORNECEDOR','XINYI','PB1-U44','PB1','XUG'
  ]);
  const DOOR_OR_TRIM = /^(?:\dP|\dD|SW|TOURER|VAN|COMBI|ESTATE|COUPE|CABRIO)$/;
  const isGoodModel = (s) =>
    !!s && !BAD.has(s) && !DOOR_OR_TRIM.test(s) && s.length <= 12 && !/^\d{2,4}$/.test(s);
  const titleCase = (w) => /^[A-Z]{3,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w;
  let models = [];
  for (let j = brandIdx + 1; j < Math.min(brandIdx + 5, tokens.length); j++) {
    const tok = tokens[j].replace(/[^\w\-]/g, '');
    if (isGoodModel(tok)) {
      models.push(titleCase(tok));
      if (j + 1 < tokens.length) {
        const nxt = tokens[j + 1].replace(/[^\w\-]/g, '');
        if (isGoodModel(nxt) && /^[A-Z\-]+$/.test(nxt)) models.push(titleCase(nxt));
      }
      break;
    }
  }
  return { full: brand + (models.length ? ' ' + models.join(' ') : '') };
}


// =========================
// FUNÇÕES DE IMPRESSÃO
// =========================

// Abrir modal de impressão
function openPrintModal() {
  const modal = document.getElementById('printModal');
  if (!modal) return;
  
  // Definir data padrão como hoje
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('printDateFrom').value = today;
  document.getElementById('printDateTo').value = today;
  
  // Atualizar preview
  updatePrintPreview();
  
  // Mostrar modal
  modal.classList.add('show');
}

// Fechar modal de impressão
function closePrintModal() {
  const modal = document.getElementById('printModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Definir intervalos de datas rápidos
function setPrintDateRange(range, buttonElement) {
  const today = new Date();
  const fromInput = document.getElementById('printDateFrom');
  const toInput = document.getElementById('printDateTo');
  
  let fromDate, toDate;
  
  switch (range) {
    case 'today':
      fromDate = toDate = today;
      break;
      
    case 'week':
      // Início da semana (segunda-feira)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1);
      fromDate = startOfWeek;
      toDate = today;
      break;
      
    case 'month':
      // Início do mês
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = startOfMonth;
      toDate = today;
      break;
      
    case 'all':
      // Todos os registos (desde o primeiro registo)
      if (RESULTS.length > 0) {
        const oldestRecord = RESULTS[RESULTS.length - 1];
        fromDate = new Date(oldestRecord.created_at || oldestRecord.timestamp);
      } else {
        fromDate = today;
      }
      toDate = today;
      break;
      
    default:
      fromDate = toDate = today;
  }
  
  fromInput.value = fromDate.toISOString().split('T')[0];
  toInput.value = toDate.toISOString().split('T')[0];
  
  // Atualizar botões ativos
  document.querySelectorAll('.print-quick-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Se buttonElement foi passado, usar ele, senão tentar event.target
  const targetButton = buttonElement || (typeof event !== 'undefined' ? event.target : null);
  if (targetButton) {
    targetButton.classList.add('active');
  }
  
  // Atualizar preview
  updatePrintPreview();
}

// Atualizar preview de impressão
function updatePrintPreview() {
  const fromDate = document.getElementById('printDateFrom').value;
  const toDate = document.getElementById('printDateTo').value;
  const previewElement = document.getElementById('printPreviewCount');
  const printButton = document.getElementById('printConfirm');
  
  if (!fromDate || !toDate) {
    previewElement.textContent = 'Selecione as datas inicial e final';
    previewElement.className = 'print-preview-count';
    printButton.disabled = true;
    return;
  }
  
  // Filtrar registos por data
  const filteredRecords = getRecordsInDateRange(fromDate, toDate);
  
  if (filteredRecords.length === 0) {
    previewElement.textContent = 'Nenhum registo encontrado no período selecionado';
    previewElement.className = 'print-preview-count';
    printButton.disabled = true;
  } else {
    previewElement.textContent = `${filteredRecords.length} registo${filteredRecords.length !== 1 ? 's' : ''} encontrado${filteredRecords.length !== 1 ? 's' : ''} para impressão`;
    previewElement.className = 'print-preview-count has-data';
    printButton.disabled = false;
  }
}

// Obter registos num intervalo de datas
function getRecordsInDateRange(fromDate, toDate) {
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T23:59:59');
  
  return RESULTS.filter(record => {
    // Tentar usar created_at primeiro, depois timestamp como fallback
    let recordDate;
    if (record.created_at) {
      recordDate = new Date(record.created_at);
    } else if (record.timestamp) {
      // Se timestamp está no formato "DD/MM/YYYY, HH:MM:SS"
      const [datePart, timePart] = record.timestamp.split(', ');
      const [day, month, year] = datePart.split('/');
      recordDate = new Date(`${year}-${month}-${day}T${timePart || '00:00:00'}`);
    } else {
      return false; // Sem data válida
    }
    
    return recordDate >= from && recordDate <= to;
  });
}

// Executar impressão
function executePrint() {
  const fromDate = document.getElementById('printDateFrom').value;
  const toDate = document.getElementById('printDateTo').value;
  
  if (!fromDate || !toDate) {
    showToast('Selecione as datas para impressão', 'error');
    return;
  }
  
  const recordsToPrint = getRecordsInDateRange(fromDate, toDate);
  
  if (recordsToPrint.length === 0) {
    showToast('Nenhum registo encontrado no período selecionado', 'error');
    return;
  }
  
  // Gerar conteúdo de impressão
  const printContent = generatePrintContent(recordsToPrint, fromDate, toDate);
  
  // Criar janela de impressão
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Aguardar carregamento e imprimir
  printWindow.onload = function() {
    printWindow.print();
    printWindow.close();
  };
  
  // Fechar modal
  closePrintModal();
  
  showToast(`${recordsToPrint.length} registo${recordsToPrint.length !== 1 ? 's' : ''} enviado${recordsToPrint.length !== 1 ? 's' : ''} para impressão`, 'success');
}

// Gerar conteúdo HTML para impressão
function generatePrintContent(records, fromDate, toDate) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-PT');
  };
  
  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('pt-PT');
  };
  
  const periodText = fromDate === toDate 
    ? `Dia ${formatDate(fromDate)}`
    : `Período de ${formatDate(fromDate)} a ${formatDate(toDate)}`;
  
  return `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>ExpressGlass - Relatório de Receção</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .print-header h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .print-header .print-period {
          margin: 10px 0 0 0;
          font-size: 14px;
          color: #666;
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .print-table th,
        .print-table td {
          border: 1px solid #333;
          padding: 6px 4px;
          text-align: left;
          vertical-align: top;
        }
        .print-table th {
          background: #f0f0f0;
          font-weight: bold;
          font-size: 10px;
        }
        .print-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        .print-footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
        .eurocode {
          font-family: 'Courier New', monospace;
          font-weight: bold;
          color: #007acc;
        }
        .glass-type {
          font-weight: bold;
          color: #16a34a;
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>EXPRESSGLASS - Receção de Material</h1>
        <div class="print-period">${periodText}</div>
      </div>
      
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th style="width: 120px;">Data/Hora</th>
            <th style="width: 80px;">Tipo</th>
            <th style="width: 100px;">Veículo</th>
            <th style="width: 120px;">Eurocode</th>
            <th style="width: 80px;">Marca</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((record, index) => {
            const glassType = detectGlassType(record.eurocode);
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${formatDateTime(record.created_at)}</td>
                <td class="glass-type">${glassType}</td>
                <td>${record.vehicle || '—'}</td>
                <td class="eurocode">${record.eurocode || '—'}</td>
                <td>${record.brand || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="print-footer">
        <div>Total de registos: ${records.length}</div>
        <div>Relatório gerado em ${formatDateTime(new Date().toISOString())}</div>
        <div>ExpressGlass - Sistema de Receção de Material</div>
      </div>
    </body>
    </html>
  `;
}

// Event listeners para o modal de impressão
document.addEventListener('DOMContentLoaded', function() {
  // Fechar modal
  const printModalClose = document.getElementById('printModalClose');
  const printCancel = document.getElementById('printCancel');
  const printConfirm = document.getElementById('printConfirm');
  const printModal = document.getElementById('printModal');
  
  if (printModalClose) {
    printModalClose.addEventListener('click', closePrintModal);
  }
  
  if (printCancel) {
    printCancel.addEventListener('click', closePrintModal);
  }
  
  if (printConfirm) {
    printConfirm.addEventListener('click', executePrint);
  }
  
  // Fechar modal ao clicar fora
  if (printModal) {
    printModal.addEventListener('click', (e) => {
      if (e.target === printModal) {
        closePrintModal();
      }
    });
  }
  
  // Atualizar preview quando as datas mudarem
  const printDateFrom = document.getElementById('printDateFrom');
  const printDateTo = document.getElementById('printDateTo');
  
  if (printDateFrom) {
    printDateFrom.addEventListener('change', updatePrintPreview);
  }
  
  if (printDateTo) {
    printDateTo.addEventListener('change', updatePrintPreview);
  }
});



// =========================
// FUNÇÕES DE MATRÍCULA
// =========================

// Formatar input de matrícula em tempo real
function formatMatriculaInput(input) {
  let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Aplicar formato XX-XX-XX
  if (value.length > 2) {
    value = value.substring(0, 2) + '-' + value.substring(2);
  }
  if (value.length > 5) {
    value = value.substring(0, 5) + '-' + value.substring(5, 7);
  }
  
  input.value = value;
}

// Validar formato de matrícula
function isValidMatricula(matricula) {
  if (!matricula || matricula.trim() === '') return true; // Facultativo
  
  const pattern = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/;
  return pattern.test(matricula);
}

// Atualizar matrícula de um registo
async function updateMatricula(recordId, matricula) {
  try {
    console.log('🔧 updateMatricula chamada:', { recordId, matricula });
    console.log('🔧 Array RESULTS tem', RESULTS.length, 'registos');
    console.log('🔧 IDs disponíveis:', RESULTS.map(r => r.id));
    
    // Formatar matrícula
    matricula = matricula.toUpperCase().trim();
    console.log('🔧 Matrícula formatada:', matricula);
    
    // Validar formato se não estiver vazio
    if (matricula && !isValidMatricula(matricula)) {
      console.log('❌ Formato inválido:', matricula);
      showToast('Formato de matrícula inválido. Use XX-XX-XX', 'error');
      renderTable(); // Restaurar valor anterior
      return;
    }
    
    // Encontrar registo local
    const recordIndex = RESULTS.findIndex(r => parseInt(r.id) === parseInt(recordId));
    console.log('🔧 Procurando registo com ID:', recordId);
    console.log('🔧 Índice encontrado:', recordIndex);
    
    if (recordIndex === -1) {
      console.log('❌ Registo não encontrado:', recordId);
      console.log('❌ Registos disponíveis:', RESULTS);
      showToast('Registo não encontrado', 'error');
      return;
    }
    
    console.log('🔧 Registo encontrado no índice:', recordIndex);
    console.log('🔧 Dados do registo:', RESULTS[recordIndex]);
    
    // Atualizar localmente primeiro
    RESULTS[recordIndex].matricula = matricula;
    console.log('🔧 Atualizado localmente:', RESULTS[recordIndex]);
    
    // Enviar para servidor
    console.log('🔧 Enviando para servidor...');
    const response = await fetch('/.netlify/functions/update-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        id: recordId,
        matricula: matricula
      })
    });
    
    console.log('🔧 Resposta do servidor:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log('❌ Erro do servidor:', errorData);
      throw new Error(`Erro ${response.status}: ${errorData.error || 'Erro ao atualizar matrícula'}`);
    }
    
    const result = await response.json();
    console.log('✅ Sucesso do servidor:', result);
    
    // Mostrar sucesso
    if (matricula) {
      showToast(`Matrícula ${matricula} guardada`, 'success');
    } else {
      showToast('Matrícula removida', 'success');
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar matrícula:', error);
    showToast(`Erro ao guardar matrícula: ${error.message}`, 'error');
    
    // Restaurar valor anterior em caso de erro
    renderTable();
  }
}


// =========================
// FUNÇÕES DE IMPRESSÃO MELHORADAS
// =========================

// Abrir modal de impressão
function openPrintModal() {
  const modal = document.getElementById('printModal');
  if (!modal) return;
  
  // Definir data de hoje como padrão
  const today = new Date().toISOString().split('T')[0];
  const fromInput = document.getElementById('printDateFrom');
  const toInput = document.getElementById('printDateTo');
  
  if (fromInput) fromInput.value = today;
  if (toInput) toInput.value = today;
  
  // Atualizar preview
  updatePrintPreview();
  
  // Mostrar modal
  modal.classList.add('show');
}

// Fechar modal de impressão
function closePrintModal() {
  const modal = document.getElementById('printModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Atualizar preview de impressão
function updatePrintPreview() {
  const fromDate = document.getElementById('printDateFrom').value;
  const toDate = document.getElementById('printDateTo').value;
  const previewElement = document.getElementById('printPreviewCount');
  const printButton = document.getElementById('printConfirm');
  
  if (!fromDate || !toDate) {
    previewElement.textContent = 'Selecione as datas inicial e final';
    previewElement.className = 'print-preview-count';
    printButton.disabled = true;
    return;
  }
  
  // Filtrar registos por data
  const filteredRecords = getRecordsInDateRange(fromDate, toDate);
  
  if (filteredRecords.length === 0) {
    previewElement.textContent = 'Nenhum registo encontrado no período selecionado';
    previewElement.className = 'print-preview-count';
    printButton.disabled = true;
  } else {
    previewElement.textContent = `${filteredRecords.length} registo${filteredRecords.length !== 1 ? 's' : ''} encontrado${filteredRecords.length !== 1 ? 's' : ''} para impressão`;
    previewElement.className = 'print-preview-count has-data';
    printButton.disabled = false;
  }
}

// Obter registos num intervalo de datas - VERSÃO MELHORADA
function getRecordsInDateRange(fromDate, toDate) {
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T23:59:59');
  
  console.log('🔍 Filtrar registos entre:', from.toLocaleDateString('pt-PT'), 'e', to.toLocaleDateString('pt-PT'));
  console.log('📊 Total de registos disponíveis:', RESULTS.length);
  
  const filtered = RESULTS.filter(record => {
    // Tentar usar created_at primeiro, depois timestamp como fallback
    let recordDate;
    
    if (record.created_at) {
      recordDate = new Date(record.created_at);
    } else if (record.timestamp) {
      // Se timestamp está no formato "DD/MM/YYYY, HH:MM:SS"
      const timestampStr = record.timestamp.toString();
      if (timestampStr.includes('/')) {
        const [datePart, timePart] = timestampStr.split(', ');
        const [day, month, year] = datePart.split('/');
        recordDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart || '00:00:00'}`);
      } else {
        // Tentar parsing direto
        recordDate = new Date(record.timestamp);
      }
    } else {
      console.log('⚠️ Registo sem data válida:', record);
      return false; // Sem data válida
    }
    
    if (isNaN(recordDate.getTime())) {
      console.log('❌ Data inválida para registo:', record);
      return false;
    }
    
    const isInRange = recordDate >= from && recordDate <= to;
    console.log(`📅 Registo ${record.id}: ${recordDate.toLocaleDateString('pt-PT')} - ${isInRange ? '✅ Incluído' : '❌ Excluído'}`);
    
    return isInRange;
  });
  
  console.log('✅ Registos filtrados:', filtered.length);
  return filtered;
}

// Executar impressão
function executePrint() {
  const fromDate = document.getElementById('printDateFrom').value;
  const toDate = document.getElementById('printDateTo').value;
  
  if (!fromDate || !toDate) {
    showToast('Selecione as datas para impressão', 'error');
    return;
  }
  
  const recordsToPrint = getRecordsInDateRange(fromDate, toDate);
  
  if (recordsToPrint.length === 0) {
    showToast('Nenhum registo encontrado no período selecionado', 'error');
    return;
  }
  
  // Gerar conteúdo de impressão
  const printContent = generatePrintContent(recordsToPrint, fromDate, toDate);
  
  // Criar janela de impressão
  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Aguardar carregamento e imprimir
  printWindow.onload = function() {
    printWindow.print();
    printWindow.close();
  };
  
  // Fechar modal
  closePrintModal();
  
  showToast(`${recordsToPrint.length} registo${recordsToPrint.length !== 1 ? 's' : ''} enviado${recordsToPrint.length !== 1 ? 's' : ''} para impressão`, 'success');
}

// Gerar conteúdo HTML para impressão
function generatePrintContent(records, fromDate, toDate) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-PT');
  };
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    
    // Se for timestamp no formato DD/MM/YYYY, HH:MM:SS
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const [datePart, timePart] = dateStr.split(', ');
      if (datePart && timePart) {
        const [day, month, year] = datePart.split('/');
        const formattedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`);
        return formattedDate.toLocaleString('pt-PT');
      }
    }
    
    // Parsing normal para ISO dates
    return new Date(dateStr).toLocaleString('pt-PT');
  };
  
  const periodText = fromDate === toDate 
    ? `Dia ${formatDate(fromDate)}`
    : `Período de ${formatDate(fromDate)} a ${formatDate(toDate)}`;
  
  // Obter email do utilizador
  let userEmail = 'utilizador@expressglass.pt'; // fallback
  
  // Tentar obter email de várias fontes
  if (window.authManager && window.authManager.user && window.authManager.user.email) {
    userEmail = window.authManager.user.email;
  } else if (localStorage.getItem('user')) {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      if (userData && userData.email) {
        userEmail = userData.email;
      }
    } catch (e) {
      console.log('Erro ao obter email do localStorage:', e);
    }
  }
  
  console.log('Email do utilizador para impressão:', userEmail);
  
  return `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>ExpressGlass - Relatório de Receção</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .print-header h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .print-header .print-period {
          margin: 10px 0 0 0;
          font-size: 14px;
          color: #666;
        }
        .print-header .print-user {
          margin: 5px 0 0 0;
          font-size: 12px;
          color: #888;
          font-style: italic;
        }
        .print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .print-table th,
        .print-table td {
          border: 1px solid #333;
          padding: 6px 4px;
          text-align: left;
          vertical-align: top;
        }
        .print-table th {
          background: #f0f0f0;
          font-weight: bold;
          font-size: 10px;
        }
        .print-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        .print-footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
        .eurocode {
          font-family: 'Courier New', monospace;
          font-weight: bold;
          color: #007acc;
        }
        .glass-type {
          font-weight: bold;
          color: #16a34a;
        }
        .matricula {
          font-family: 'Courier New', monospace;
          font-weight: bold;
          color: #059669;
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <h1>EXPRESSGLASS - Receção de Material</h1>
        <div class="print-period">${periodText}</div>
        <div class="print-user">Utilizador: ${userEmail}</div>
      </div>
      
      <table class="print-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th style="width: 120px;">Data/Hora</th>
            <th style="width: 80px;">Tipo</th>
            <th style="width: 100px;">Veículo</th>
            <th style="width: 120px;">Eurocode</th>
            <th style="width: 80px;">Marca</th>
            <th style="width: 80px;">Matrícula</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((record, index) => {
            const glassType = detectGlassType(record.eurocode);
            const recordDateTime = record.created_at || record.timestamp;
            console.log('Formatando data para impressão:', recordDateTime);
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${formatDateTime(recordDateTime)}</td>
                <td class="glass-type">${glassType}</td>
                <td>${record.vehicle || '—'}</td>
                <td class="eurocode">${record.eurocode || '—'}</td>
                <td>${record.brand || '—'}</td>
                <td class="matricula">${record.matricula || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="print-footer">
        <div>Total de registos: ${records.length}</div>
        <div>Relatório gerado em ${formatDateTime(new Date().toISOString())}</div>
        <div>ExpressGlass - Sistema de Receção de Material</div>
      </div>
    </body>
    </html>
  `;
}

// Event listeners para o modal de impressão
document.addEventListener('DOMContentLoaded', function() {
  // Fechar modal
  const printModalClose = document.getElementById('printModalClose');
  const printCancel = document.getElementById('printCancel');
  const printConfirm = document.getElementById('printConfirm');
  const printModal = document.getElementById('printModal');
  
  if (printModalClose) {
    printModalClose.addEventListener('click', closePrintModal);
  }
  
  if (printCancel) {
    printCancel.addEventListener('click', closePrintModal);
  }
  
  if (printConfirm) {
    printConfirm.addEventListener('click', executePrint);
  }
  
  // Fechar modal ao clicar fora
  if (printModal) {
    printModal.addEventListener('click', (e) => {
      if (e.target === printModal) {
        closePrintModal();
      }
    });
  }
  
  // Atualizar preview quando as datas mudarem
  const printDateFrom = document.getElementById('printDateFrom');
  const printDateTo = document.getElementById('printDateTo');
  
  if (printDateFrom) {
    printDateFrom.addEventListener('change', updatePrintPreview);
  }
  
  if (printDateTo) {
    printDateTo.addEventListener('change', updatePrintPreview);
  }
});

