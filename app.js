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

/* =======================
 * PATCH: MOBILE MODERNO
 * (cola no fim do app.js)
 * ======================= */
(function () {
  // Evita duplicar listeners se o ficheiro for carregado 2x
  if (window.__modern_wired__) return;
  window.__modern_wired__ = true;

  // Endpoints usados no teu projeto (mantém os teus valores se já existem)
  const OCR_ENDPOINT = typeof window.OCR_ENDPOINT === 'string'
    ? window.OCR_ENDPOINT
    : '/.netlify/functions/ocr-proxy';
  const SAVE_URL = typeof window.SAVE_URL === 'string'
    ? window.SAVE_URL
    : '/.netlify/functions/save-ocr';

  // Seletores modernos
  const cameraInput         = document.getElementById('cameraInput');
  const modernBtn           = document.getElementById('modernCameraButton');
  const modernStatus        = document.getElementById('modernStatus');
  const euroModal           = document.getElementById('modernEurocodeModal');
  const ocrTextEl           = document.getElementById('modernOcrText');
  const euroListEl          = document.getElementById('modernEurocodeList');
  const btnNoEuro           = document.getElementById('modernBtnNoEurocode');
  const btnCancel           = document.getElementById('modernBtnCancel');
  const modernCapturesList  = document.getElementById('modernCapturesList');

  // Pequenas helpers de UI
  function startProcessingUI() {
    if (!modernBtn) return;
    modernBtn.classList.add('processing');
    const lbl = modernBtn.querySelector('.modern-camera-label');
    if (lbl) lbl.textContent = 'A processar...';
    if (modernStatus) { modernStatus.textContent = 'A processar...'; modernStatus.classList.add('show'); }
  }
  function stopProcessingUI() {
    if (!modernBtn) return;
    modernBtn.classList.remove('processing');
    const lbl = modernBtn.querySelector('.modern-camera-label');
    if (lbl) lbl.textContent = 'Eurocode';
    if (modernStatus) modernStatus.classList.remove('show');
  }

  // Extrair eurocodes do texto OCR (4 dígitos + 2–9 alfanum.)
  function extractEurocodes(t = '') {
    const up = String(t).toUpperCase();
    const set = new Set();
    const re = /\b\d{4}[A-Z0-9]{2,9}\b/g;
    let m; while ((m = re.exec(up)) !== null) set.add(m[0]);
    return [...set];
  }

  // Ler ficheiro → base64 (sem prefixo data:)
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // Guardar (usa a tua função se existir; senão faz POST)
  async function saveRecord(text, eurocode, filename, source) {
    if (typeof window.saveToDatabase === 'function') {
      await window.saveToDatabase(text, eurocode, filename, source);
      return;
    }
    await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, eurocode, filename, source })
    });
  }

  // Modal moderno (usa o do HTML se existir; senão fallback)
  function openEuroModal(ocrText, eurocodes) {
    // Se a página já tiver window.showEurocodePicker (de outro script), usa-o:
    if (typeof window.showEurocodePicker === 'function') {
      window.showEurocodePicker(ocrText, eurocodes);
      return;
    }
    // Fallback simples com os elementos já no DOM:
    if (!euroModal || !ocrTextEl || !euroListEl) return;
    ocrTextEl.textContent = ocrText || '';
    euroListEl.innerHTML = '';
    if (Array.isArray(eurocodes) && eurocodes.length) {
      eurocodes.forEach(code => {
        const b = document.createElement('button');
        b.className = 'modern-eurocode-button';
        b.textContent = code;
        b.addEventListener('click', async () => {
          euroModal.classList.remove('show');
          stopProcessingUI();
          await saveRecord(ocrText, code, 'camera.jpg', 'camera');
          if (typeof window.loadResults === 'function') window.loadResults();
        });
        euroListEl.appendChild(b);
      });
    } else {
      const d = document.createElement('div');
      d.style.color = '#718096';
      d.style.fontWeight = '600';
      d.textContent = 'Nenhum eurocode identificado';
      euroListEl.appendChild(d);
    }
    euroModal.classList.add('show');
  }

  // Lidar com evento do modal moderno (se vier de outro script)
  document.addEventListener('eurocode-selected', async (ev) => {
    const { code, ocrText } = ev.detail || {};
    stopProcessingUI();
    await saveRecord(ocrText || '', code || '', 'camera.jpg', 'camera');
    if (typeof window.loadResults === 'function') window.loadResults();
  });

  // Botões do modal (fallback)
  btnNoEuro && btnNoEuro.addEventListener('click', async () => {
    euroModal && euroModal.classList.remove('show');
    stopProcessingUI();
    const text = ocrTextEl ? ocrTextEl.textContent : '';
    await saveRecord(text, '', 'camera.jpg', 'camera');
    if (typeof window.loadResults === 'function') window.loadResults();
  });
  btnCancel && btnCancel.addEventListener('click', () => {
    euroModal && euroModal.classList.remove('show');
    stopProcessingUI();
  });

  // Processo OCR da imagem da câmara
  async function processCameraFile(file) {
    try {
      startProcessingUI();
      const base64 = await fileToBase64(file);
      const resp = await fetch(OCR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: `data:${file.type || 'image/jpeg'};base64,${base64}`
        })
      });
      const data = await resp.json();
      const ocrText = data && data.text ? data.text : '';
      const eurocodes = extractEurocodes(ocrText);
      openEuroModal(ocrText, eurocodes);
    } catch (e) {
      console.error('OCR error', e);
      stopProcessingUI();
      // guarda pelo menos o texto vazio para histórico, se quiseres:
      // await saveRecord('', '', 'camera.jpg', 'camera');
    }
  }

  // Clicar no círculo → abrir input
  if (modernBtn && cameraInput) {
    modernBtn.addEventListener('click', () => cameraInput.click());
  }

  // Selecionar foto da câmara → processar
  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) processCameraFile(f);
      try { e.target.value = ''; } catch (_) {}
    });
  }

  // Render “Últimas Capturas” no mobile (se tiveres RESULTS carregados)
  function renderModernCapturesFrom(rows) {
    if (!modernCapturesList || !Array.isArray(rows)) return;
    const source = rows.filter(r => r.eurocode).slice(0, 5);
    if (source.length === 0) {
      modernCapturesList.innerHTML =
        '<div class="modern-empty">Ainda não há capturas</div>';
      return;
    }
    modernCapturesList.innerHTML = source.map(r => `
      <div class="modern-capture-item" style="
        display:flex;justify-content:space-between;align-items:center;
        padding:12px 16px;background:#f7fafc;border-radius:12px;border-left:4px solid #22d3ee;">
        <span style="font-weight:800;color:#2d3748">${r.eurocode}</span>
        <span style="color:#22d3ee;font-weight:900">✓</span>
      </div>`).join('');
  }

  // Se o teu app expõe loadResults/RESULTS, atualiza também no boot e após guardar
  if (typeof window.RESULTS !== 'undefined') renderModernCapturesFrom(window.RESULTS);
  // Monkey-patch simples para atualizar depois de loadResults()
  const _oldLoad = window.loadResults;
  if (typeof _oldLoad === 'function') {
    window.loadResults = async function () {
      const r = await _oldLoad.apply(this, arguments);
      try { renderModernCapturesFrom(window.RESULTS || []); } catch(_) {}
      return r;
    };
  }
})();