// APP.JS COMPLETO E FUNCIONAL
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL = '/.netlify/functions/list-ocr';
const SAVE_URL = '/.netlify/functions/save-ocr';
const UPDATE_URL = '/.netlify/functions/update-ocr';
const DELETE_URL = '/.netlify/functions/delete-ocr';

// ---- Seletores ----
const fileInput = document.getElementById('fileInput');
const btnUpload = document.getElementById('btnUpload');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');
const resultsBody = document.getElementById('resultsBody');
const desktopStatus = document.getElementById('desktopStatus');

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
        // 👇 mapeamento da marca caso venha com outro nome
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
      <td style="font-weight: 700; color: #007acc;">${row.eurocode || ''}</td>
      <td>
        <button onclick="deleteRow('${row.id}')" class="btn danger">🗑️ Eliminar</button>
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
      showToast('Falha ao eliminar registo', 'error');
    }
  } catch (error) {
    showToast('Erro ao eliminar registo', 'error');
  }
}

// =========================
/* Processar imagem -> OCR */
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
      // Neste fluxo não detetamos marca automaticamente – gravamos vazia.
      await saveToDatabase(ocrText, '', file.name, 'upload', '');
    } else {
      setStatus('Sem texto detetado', 'error');
    }
  } catch (error) {
    setStatus('Erro ao processar imagem', 'error');
  }
}

// =========================
// Guardar na Base de Dados
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

// (Opcional) expor helpers globais caso a UI mobile moderna os use
window.saveEurocode = async function(euro, ocrText) {
  // guarda linha simples com o eurocode escolhido manualmente
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
// Event Listeners
// =========================
if (btnUpload) btnUpload.addEventListener('click', () => fileInput?.click());
if (fileInput) fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processImage(file);
});
if (btnExport) btnExport.addEventListener('click', exportCSV);
if (btnClear) btnClear.addEventListener('click', () => {
  showToast('Função de limpar tabela não disponível', 'error');
});

// =========================
// Inicialização
// =========================
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
});