// APP.JS (BD + Validação de Eurocode + Interface Minimalista Corrigida)
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
// Utils UI
// =========================
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
// =========================
function createSearchField() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar) return;
  
  // Verificar se já existe
  if (document.getElementById('searchField')) return;
  
  // Adicionar campo de procura diretamente na toolbar
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
  
  // Event listeners
  const searchField = document.getElementById('searchField');
  const clearSearch = document.getElementById('clearSearch');
  
  searchField.addEventListener('input', (e) => {
    filterResults(e.target.value);
  });
  
  clearSearch.addEventListener('click', () => {
    searchField.value = '';
    filterResults('');
  });
  
  // Hover effects
  clearSearch.addEventListener('mouseover', () => {
    clearSearch.style.background = 'rgba(255,255,255,0.1)';
  });
  
  clearSearch.addEventListener('mouseout', () => {
    clearSearch.style.background = 'none';
  });
}

function filterResults(searchTerm) {
  if (!searchTerm.trim()) {
    FILTERED_RESULTS = [...RESULTS];
  } else {
    const term = searchTerm.toLowerCase();
    FILTERED_RESULTS = RESULTS.filter(row => 
      (row.eurocode || '').toLowerCase().includes(term)
    );
  }
  renderTable();
}

// =========================
// Extração de Eurocodes Melhorada
// =========================
function extractAllEurocodes(text) {
  if (!text) return [];
  
  // Padrão: 4 dígitos + 2 letras + até 6 caracteres alfanuméricos
  const pattern = /\b\d{4}[A-Za-z]{2}[A-Za-z0-9]{0,6}\b/g;
  const matches = text.match(pattern) || [];
  
  // Remover duplicados e ordenar por comprimento (mais longos primeiro)
  const unique = [...new Set(matches)];
  return unique.sort((a, b) => b.length - a.length).slice(0, 4); // Máximo 4 opções
}

// =========================
// Modal de Validação de Eurocode
// =========================
function showEurocodeValidationModal(ocrText, filename, source) {
  const eurocodes = extractAllEurocodes(ocrText);
  
  if (eurocodes.length === 0) {
    if (confirm('Nenhum Eurocode encontrado no texto. Deseja guardar sem Eurocode?')) {
      saveToDatabase(ocrText, '', filename, source);
    }
    return;
  }
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 10px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;
  
  content.innerHTML = `
    <h3 style="margin-top: 0; color: #333; text-align: center;">
      🔍 Selecionar Eurocode
    </h3>
    <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; max-height: 150px; overflow-y: auto;">
      <strong>Texto lido:</strong><br>
      <span style="font-size: 12px; line-height: 1.4;">${ocrText.replace(/\n/g, '<br>')}</span>
    </div>
    <p style="margin-bottom: 15px; color: #666;">
      <strong>Eurocodes encontrados:</strong> Clique no correto
    </p>
    <div id="eurocodeOptions" style="margin-bottom: 20px;">
      ${eurocodes.map((code, index) => `
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
                     border-radius: 5px; cursor: pointer;">
        Sem Eurocode
      </button>
      <button onclick="closeEurocodeModal()" 
              style="padding: 10px 20px; background: #dc3545; color: white; border: none; 
                     border-radius: 5px; cursor: pointer;">
        Cancelar
      </button>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  window.currentEurocodeModal = modal;
  window.currentImageData = { ocrText, filename, source };
}

window.selectEurocode = function(selectedCode) {
  const { ocrText, filename, source } = window.currentImageData;
  closeEurocodeModal();
  saveToDatabase(ocrText, selectedCode, filename, source);
};

window.closeEurocodeModal = function() {
  if (window.currentEurocodeModal) {
    document.body.removeChild(window.currentEurocodeModal);
    window.currentEurocodeModal = null;
    window.currentImageData = null;
  }
};

// =========================
// Guardar na Base de Dados
// =========================
async function saveToDatabase(text, eurocode, filename, source) {
  try {
    setStatus(desktopStatus, 'A guardar na base de dados...');
    setStatus(mobileStatus, 'A guardar na base de dados...');
    
    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        eurocode: eurocode,
        filename: filename,
        source: source
      })
    });
    
    if (response.ok) {
      showToast('Dados guardados com sucesso!', 'success');
      setStatus(desktopStatus, 'Dados guardados com sucesso!', 'success');
      setStatus(mobileStatus, 'Dados guardados com sucesso!', 'success');
      await loadResults();
    } else {
      throw new Error('Erro ao guardar na base de dados');
    }
    
  } catch (error) {
    console.error('Erro ao guardar:', error);
    showToast('Erro ao guardar na base de dados: ' + error.message, 'error');
    setStatus(desktopStatus, 'Erro ao guardar na base de dados', 'error');
    setStatus(mobileStatus, 'Erro ao guardar na base de dados', 'error');
  }
}

// =========================
// Modal de edição OCR (Corrigido)
// =========================
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
      // Verificar se existe função update-ocr
      const response = await fetch(UPDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          text: newText,
          eurocode: row.eurocode || '',
          filename: row.filename || '',
          source: row.source || ''
        })
      });
      
      if (response.ok) {
        showToast('Texto atualizado com sucesso!', 'success');
        await loadResults();
        handleCancel();
      } else {
        // Se não existir função update, simular atualização local
        console.warn('Função update não disponível, simulando atualização local');
        row.text = newText;
        renderTable();
        showToast('Texto atualizado localmente', 'success');
        handleCancel();
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      // Fallback: atualização local
      row.text = newText;
      renderTable();
      showToast('Texto atualizado localmente', 'success');
      handleCancel();
    }
  };
  
  const handleCancel = () => {
    editOcrModal.style.display = 'none';
    currentEditingRow = null;
    cleanup();
  };
  
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };
  
  const handleBackdropClick = (e) => {
    if (e.target === editOcrModal) {
      handleCancel();
    }
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

// Função global para ser chamada pelos botões
window.openEditOcrModal = openEditOcrModal;

// =========================
// Normalização
// =========================
function normalizeRow(r){
  let timestamp = r.timestamp || r.datahora || r.created_at || r.createdAt || 
                  r.date || r.datetime || r.data || r.hora || r.created || 
                  r.updated_at || r.updatedAt || r.ts || '';
  
  if (!timestamp) {
    timestamp = new Date().toLocaleString('pt-PT');
  }
  
  if (typeof timestamp === 'number') {
    timestamp = new Date(timestamp).toLocaleString('pt-PT');
  }
  
  if (typeof timestamp === 'string' && timestamp.includes('T')) {
    try {
      timestamp = new Date(timestamp).toLocaleString('pt-PT');
    } catch (e) {
      console.warn('Erro ao converter timestamp ISO:', e);
    }
  }
  
  const normalized = {
    id:          r.id ?? r.rowId ?? r.uuid ?? r._id ?? null,
    timestamp:   timestamp,
    text:        r.text ?? r.ocr_text ?? r.ocr ?? r.texto ?? '',
    eurocode:    r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? r.codigo ?? '',
    filename:    r.filename ?? r.file ?? '',
    source:      r.source ?? r.origem ?? ''
  };
  
  return normalized;
}

// =========================
// OCR
// =========================
async function runOCR(imageBase64) {
  try {
    const res = await fetch(OCR_ENDPOINT, {
      method:'POST', 
      headers:{'Content-Type':'application/json'},
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
// =========================
async function loadResults() {
  try {
    setStatus(desktopStatus, 'A carregar dados...');
    
    const response = await fetch(LIST_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
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
// Renderizar tabela (Corrigida)
// =========================
function renderTable() {
  if (!resultsBody) return;
  
  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;
  
  if (dataToShow.length === 0) {
    const searchField = document.getElementById('searchField');
    const isSearching = searchField && searchField.value.trim();
    const message = isSearching ? 'Nenhum registo encontrado para esta procura' : 'Nenhum registo encontrado';
    resultsBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">${message}</td></tr>`;
    return;
  }
  
  resultsBody.innerHTML = dataToShow.map((row, index) => {
    // Encontrar o índice original no array RESULTS
    const originalIndex = RESULTS.findIndex(r => r.id === row.id);
    
    return `
    <tr>
      <td>${index + 1}</td>
      <td>${row.timestamp}</td>
      <td style="font-size:14px; line-height:1.35; white-space:pre-wrap; word-break:break-word;">
        ${row.text}
      </td>
      <td style="font-weight:bold; color:#007acc;">${row.eurocode}</td>
      <td>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button onclick="openEditOcrModal(RESULTS[${originalIndex}])" 
                  style="padding: 4px 8px; background: none; color: #666; border: none; cursor: pointer; font-size: 12px; border-radius: 3px;"
                  title="Editar texto OCR"
                  onmouseover="this.style.background='rgba(0,0,0,0.05)'; this.style.color='#333'" 
                  onmouseout="this.style.background='none'; this.style.color='#666'">
            ✏️ Editar
          </button>
          <button onclick="deleteRow(${row.id})" 
                  style="padding: 4px 8px; background: none; color: #dc3545; border: none; cursor: pointer; font-size: 12px; border-radius: 3px;"
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
// =========================
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

// Função global para ser chamada pelos botões
window.deleteRow = deleteRow;

// =========================
// Processar imagem
// =========================
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
    if (!ocrText) {
      throw new Error('Nenhum texto encontrado na imagem');
    }
    
    setStatus(desktopStatus, 'Texto extraído! Selecione o Eurocode...', 'success');
    setStatus(mobileStatus, 'Texto extraído! Selecione o Eurocode...', 'success');
    
    showEurocodeValidationModal(ocrText, file.name, 'upload');
    
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    showToast('Erro ao processar imagem: ' + error.message, 'error');
    setStatus(desktopStatus, 'Erro ao processar imagem', 'error');
    setStatus(mobileStatus, 'Erro ao processar imagem', 'error');
  }
}

// =========================
// Exportar CSV
// =========================
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
// =========================
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
// Event Listeners
// =========================
if (btnUpload) {
  btnUpload.addEventListener('click', () => fileInput?.click());
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processImage(file);
  });
}

if (btnCamera) {
  btnCamera.addEventListener('click', () => cameraInput?.click());
}

if (cameraInput) {
  cameraInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processImage(file);
  });
}

if (btnExport) {
  btnExport.addEventListener('click', exportCSV);
}

if (btnClear) {
  btnClear.addEventListener('click', clearTable);
}

// =========================
// Inicialização
// =========================
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
  
  // Criar campo de procura na toolbar
  setTimeout(createSearchField, 100);
  
  // Detectar se é mobile ou desktop
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
// =========================
setInterval(loadResults, 30000);