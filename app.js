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
  
  // Se a marca estiver vazia, tenta detectar novamente a partir do texto
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
    vehicle:   r.vehicle ?? '' // pode ser "Marca" ou "Marca Modelo"
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
      `<tr><td colspan="7" style="text-align:center; padding:20px;">${message}</td></tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, idx) => {
    const timestamp = row.timestamp || '';
    const text      = row.text || '';
    const eurocode  = row.eurocode || '';
    const filename  = row.filename || '';
    const source    = row.source || '';
    const brand     = row.brand || '';
    const vehicle   = row.vehicle || '';

    return `
      <tr>
        <td>${timestamp}</td>
        <td class="ocr-text">${text}</td>
        <td>${eurocode}</td>
        <td>${brand}</td>
        <td>${vehicle}</td>
        <td>${filename}</td>
        <td>${source}</td>
        <td>
          <button onclick="openEditOcrModal(${JSON.stringify(row).replace(/"/g, '&quot;')})" 
                  class="btn-edit" title="Editar texto">✏️</button>
          <button onclick="deleteRow(${row.id})" 
                  class="btn-delete" title="Apagar registo">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// =========================
// Apagar registo
async function deleteRow(id) {
  if (!confirm('Tem a certeza que deseja apagar este registo?')) return;
  try {
    const response = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (response.ok) {
      showToast('Registo apagado com sucesso', 'success');
      await loadResults();
    } else {
      throw new Error('Erro ao apagar');
    }
  } catch (error) {
    console.error('Erro ao apagar:', error);
    showToast('Erro ao apagar registo', 'error');
  }
}
window.deleteRow = deleteRow;

// =========================
// Upload de ficheiro
async function handleFileUpload() {
  const file = fileInput.files[0];
  if (!file) return;

  try {
    setStatus(desktopStatus, 'A processar imagem...');
    setStatus(mobileStatus,  'A processar imagem...');

    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    const ocrText = await runOCR(base64);
    if (!ocrText) {
      setStatus(desktopStatus, 'Erro: OCR não retornou texto', 'error');
      setStatus(mobileStatus,  'Erro: OCR não retornou texto', 'error');
      return;
    }

    setStatus(desktopStatus, 'OCR concluído. A validar Eurocode...');
    setStatus(mobileStatus,  'OCR concluído. A validar Eurocode...');

    const filename = file.name;
    const source = 'upload';
    showEurocodeValidationModal(ocrText, filename, source);

  } catch (error) {
    console.error('Erro no upload:', error);
    setStatus(desktopStatus, 'Erro no processamento', 'error');
    setStatus(mobileStatus,  'Erro no processamento', 'error');
  }
}

// =========================
// Câmara (mobile)
function initCamera() {
  if (!cameraInput) return;
  cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setStatus(mobileStatus, 'A processar imagem...');
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.readAsDataURL(file);
      });

      const ocrText = await runOCR(base64);
      if (!ocrText) {
        setStatus(mobileStatus, 'Erro: OCR não retornou texto', 'error');
        return;
      }

      setStatus(mobileStatus, 'OCR concluído. A validar Eurocode...');
      const filename = `camera_${Date.now()}.jpg`;
      const source = 'camera';
      showEurocodeValidationModal(ocrText, filename, source);

    } catch (error) {
      console.error('Erro na câmara:', error);
      setStatus(mobileStatus, 'Erro no processamento', 'error');
    } finally {
      cameraInput.value = '';
    }
  });
}

// =========================
// Deteção de Marca (brand) e Veículo (vehicle)
function detectBrandFromText(text) {
  const t = String(text).toUpperCase();

  // Marcas principais
  const brands = [
    { name: 'Mercedes',   regex: /MERCEDES|MBENZ|MB[-_\s]?[A-Z0-9]|ACTROS|AXOR|ATEGO|SPRINTER|VARIO|VITO|VITO|VANEO|CITAN|MARCO POLO|UNIMOG|ZETROS|ECITARO|TOURISMO|INTEGRO/i },
    { name: 'Volvo',      regex: /VOLVO|VNL|VNR|VNM|VHD|FE|FL|FM|FH|FMX|ECR|NR|N10|N7|N|V|L|F|G|A|B|M|P|S|T|X|XC|V40|V50|V60|V70|V90|S40|S60|S70|S80|S90|XC40|XC60|XC70|XC90|C30|C70|V40CC|V60CC|V90CC|S60CC|S90CC|XC40CC|XC60CC|XC90CC|V60PL|V90PL|S60PL|S90PL|XC60PL|XC90PL|V60XC|V90XC|S60XC|S90XC|XC60XC|XC90XC|V60C|V90C|S60C|S90C|XC60C|XC90C|V60X|V90X|S60X|S90X|XC60X|XC90X|V60T|V90T|S60T|S90T|XC60T|XC90T|V60R|V90R|S60R|S90R|XC60R|XC90R|V60A|V90A|S60A|S90A|XC60A|XC90A|V60B|V90B|S60B|S90B|XC60B|XC90B|V60M|V90M|S60M|S90M|XC60M|XC90M|V60P|V90P|S60P|S90P|XC60P|XC90P|V60S|V90S|S60S|S90S|XC60S|XC90S|V60V|V90V|S60V|S90V|XC60V|XC90V|V60W|V90W|S60W|S90W|XC60W|XC90W|V60Z|V90Z|S60Z|S90Z|XC60Z|XC90Z|V60CC|V90CC|S60CC|S90CC|XC60CC|XC90CC|V60PL|V90PL|S60PL|S90PL|XC60PL|XC90PL|V60XC|V90XC|S60XC|S90XC|XC60XC|XC90XC|V60C|V90C|S60C|S90C|XC60C|XC90C|V60X|V90X|S60X|S90X|XC60X|XC90X|V60T|V90T|S60T|S90T|XC60T|XC90T|V60R|V90R|S60R|S90R|XC60R|XC90R|V60A|V90A|S60A|S90A|XC60A|XC90A|V60B|V90B|S60B|S90B|XC60B|XC90B|V60M|V90M|S60M|S90M|XC60M|XC90M|V60P|V90P|S60P|S90P|XC60P|XC90P|V60S|V90S|S60S|S90S|XC60S|XC90S|V60V|V90V|S60V|S90V|XC60V|XC90V|V60W|V90W|S60W|S90W|XC60W|XC90W|V60Z|V90Z|S60Z|S90Z|XC60Z|XC90Z/i },
    { name: 'Scania',     regex: /SCANIA|SC[0-9]|P[0-9]|G[0-9]|R[0-9]|S[0-9]|L[0-9]|K[0-9]|T[0-9]|X[0-9]|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|SCANIA|极/i },
    { name: 'MAN',        regex: /MAN|TGM|TGS|TGX|TGL|TGE|TGA|TGB|TGC|TGD|TGE|TGF|TGG|TGH|TGI|TGJ|TGK|TGL|TGM|TGN|TGO|TGP|TGQ|TGR|TGS|TGT|TGU|TGV|TGW|TGX|TGY|TGZ|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN|MAN极/i },
    { name: 'DAF',        regex: /DAF|XF|CF|LF|FT|FA|FB|FC|FD|FE|FF|FG|FH|FI|FJ|FK|FL|FM|FN|FO|FP|FQ|FR|FS|FT|FU|FV|FW|FX|FY|FZ|XF|CF|LF|FT|FA|FB|FC|FD|FE|FF|FG|FH|FI|FJ|FK|FL|FM|FN|FO|FP|FQ极/i },
    { name: 'Iveco',      regex: /IVECO|DAILY|EURO|TRAKKER|STRALIS|S-WAY|C-WAY|ACCO|MAGIRUS|TECTOR|MASSIF|CAMPAGNOLA|ASTRA|ARCTIS|VENTURI|TURBO|Z|T|C|E|V|L|F|G|A|B|M|P|S|T|X|XC|V40|V50|V60|V70|V90|S40|S60|S70|S80|S90|XC40|XC60|XC70|XC90|C30|C70|V40CC|V60CC|V90CC|S60CC|S90CC|XC40CC|XC60CC|XC90CC|V60PL|V90PL|S60PL|S90PL|XC60PL|XC90PL|V60XC|V90XC|S60XC|S90XC|XC60XC|XC90XC|V60C|V90C|S60C|S90C|XC60C|XC90C|V60X|V90X|S60X|S90X|XC60X|XC90X|V60T|V90T|S60T|S90极/i },
    { name: 'Renault',    regex: /RENAULT|MAGNUM|PREMIUM|KERAX|MID|MAX|MAXITY|MASTER|TRAFIC|KANGOO|CLIO|MEGANE|LAGUNA|SCENIC|ESPACE|TWIZY|ZOE|FLUENCE|MODUS|THALIA|VEL|SATIS|AVANTIME|R5|R4|R6|R9|R11|R12|R14|R15|R16|R17|R18|R19|R20|R21|R25|R30|R5T|R4T|R6T|R9T|R11T|R12T|R14T|R15T|R16T|R17T|R18T|R19T|R20T|R21T|R25T|R30T|R5L|R4L|R6L|R9L|R11L|R12L|R14L|R15L|R16L|R17L|R18L|R19L|R20L|R21L|R25L|R30L|R5X|R4X|R6X|R9X|R11X|R12X|R14X|R15X|R16X|R17X|R18X|R19X|R20X|R21X|R25X|R30X|R5C|R4C|R6C|R9C|R11C|R12C|R14C|R15C|R16C|R17C|R18C|R19C|R20极/i }
  ];

  for (const brand of brands) {
    if (brand.regex.test(t)) {
      return brand.name;
    }
  }

  return '';
}

function detectVehicleAndModelFromText(text) {
  const t = String(text).toUpperCase();
  const vehicleRegexes = [
    { model: 'Actros',    regex: /ACTROS|MP[0-9]|A[0-9]/i },
    { model: 'Atego',     regex: /ATEGO|A[0-9]/i },
    { model: 'Axor',      regex: /AXOR|A[0-9]/i },
    { model: 'Sprinter',  regex: /SPRINTER|V[0-9]/i },
    { model: 'Vario',     regex: /VARIO|V[0-9]/i },
    { model: 'Vito',      regex: /VITO|V[0-9]/i },
    { model: 'Vaneo',     regex: /VANEO|V[0-9]/i },
    { model: 'Citan',     regex: /CITAN|C[0-9]/i },
    { model: 'Marco Polo', regex: /MARCO\s*POLO|MP[0-9]/i },
    { model: 'Unimog',    regex: /UNIMOG|U[0-9]/i },
    { model: 'Zetros',    regex: /ZETROS|Z[0-9]/i },
    { model: 'eCitaro',   regex: /ECITARO|E[0-9]/i },
    { model: 'Tourismo',  regex: /TOURISMO|T[0-9]/i },
    { model: 'Integro',   regex: /INTEGRO|I[0-9]/i }
  ];

  for (const vehicle of vehicleRegexes) {
    if (vehicle.regex.test(t)) {
      return { model: vehicle.model, full: `Mercedes ${vehicle.model}` };
    }
  }

  return { model: '', full: '' };
}

// =========================
// Exportar para CSV
async function exportToCSV() {
  const dataToExport = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToExport.length === 0) {
    showToast('Nenhum dado para exportar', 'error');
    return;
  }

  const headers = ['Data/Hora', 'Texto OCR', 'Eurocode', 'Marca', 'Veículo', 'Ficheiro', 'Origem'];
  const csvContent = [
    headers.join(','),
    ...dataToExport.map(row => [
      `"${(row.timestamp || '').replace(/"/g, '""')}"`,
      `"${(row.text || '').replace(/"/g, '""')}"`,
      `"${(row.eurocode || '').replace(/"/g, '""')}"`,
      `"${(row.brand || '').replace(/"/g, '""')}"`,
      `"${(row.vehicle || '').replace(/"/g, '""')}"`,
      `"${(row.filename || '').replace(/"/g, '""')}"`,
      `"${(row.source || '').replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `ocr_export_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================
// Limpar resultados
function clearResults() {
  if (confirm('Tem a certeza que deseja limpar todos os registos?')) {
    RESULTS = [];
    FILTERED_RESULTS = [];
    renderTable();
    showToast('Resultados limpos', 'success');
  }
}

// =========================
// Inicialização
function init() {
  addCustomCSS();
  createSearchField();
  initCamera();

  if (btnUpload) btnUpload.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', handleFileUpload);
  if (btnCamera) btnCamera.addEventListener('click', () => cameraInput.click());
  if (btnExport) btnExport.addEventListener('click', exportToCSV);
  if (btnClear)  btnClear.addEventListener('click', clearResults);

  loadResults();
}

// =========================
// Iniciar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}