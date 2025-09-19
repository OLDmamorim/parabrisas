// APP.JS (BD + Validação de Eurocode + CSS Forçado para Texto Pequeno)
// =========================
// VERSÃO: 19/09/2025 00:27 - PERSISTÊNCIA NA BASE DE DADOS IMPLEMENTADA
// CORREÇÃO: Problema da loja SM não ser gravada na BD - RESOLVIDO
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
    // enviar em vários cabeçalhos para maximizar compatibilidade
    opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    opts.headers['x-api-key'] = token;
  }

  // tenta pedido
  let res = await fetch(url, opts);
  if (res.status === 401 || res.status === 403) {
    // pedir token e repetir uma vez
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
    matricula: r.matricula ?? '',
    loja:      r.loja ?? 'LOJA',
    observacoes: r.observacoes ?? ''
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
  console.log('renderTable chamada - versão com campos editáveis v7');
  if (!resultsBody) return;

  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToShow.length === 0) {
    resultsBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: #666;">Nenhum registo encontrado</td></tr>';
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, index) => {
    const originalIndex = RESULTS.findIndex(r => r.id === row.id);
    const glassType = detectGlassType(row.eurocode);
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="font-size: 11px;">${row.timestamp}</td>
        <td style="font-weight: bold; color: #16a34a;">${glassType}</td>
        <td style="font-weight: bold;">${row.vehicle || '—'}</td>
        <td style="font-family: 'Courier New', monospace; font-weight: bold; color: #007acc;">${row.eurocode || '—'}</td>
        <td style="font-weight: bold; color: #dc2626;">${row.brand || '—'}</td>
        <td>
          <input type="text" 
                 value="${row.matricula || ''}"
                 placeholder="XX-XX-XX"
                 style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; font-family: 'Courier New', monospace; font-weight: bold;"
                 oninput="formatMatriculaInput(this)"
                 onblur="updateMatricula(${row.id}, this.value)"
                 onkeypress="if(event.key==='Enter') this.blur()">
        </td>
        <td>
          <select onchange="updateLoja(${row.id}, this.value)" 
                  style="width: 60px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; font-weight: bold;">
            <option value="LOJA" ${row.loja === 'LOJA' ? 'selected' : ''}>LOJA</option>
            <option value="SM" ${row.loja === 'SM' ? 'selected' : ''}>SM</option>
          </select>
        </td>
        <td>
          <textarea value="${row.observacoes || ''}"
                 placeholder="Observações..."
                 style="width: 180px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;"
                 onblur="updateObservacoes(${row.id}, this.value)"
                 onkeypress="if(event.key==='Enter') this.blur()">${row.observacoes || ''}</textarea>
        </td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button onclick="openEditRecordModal(${originalIndex})"
                    style="padding: 4px 8px; background: none; color: #666; border: none; cursor: pointer; border-radius: 3px;"
                    title="Editar registo"
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
  if (btnExport)  btnExport.addEventListener('click', openExportModal);
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
  { canon: "MAN",                  rx: /\bMAN\b|\bMN\b/ },
  { canon: "DAF",                  rx: /\bDAF\b|\bDF\b/ },
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
  { canon: "Audi",          rx: /\bAUDI\b|\bAD\b/ },
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
  { canon: "Tesla",         rx: /\bTESLA\b|\bTSL\b/ },
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
    "MITSUBISHI","SUBARU","SUZUKI","HYUNDAI","KIA","VOLVO","SAAB","JAGUAR",
    "MINI","PORSCHE","SMART","TESLA"
  ];
  return simple.includes(t) ? t.charAt(0) + t.slice(1).toLowerCase() : null;
}

function detectVehicleAndModelFromText(rawText) {
  const brand = detectVehicleFromText(rawText);
  return { brand, full: brand };
}

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

// ===== Funções para atualizar campos inline - VERSÃO CORRIGIDA =====
async function updateLoja(recordId, loja) {
  try {
    console.log('🔧 updateLoja chamada:', { recordId, loja });
    
    // Encontrar registo local
    const recordIndex = RESULTS.findIndex(r => parseInt(r.id) === parseInt(recordId));
    console.log('🔧 Procurando registo com ID:', recordId);
    console.log('🔧 Índice encontrado:', recordIndex);
    
    if (recordIndex === -1) {
      console.log('❌ Registo não encontrado:', recordId);
      showToast(`❌ Registo ID:${recordId} não encontrado`, 'error');
      return;
    }
    
    console.log('🔧 Registo encontrado no índice:', recordIndex);
    console.log('🔧 Dados do registo:', RESULTS[recordIndex]);
    
    // Atualizar localmente primeiro
    const oldLoja = RESULTS[recordIndex].loja;
    RESULTS[recordIndex].loja = loja;
    console.log('🔧 Atualizado localmente de', oldLoja, 'para', loja);
    
    // Enviar para servidor (enviar TODOS os campos necessários)
    console.log('🔧 Enviando para servidor...');
    const fullRecord = RESULTS[recordIndex];
    const payload = {
      id: recordId,
      text: fullRecord.text || '',
      eurocode: fullRecord.eurocode || '',
      filename: fullRecord.filename || '',
      source: fullRecord.source || '',
      brand: fullRecord.brand || '',
      vehicle: fullRecord.vehicle || '',
      matricula: fullRecord.matricula || '',
      loja: loja,  // CAMPO PRINCIPAL A ATUALIZAR
      observacoes: fullRecord.observacoes || ''
    };
    
    console.log('🔧 Payload completo:', payload);
    
    const response = await fetch('/.netlify/functions/update-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('🔧 Resposta do servidor:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Erro do servidor:', errorText);
      
      // Restaurar valor anterior em caso de erro
      RESULTS[recordIndex].loja = oldLoja;
      renderTable();
      
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Sucesso do servidor:', result);
    
    // Mostrar sucesso
    showToast(`✅ Loja alterada para ${loja}`, 'success');
    
  } catch (error) {
    console.error('❌ Erro ao atualizar loja:', error);
    showToast(`❌ Erro ao alterar loja: ${error.message}`, 'error');
    
    // Restaurar valor anterior em caso de erro
    renderTable();
  }
}

async function updateObservacoes(recordId, observacoes) {
  try {
    console.log('🔧 updateObservacoes chamada:', { recordId, observacoes });
    
    // Encontrar registo local
    const recordIndex = RESULTS.findIndex(r => parseInt(r.id) === parseInt(recordId));
    console.log('🔧 Procurando registo com ID:', recordId);
    console.log('🔧 Índice encontrado:', recordIndex);
    
    if (recordIndex === -1) {
      console.log('❌ Registo não encontrado:', recordId);
      showToast('Registo não encontrado', 'error');
      return;
    }
    
    console.log('🔧 Registo encontrado no índice:', recordIndex);
    console.log('🔧 Dados do registo:', RESULTS[recordIndex]);
    
    // Atualizar localmente primeiro
    RESULTS[recordIndex].observacoes = observacoes;
    console.log('🔧 Atualizado localmente:', RESULTS[recordIndex]);
    
    // Enviar para servidor (enviar TODOS os campos necessários)
    console.log('🔧 Enviando para servidor...');
    const fullRecord = RESULTS[recordIndex];
    const payload = {
      id: recordId,
      text: fullRecord.text || '',
      eurocode: fullRecord.eurocode || '',
      filename: fullRecord.filename || '',
      source: fullRecord.source || '',
      brand: fullRecord.brand || '',
      vehicle: fullRecord.vehicle || '',
      matricula: fullRecord.matricula || '',
      loja: fullRecord.loja || 'LOJA',
      observacoes: observacoes  // CAMPO PRINCIPAL A ATUALIZAR
    };
    
    const response = await fetch('/.netlify/functions/update-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });
    
    console.log('🔧 Resposta do servidor:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.log('❌ Erro do servidor:', errorData);
      throw new Error(`Erro ${response.status}: ${errorData.error || 'Erro ao atualizar observações'}`);
    }
    
    const result = await response.json();
    console.log('✅ Sucesso do servidor:', result);
    
    // Mostrar sucesso
    if (observacoes.trim()) {
      showToast('Observações guardadas', 'success');
    } else {
      showToast('Observações removidas', 'success');
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar observações:', error);
    showToast(`Erro ao guardar observações: ${error.message}`, 'error');
    
    // Restaurar valor anterior em caso de erro
    renderTable();
  }
}

// Atalho: window.setAuthToken('...') para definir token manualmente
window.setAuthToken = function(t){
  if (!t) return;
  saveToken(t);
  alert('Token guardado.');
};

// ===== Excel Export (SheetJS) =====
function exportExcelWithData(dataToExport){
  const list = Array.isArray(dataToExport) ? dataToExport : (FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS);
  const rows = list.map((row, index) => ({
    "#": index + 1,
    "Data/Hora": row.timestamp || "",
    "Tipologia": (typeof detectGlassType === 'function' ? detectGlassType(row.eurocode) : "") || "",
    "Veículo": row.vehicle || "",
    "Eurocode": row.eurocode || "",
    "Marca Vidro": row.brand || "",
    "Matrícula": row.matricula || "",
    "SM/LOJA": row.loja || "LOJA",
    "OBS": row.observacoes || ""
  }));
  try {
    let ws;
    if (rows.length === 0) {
      const headers = ["#", "Data/Hora", "Tipologia", "Veículo", "Eurocode", "Marca Vidro", "Matrícula", "SM/LOJA", "OBS"];
      ws = XLSX.utils.aoa_to_sheet([headers]);
    } else {
      ws = XLSX.utils.json_to_sheet(rows, { cellDates: true });
    }
    ws['!cols'] = [
      { wch: 4 },  { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 16 },
      { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registos");
    const filename = `expressglass_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    if (typeof showToast === 'function') showToast('Excel exportado com sucesso!', 'success');
  } catch (e) {
    console.error('Erro ao exportar Excel:', e);
    if (typeof showToast === 'function') showToast('Erro ao exportar Excel', 'error');
  }
}
function exportExcel(){ exportExcelWithData(); }

// ===== Helpers: datas e filtro por intervalo =====
function parseAnyDate(ts){
  if (!ts) return null;
  const d = new Date(ts);
  if (!isNaN(d)) return d;
  try{
    const m = String(ts).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[^\d]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m){
      const dd = parseInt(m[1],10), mm = parseInt(m[2],10)-1, yy = parseInt(m[3].length===2? '20'+m[3]:m[3],10);
      const hh = parseInt(m[4]||'0',10), mi = parseInt(m[5]||'0',10), ss = parseInt(m[6]||'0',10);
      const dt = new Date(yy, mm, dd, hh, mi, ss);
      if (!isNaN(dt)) return dt;
    }
  }catch(_){}
  return null;
}
function filterByDateRange(rows, startDate, endDate){
  if (!startDate && !endDate) return rows;
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end   = endDate   ? new Date(endDate   + 'T23:59:59') : null;
  return rows.filter(r => {
    const dt = parseAnyDate(r.timestamp);
    if (!dt) return false;
    if (start && dt < start) return false;
    if (end && dt > end) return false;
    return true;
  });
}

// ===== Modal de exportação (lazy DOM) - VERSÃO ATUALIZADA COM FILTROS =====
function openExportModal(){
  console.log('Modal de exportação - versão com filtros rápidos carregada');
  const modal = document.getElementById('exportModal');
  if (!modal) { exportExcel(); return; }

  const btnClose   = document.getElementById('exportModalClose');
  const btnCancel  = document.getElementById('exportModalCancel');
  const btnConfirm = document.getElementById('exportModalConfirm');
  const startEl    = document.getElementById('exportStart');
  const endEl      = document.getElementById('exportEnd');
  const useSearch  = document.getElementById('exportUseSearch');
  
  // Botões de filtro rápido
  const btnToday   = document.getElementById('exportToday');
  const btnWeek    = document.getElementById('exportWeek');
  const btnAll     = document.getElementById('exportAll');
  
  console.log('Botões encontrados:', { btnToday: !!btnToday, btnWeek: !!btnWeek, btnAll: !!btnAll });

  // Função para definir período
  function setPeriod(period) {
    console.log('setPeriod chamado com:', period);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    
    // Remover classe active de todos os botões
    document.querySelectorAll('.export-quick-btn').forEach(btn => btn.classList.remove('active'));
    
    if (period === 'today') {
      // Hoje: data início e fim são hoje
      if (startEl) {
        startEl.value = todayStr;
        console.log('Data início definida para:', startEl.value);
      }
      if (endEl) {
        endEl.value = todayStr;
        console.log('Data fim definida para:', endEl.value);
      }
      if (btnToday) btnToday.classList.add('active');
    } else if (period === 'week') {
      // Esta semana: segunda-feira até hoje
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Se domingo (0), volta 6 dias
      const monday = new Date(today.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
      const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      
      if (startEl) startEl.value = mondayStr;
      if (endEl) endEl.value = todayStr;
      if (btnWeek) btnWeek.classList.add('active');
    } else if (period === 'all') {
      // Tudo: limpar datas para exportar tudo
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
      if (btnAll) btnAll.classList.add('active');
    }
  }

  modal.classList.add('show');
  modal.style.display = 'flex';

  const close = () => { modal.classList.remove('show'); modal.style.display='none'; };

  // Sempre adicionar os event listeners (remover verificação de wired)
  if (btnClose) btnClose.onclick = close;
  if (btnCancel) btnCancel.onclick = close;
  if (btnConfirm) btnConfirm.onclick = () => {
    const base = (useSearch && useSearch.checked) 
      ? (FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS)
      : RESULTS;
    const ranged = filterByDateRange(base, startEl?.value || '', endEl?.value || '');
    exportExcelWithData(ranged);
    close();
  };
  
  // Event listeners para os botões de filtro rápido - sempre adicionar
  if (btnToday) btnToday.onclick = () => setPeriod('today');
  if (btnWeek) btnWeek.onclick = () => setPeriod('week');
  if (btnAll) btnAll.onclick = () => setPeriod('all');
  
  // Definir período padrão como "hoje" DEPOIS de adicionar os listeners
  setPeriod('today');
}
window.openExportModal = openExportModal;

// Compat: chamadas antigas
window.exportCSV = function(){ if (typeof openExportModal==='function') openExportModal(); else if (typeof exportExcel==='function') exportExcel(); };

// ===== Modal de Edição de Registo =====
let currentEditingRowIndex = null;

function openEditRecordModal(rowIndex) {
  console.log('Abrindo modal de edição para linha:', rowIndex);
  currentEditingRowIndex = rowIndex;
  
  const modal = document.getElementById('editRecordModal');
  const lojaSelect = document.getElementById('editLoja');
  const observacoesTextarea = document.getElementById('editObservacoes');
  
  if (!modal || !lojaSelect || !observacoesTextarea) {
    console.error('Elementos do modal não encontrados');
    return;
  }
  
  // Preencher com dados atuais se existirem
  const currentData = RESULTS[rowIndex] || {};
  lojaSelect.value = currentData.loja || 'LOJA';
  observacoesTextarea.value = currentData.observacoes || '';
  
  modal.classList.add('show');
  modal.style.display = 'flex';
  
  // Event listeners (só adicionar uma vez)
  if (!modal.dataset.wired) {
    const closeBtn = document.getElementById('editRecordClose');
    const cancelBtn = document.getElementById('editRecordCancel');
    const saveBtn = document.getElementById('editRecordSave');
    
    const closeModal = () => {
      modal.classList.remove('show');
      modal.style.display = 'none';
      currentEditingRowIndex = null;
    };
    
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (saveBtn) saveBtn.onclick = saveEditedRecord;
    
    // Fechar ao clicar fora
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
    
    modal.dataset.wired = '1';
  }
}

function saveEditedRecord() {
  if (currentEditingRowIndex === null) return;
  
  const lojaSelect = document.getElementById('editLoja');
  const observacoesTextarea = document.getElementById('editObservacoes');
  
  if (!lojaSelect || !observacoesTextarea) return;
  
  // Atualizar dados localmente
  RESULTS[currentEditingRowIndex] = Object.assign(RESULTS[currentEditingRowIndex], {
    loja: lojaSelect.value,
    observacoes: observacoesTextarea.value
  });
  
  // Atualizar tabela
  renderTable();
  
  // Fechar modal
  const modal = document.getElementById('editRecordModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  
  currentEditingRowIndex = null;
  
  // Mostrar mensagem de sucesso
  if (typeof showToast === 'function') {
    showToast('Registo atualizado com sucesso!', 'success');
  }
}

window.openEditRecordModal = openEditRecordModal;
window.updateLoja = updateLoja;
window.updateObservacoes = updateObservacoes;
