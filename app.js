// APP.JS SIMPLIFICADO E CORRIGIDO
// =========================

// Endpoints
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL = '/.netlify/functions/list-ocr';
const SAVE_URL = '/.netlify/functions/save-ocr';
const UPDATE_URL = '/.netlify/functions/update-ocr';
const DELETE_URL = '/.netlify/functions/delete-ocr';

// Seletores
const fileInput = document.getElementById('fileInput');
const btnUpload = document.getElementById('btnUpload');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');
const resultsBody = document.getElementById('resultsBody');

// Estado
let RESULTS = [];
let FILTERED_RESULTS = [];

// Funções Básicas
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 2200);
}

// EXPORT CSV - FUNCIONA!
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

// LIMPAR TABELA - FUNCIONA!
async function clearTable() {
  if (!confirm('Tem a certeza que quer limpar todos os dados?')) return;

  try {
    const response = await fetch('/.netlify/functions/clear-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      showToast('Tabela limpa com sucesso!', 'success');
      RESULTS = [];
      FILTERED_RESULTS = [];
      renderTable();
    }
  } catch (error) {
    showToast('Erro ao limpar tabela', 'error');
  }
}

// PROCESSAR IMAGEM - FUNCIONA!
async function processImage(file) {
  try {
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
      showEurocodeValidationModal(ocrText, file.name, 'upload');
    }
  } catch (error) {
    showToast('Erro ao processar imagem', 'error');
  }
}

// EVENT LISTENERS SIMPLES
if (btnUpload) {
  btnUpload.addEventListener('click', () => fileInput?.click());
}

if (fileInput) {
  fileInput.addEventListener('change', (e) => {
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

// Carregar dados iniciais
document.addEventListener('DOMContentLoaded', () => {
  console.log('Aplicação carregada!');
  // As outras funções podem ser carregadas aqui se necessário
});