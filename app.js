// APP.JS (BD + Editar só OCR sem tocar no Eurocode)
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
let RESULTS = [];  // [{id, timestamp, text, eurocode}, ...]
let currentEditingRow = null; // Para guardar qual linha está a ser editada

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
// Modal de edição OCR
// =========================
function openEditOcrModal(row) {
  if (!editOcrModal || !editOcrTextarea) return;
  
  currentEditingRow = row;
  editOcrTextarea.value = row.text || '';
  editOcrModal.style.display = 'flex';
  editOcrTextarea.focus();
  
  // Event listeners temporários para este modal
  const handleSave = async () => {
    const newText = editOcrTextarea.value.trim();
    if (!newText) {
      showToast('Texto não pode estar vazio', 'error');
      return;
    }
    
    try {
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
        throw new Error('Erro ao atualizar');
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      showToast('Erro ao atualizar texto', 'error');
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
    editOcrSave.removeEventListener('click', handleSave);
    editOcrCancel.removeEventListener('click', handleCancel);
    editOcrClose.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKeydown);
    editOcrModal.removeEventListener('click', handleBackdropClick);
  }
  
  // Adicionar event listeners
  editOcrSave.addEventListener('click', handleSave);
  editOcrCancel.addEventListener('click', handleCancel);
  editOcrClose.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKeydown);
  editOcrModal.addEventListener('click', handleBackdropClick);
}

// =========================
// Normalização MELHORADA
// =========================
function normalizeRow(r){
  console.log('Dados recebidos do servidor:', r);
  
  let timestamp = r.timestamp || r.datahora || r.created_at || r.createdAt || 
                  r.date || r.datetime || r.data || r.hora || r.created || 
                  r.updated_at || r.updatedAt || r.ts || '';
  
  if (!timestamp) {
    console.warn('Nenhuma timestamp encontrada nos dados, usando timestamp atual');
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
  
  console.log('Dados normalizados:', normalized);
  
  return normalized;
}

// =========================
// OCR (com fallback para Netlify Functions)
// =========================
async function runOCR(imageBase64) {
  async function tryOnce(url){
    const res = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ imageBase64 })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(()=>({text:''}));
    return data.text || data.fullText || data.raw || '';
  }
  try {
    return await tryOnce(OCR_ENDPOINT);
  } catch (err) {
    console.error('Erro no OCR:', err);
    showToast('Erro no OCR', 'error');
    return '';
  }
}

// =========================
// Eurocode (4 dígitos + 2..9 alfanuméricos)
// =========================
function extractEurocode(text) {
  const m = (text || '').match(/\b\d{4}[A-Za-z0-9]{2,9}\b/);
  return m ? m[0] : '';
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
    console.log('Resposta da API:', data);
    
    if (data.ok && Array.isArray(data.rows)) {
      RESULTS = data.rows.map(normalizeRow);
      renderTable();
      setStatus(desktopStatus, `${RESULTS.length} registos carregados`, 'success');
    } else {
      throw new Error('Formato de resposta inválido');
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    setStatus(desktopStatus, 'Erro a carregar dados', 'error');
    RESULTS = [];
    renderTable();
  }
}

// =========================
// Renderizar tabela
// =========================
function renderTable() {
  if (!resultsBody) return;
  
  if (RESULTS.length === 0) {
    resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Nenhum registo encontrado</td></tr>';
    return;
  }
  
  resultsBody.innerHTML = RESULTS.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${row.timestamp}</td>
      <td style="font-size:14px; line-height:1.35; white-space:pre-wrap; word-break:break-word;">
        ${row.text}
        <button onclick="openEditOcrModal(RESULTS[${index}])" 
                style="margin-left:8px; padding:2px 6px; font-size:11px; background:#007acc; color:white; border:none; border-radius:3px; cursor:pointer;"
                title="Editar texto OCR">
          ✏️
        </button>
      </td>
      <td>${row.eurocode}</td>
      <td>
        <button onclick="deleteRow(${row.id})" 
                style="padding:4px 8px; background:#dc3545; color:white; border:none; border-radius:3px; cursor:pointer;"
                title="Eliminar registo">
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
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

// =========================
// Processar imagem
// =========================
async function processImage(file) {
  if (!file) return;
  
  setStatus(desktopStatus, 'A processar imagem...');
  setStatus(mobileStatus, 'A processar imagem...');
  
  try {
    // Converter para base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    // OCR
    const ocrText = await runOCR(base64);
    if (!ocrText) {
      throw new Error('Nenhum texto encontrado na imagem');
    }
    
    // Extrair eurocode
    const eurocode = extractEurocode(ocrText);
    
    // Guardar na base de dados
    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: ocrText,
        eurocode: eurocode,
        filename: file.name,
        source: 'upload'
      })
    });
    
    if (response.ok) {
      showToast('Imagem processada com sucesso!', 'success');
      setStatus(desktopStatus, 'Imagem processada com sucesso!', 'success');
      setStatus(mobileStatus, 'Imagem processada com sucesso!', 'success');
      await loadResults();
    } else {
      throw new Error('Erro ao guardar na base de dados');
    }
    
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
  if (RESULTS.length === 0) {
    showToast('Nenhum dado para exportar', 'error');
    return;
  }
  
  const headers = ['#', 'Data/Hora', 'Texto OCR', 'Eurocode', 'Ficheiro'];
  const csvContent = [
    headers.join(','),
    ...RESULTS.map((row, index) => [
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
setInterval(loadResults, 30000); // Atualizar a cada 30 segundos