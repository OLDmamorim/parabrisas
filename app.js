// APP.JS COMPLETO E FUNCIONAL
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// ---- Seletores (DESKTOP) ----
const fileInput     = document.getElementById('fileInput');
const btnUpload     = document.getElementById('btnUpload');
const btnExport     = document.getElementById('btnExport');
const btnClear      = document.getElementById('btnClear');
const resultsBody   = document.getElementById('resultsBody');
const desktopStatus = document.getElementById('desktopStatus');

// ---- Seletores (MODAL EDIT OCR) ----
const editOcrModal     = document.getElementById('editOcrModal');
const editOcrTextarea  = document.getElementById('editOcrTextarea');
const editOcrSave      = document.getElementById('editOcrSave');
const editOcrCancel    = document.getElementById('editOcrCancel');
const editOcrClose     = document.getElementById('editOcrClose');

// ---- Seletores (AJUDA DESKTOP – se existirem no HTML) ----
const helpBtnDesktop = document.getElementById('helpBtnDesktop');
const helpModal      = document.getElementById('helpModal');
const helpClose      = document.getElementById('helpClose');

// ---- Estado ----
let RESULTS = [];
let FILTERED_RESULTS = [];

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

function escapeBackticks(str = '') {
  return String(str).replace(/`/g, '\\`');
}

// =========================
/* Carregar resultados da API */
// =========================
async function loadResults() {
  try {
    setStatus('A carregar dados...');
    const response = await fetch(LIST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.ok && Array.isArray(data.rows)) {
      RESULTS = data.rows.map(row => ({
        id:        row.id || row._id,
        timestamp: row.timestamp || row.datahora || new Date().toLocaleString('pt-PT'),
        text:      row.text || row.ocr_text || '',
        eurocode:  row.eurocode || row.euro_validado || '',
        filename:  row.filename || row.file || '',
        source:    row.source || row.origem || ''
      }));

      // Mostramos tudo por omissão
      FILTERED_RESULTS = [];
      renderTable();
      setStatus(`${RESULTS.length} registos carregados`, 'success');
    } else {
      throw new Error('Resposta inválida');
    }
  } catch (error) {
    setStatus('Erro a carregar dados', 'error');
    RESULTS = [];
    FILTERED_RESULTS = [];
    renderTable();
  }
}

// =========================
/* Renderizar tabela (DESKTOP) */
// =========================
function renderTable() {
  if (!resultsBody) return;

  const dataToShow = FILTERED_RESULTS.length > 0 ? FILTERED_RESULTS : RESULTS;

  if (dataToShow.length === 0) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:20px;">
          Nenhum registo encontrado
        </td>
      </tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${row.timestamp}</td>
      <td class="ocr-text">${row.text}</td>
      <td style="font-weight:700; color:#007acc;">${row.eurocode || ''}</td>
      <td class="col-actions" style="white-space:nowrap">
        <button
          class="btn btn-mini"
          title="Editar texto OCR"
          onclick="openEditModal('${row.id}', \`${escapeBackticks(row.text)}\`)">✏️</button>
        <button
          class="btn btn-mini danger"
          title="Eliminar registo"
          onclick="deleteRow('${row.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// =========================
/* Eliminar registo */
// =========================
async function deleteRow(id) {
  if (!confirm('Tem a certeza que quer eliminar este registo?')) return;

  try {
    const response = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showToast('Registo eliminado com sucesso!', 'success');
    await loadResults();
  } catch (error) {
    showToast('Erro ao eliminar registo', 'error');
  }
}

// =========================
/* Processar imagem (upload desktop) */
// =========================
async function processImage(file) {
  try {
    setStatus('A processar imagem...');
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        // result = "data:<mime>;base64,AAA..."
        resolve(String(result).split(',')[1] || '');
      };
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
      await saveToDatabase(ocrText, '', file.name, 'upload');
    } else {
      setStatus('Sem texto detetado', 'error');
    }
  } catch (error) {
    setStatus('Erro ao processar imagem', 'error');
  }
}

// =========================
/* Guardar na Base de Dados */
// =========================
async function saveToDatabase(text, eurocode, filename, source) {
  try {
    setStatus('A guardar na base de dados...');
    const response = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, eurocode, filename, source })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showToast('Dados guardados com sucesso!', 'success');
    await loadResults();
  } catch (error) {
    setStatus('Erro ao guardar na base de dados', 'error');
  }
}

// =========================
/* Atualizar texto (Modal) */
// =========================
function openEditModal(id, text) {
  if (!editOcrModal || !editOcrTextarea) return;
  editOcrTextarea.value = text || '';
  editOcrModal.dataset.editingId = id;
  editOcrModal.classList.add('show');
}

function closeEditModal() {
  if (!editOcrModal) return;
  editOcrModal.classList.remove('show');
  delete editOcrModal.dataset.editingId;
}

async function saveEditedText() {
  if (!editOcrModal || !editOcrTextarea) return;
  const id   = editOcrModal.dataset.editingId;
  const text = editOcrTextarea.value;

  if (!id) return;

  try {
    const response = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showToast('Texto atualizado com sucesso!', 'success');
    closeEditModal();
    await loadResults();
  } catch (err) {
    showToast('Erro ao atualizar', 'error');
  }
}

// =========================
/* Export CSV */
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
/* Event Listeners */
// =========================
if (btnUpload) {
  btnUpload.addEventListener('click', () => fileInput?.click());
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  });
}

if (btnExport) {
  btnExport.addEventListener('click', exportCSV);
}

// Se existir o botão "Limpar", apenas feedback (sem apagar nada no backend)
if (btnClear) {
  btnClear.addEventListener('click', () => {
    showToast('Função de limpar tabela não disponível', 'error');
  });
}

// Modal Edit OCR
if (editOcrSave)   editOcrSave.addEventListener('click', saveEditedText);
if (editOcrCancel) editOcrCancel.addEventListener('click', closeEditModal);
if (editOcrClose)  editOcrClose.addEventListener('click', closeEditModal);

// Modal Ajuda (opcional)
if (helpBtnDesktop && helpModal && helpClose) {
  helpBtnDesktop.addEventListener('click', () => helpModal.classList.add('show'));
  helpClose.addEventListener('click', () => helpModal.classList.remove('show'));
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.remove('show');
  });
}

// =========================
/* Funções usadas pela versão mobile moderna (se existir) */
// =========================
async function saveEurocode(code, ocrText) {
  // Guarda OCR + Eurocode vindo da UI mobile moderna
  await saveToDatabase(ocrText || '', code || '', '', 'camera');
}
async function saveWithoutEurocode(ocrText) {
  // Guarda apenas OCR
  await saveToDatabase(ocrText || '', '', '', 'camera');
}

// Tornar funções globais para outros scripts inline
window.deleteRow           = deleteRow;
window.openEditModal       = openEditModal;
window.saveEurocode        = saveEurocode;
window.saveWithoutEurocode = saveWithoutEurocode;

// =========================
/* Inicialização */
// =========================
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});