// APP.JS COMPLETO E FUNCIONAL
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL = '/.netlify/functions/list-ocr';
const SAVE_URL = '/.netlify/functions/save-ocr';
const UPDATE_URL = '/.netlify/functions/update-ocr';
const DELETE_URL = '/.netlify/functions/delete-ocr';

// ---- Seletores ----
const fileInput = document.getElementById('fileInput');      // desktop "Carregar imagem"
const btnUpload = document.getElementById('btnUpload');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');
const resultsBody = document.getElementById('resultsBody');
const desktopStatus = document.getElementById('desktopStatus');

// 👇 mobile clássica (input câmara e botão)
const cameraInput = document.getElementById('cameraInput');
const btnCamera   = document.getElementById('btnCamera');

// ---- Modal Edit OCR (já existe no index.html)
const editOcrModal = document.getElementById('editOcrModal');
const editOcrTextarea = document.getElementById('editOcrTextarea');
const editOcrClose = document.getElementById('editOcrClose');
const editOcrCancel = document.getElementById('editOcrCancel');
const editOcrSave = document.getElementById('editOcrSave');

// ---- Estado ----
let RESULTS = [];
let FILTERED_RESULTS = [];
let CURRENT_EDIT_ID = null;

// =========================
// Utilitários
// =========================
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2200);
}

function setStatus(text, mode = '') {
  if (!desktopStatus) return;
  desktopStatus.textContent = text || '';
  desktopStatus.classList.remove('error', 'success');
  if (mode === 'error') desktopStatus.classList.add('error');
  if (mode === 'success') desktopStatus.classList.add('success');
}

// =========================
// Carregar resultados da API
// =========================
async function loadResults() {
  try {
    setStatus('A carregar dados...');

    const response = await fetch(LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.ok && Array.isArray(data.rows)) {
      RESULTS = data.rows.map(row => ({
        id: row.id || row._id,
        timestamp: row.timestamp || row.datahora || new Date().toLocaleString('pt-PT'),
        text: row.text || row.ocr_text || '',
        marca: row.marca || row.brand || row.fabricante || '',
        eurocode: row.eurocode || row.euro_validado || '',
        filename: row.filename || row.file || '',
        source: row.source || row.origem || ''
      }));

      FILTERED_RESULTS = [...RESULTS];
      renderTable();
      setStatus(`${RESULTS.length} registos carregados`, 'success');
    } else {
      RESULTS = [];
      FILTERED_RESULTS = [];
      renderTable();
      setStatus('Sem dados', 'error');
    }
  } catch (error) {
    setStatus('Erro a carregar dados', 'error');
    RESULTS = [];
    FILTERED_RESULTS = [];
    renderTable();
  }
}

// =========================
// Renderizar tabela
// =========================
function renderTable() {
  if (!resultsBody) return;

  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToShow.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhum registo encontrado</td></tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${row.timestamp}</td>
      <td class="ocr-text">${row.text}</td>
      <td>${row.marca || ''}</td>
      <td style="font-weight:700; color:#007acc;">${row.eurocode || ''}</td>
      <td class="col-actions" style="white-space:nowrap;">
        <button class="icon-btn" title="Editar" aria-label="Editar" onclick="openEdit('${row.id}')">✏️</button>
        <button class="icon-btn danger" title="Eliminar" aria-label="Eliminar" onclick="deleteRow('${row.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// =========================
// Editar registo (OCR text)
// =========================
function openEdit(id) {
  const row = RESULTS.find(r => r.id === id);
  if (!row) return;

  CURRENT_EDIT_ID = id;
  if (editOcrTextarea) editOcrTextarea.value = row.text || '';

  if (editOcrModal) editOcrModal.classList.add('show');
}
function closeEdit() {
  CURRENT_EDIT_ID = null;
  if (editOcrModal) editOcrModal.classList.remove('show');
}
async function saveEdit() {
  if (!CURRENT_EDIT_ID) return;
  const newText = (editOcrTextarea?.value || '').trim();

  try {
    setStatus('A atualizar registo...');
    const response = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: CURRENT_EDIT_ID, text: newText })
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    showToast('Registo atualizado!', 'success');
    closeEdit();
    await loadResults();
  } catch (e) {
    showToast('Erro ao atualizar registo', 'error');
  }
}
if (editOcrClose)  editOcrClose.addEventListener('click', closeEdit);
if (editOcrCancel) editOcrCancel.addEventListener('click', closeEdit);
if (editOcrSave)   editOcrSave.addEventListener('click', saveEdit);

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
      showToast('Falha ao eliminar registo', 'error');
    }
  } catch (error) {
    showToast('Erro ao eliminar registo', 'error');
  }
}

// =========================
// Processar imagem -> OCR
// =========================
async function processImage(file) {
  try {
    setStatus('A processar imagem...');

    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    const response = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: `data:${file.type};base64,${base64}` })
    });

    const data = await response.json();
    const ocrText = data.text || '';

    if (ocrText) {
      setStatus('Texto extraído!', 'success');
      await saveToDatabase(ocrText, '', file.name, 'upload', '');
    } else {
      setStatus('Sem texto detetado', 'error');
    }
  } catch (error) {
    setStatus('Erro ao processar imagem', 'error');
  }
}

// =========================
// Guardar Base de Dados
// =========================
async function saveToDatabase(text, eurocode, filename, source, marca = '') {
  try {
    setStatus('A guardar na base de dados...');

    const payload = { text, eurocode, filename, source, marca };
    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      showToast('Dados guardados com sucesso!', 'success');
      await loadResults();
    } else {
      setStatus('Falha ao guardar dados', 'error');
    }
  } catch (error) {
    setStatus('Erro ao guardar na base de dados', 'error');
  }
}

// Helpers usados pela UI mobile moderna (se existirem)
window.saveEurocode = async function(euro, ocrText) {
  await saveToDatabase(ocrText || '', euro || '', '', 'mobile', '');
};
window.saveWithoutEurocode = async function(ocrText) {
  await saveToDatabase(ocrText || '', '', '', 'mobile', '');
};

// =========================
// Export CSV
// =========================
function exportCSV() {
  const dataToExport = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToExport.length === 0) {
    showToast('Nenhum dado para exportar', 'error');
    return;
  }

  const headers = ['#', 'Data/Hora', 'Texto OCR', 'Marca', 'Eurocode', 'Ficheiro'];
  const csvContent = [
    headers.join(','),
    ...dataToExport.map((row, index) => [
      index + 1,
      `"${row.timestamp}"`,
      `"${(row.text || '').replace(/"/g, '""')}"`,
      `"${row.marca || ''}"`,
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
// Event Listeners (desktop + mobile)
// =========================
if (btnUpload) btnUpload.addEventListener('click', () => fileInput?.click());
if (fileInput)  fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processImage(file);
  e.target.value = ''; // permite repetir o mesmo ficheiro
});

// 👇 estes dois fazem a câmara funcionar no mobile clássico
if (btnCamera)  btnCamera.addEventListener('click', () => cameraInput?.click());
if (cameraInput) cameraInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processImage(file);
  e.target.value = ''; // permite tirar outra foto logo a seguir
});

if (btnExport) btnExport.addEventListener('click', exportCSV);
if (btnClear)  btnClear.addEventListener('click', () => {
  showToast('Função de limpar tabela não disponível', 'error');
});

// =========================
// Inicialização
// =========================
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});

// Expor funções globais (para onclick inline)
window.openEdit = openEdit;
window.deleteRow = deleteRow;