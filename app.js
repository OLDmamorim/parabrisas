// APP.JS COMPLETO E FUNCIONAL
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// ---- Seletores (desktop)
const fileInput     = document.getElementById('fileInput');
const btnUpload     = document.getElementById('btnUpload');
const btnExport     = document.getElementById('btnExport');
const btnClear      = document.getElementById('btnClear');
const resultsBody   = document.getElementById('resultsBody');
const desktopStatus = document.getElementById('desktopStatus');

// ---- Seletores (mobile clássico – mantidos)
const cameraInput = document.getElementById('cameraInput');
const btnCamera   = document.getElementById('btnCamera');

// ---- Modal Edit OCR
const editOcrModal    = document.getElementById('editOcrModal');
const editOcrTextarea = document.getElementById('editOcrTextarea');
const editOcrClose    = document.getElementById('editOcrClose');
const editOcrCancel   = document.getElementById('editOcrCancel');
const editOcrSave     = document.getElementById('editOcrSave');

// ---- Estado ----
let RESULTS = [];
let FILTERED_RESULTS = [];
let CURRENT_EDIT_ID = null;

// =========================
// Utils
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
// Load Results
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
        marca:     row.marca || row.brand || row.fabricante || '',
        eurocode:  row.eurocode || row.euro_validado || '',
        filename:  row.filename || row.file || '',
        source:    row.source || row.origem || ''
      }));
      FILTERED_RESULTS = [...RESULTS];
      renderTable();
      setStatus(`${RESULTS.length} registos carregados`, 'success');
    } else {
      RESULTS = []; FILTERED_RESULTS = [];
      renderTable();
      setStatus('Sem dados', 'error');
    }
  } catch (err) {
    console.error(err);
    setStatus('Erro a carregar dados', 'error');
    RESULTS = []; FILTERED_RESULTS = [];
    renderTable();
  }
}

// =========================
// Render Table
// =========================
function renderTable() {
  if (!resultsBody) return;
  const dataToShow = FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS;

  if (!dataToShow.length) {
    resultsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px;">Nenhum registo encontrado</td></tr>`;
    return;
  }

  resultsBody.innerHTML = dataToShow.map((row, idx) => `
    <tr>
      <td>${idx + 1}</td>
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
// Edit
// =========================
function openEdit(id){
  const row = RESULTS.find(r => r.id === id);
  if (!row) return;
  CURRENT_EDIT_ID = id;
  if (editOcrTextarea) editOcrTextarea.value = row.text || '';
  if (editOcrModal) editOcrModal.classList.add('show');
}
function closeEdit(){
  CURRENT_EDIT_ID = null;
  if (editOcrModal) editOcrModal.classList.remove('show');
}
async function saveEdit(){
  if (!CURRENT_EDIT_ID) return;
  const newText = (editOcrTextarea?.value || '').trim();
  try{
    setStatus('A atualizar registo...');
    const resp = await fetch(UPDATE_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: CURRENT_EDIT_ID, text: newText })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    showToast('Registo atualizado!', 'success');
    closeEdit();
    await loadResults();
  }catch(e){
    console.error(e);
    showToast('Erro ao atualizar registo', 'error');
  }
}
if (editOcrClose)  editOcrClose.addEventListener('click', closeEdit);
if (editOcrCancel) editOcrCancel.addEventListener('click', closeEdit);
if (editOcrSave)   editOcrSave.addEventListener('click', saveEdit);

// =========================
// Delete
// =========================
async function deleteRow(id){
  if (!confirm('Tem a certeza que quer eliminar este registo?')) return;
  try{
    const resp = await fetch(DELETE_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id })
    });
    if (resp.ok){
      showToast('Registo eliminado com sucesso!', 'success');
      await loadResults();
    }else{
      showToast('Falha ao eliminar registo', 'error');
    }
  }catch(e){
    console.error(e);
    showToast('Erro ao eliminar registo', 'error');
  }
}
window.deleteRow = deleteRow;
window.openEdit  = openEdit;

// =========================
// OCR
// =========================
async function processImage(file){
  try{
    setStatus('A processar imagem...');
    const base64 = await new Promise((resolve) => {
      const rd = new FileReader();
      rd.onload = () => resolve(rd.result.split(',')[1]);
      rd.readAsDataURL(file);
    });
    const resp = await fetch(OCR_ENDPOINT, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ imageBase64: `data:${file.type};base64,${base64}` })
    });
    const data = await resp.json();
    const ocrText = data.text || '';

    if (ocrText){
      setStatus('Texto extraído!', 'success');
      await saveToDatabase(ocrText, '', file.name || '', 'upload', '');
    } else {
      setStatus('Sem texto detetado', 'error');
    }
  }catch(e){
    console.error(e);
    setStatus('Erro ao processar imagem', 'error');
  }finally{
    if (window.stopProcessing) window.stopProcessing();
  }
}
window.processImage = processImage; // usado pela vista moderna

// =========================
// Save DB
// =========================
async function saveToDatabase(text, eurocode, filename, source, marca=''){
  try{
    setStatus('A guardar na base de dados...');
    const resp = await fetch(SAVE_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text, eurocode, filename, source, marca })
    });
    if (resp.ok){
      showToast('Dados guardados com sucesso!', 'success');
      await loadResults();
    } else {
      setStatus('Falha ao guardar dados', 'error');
    }
  }catch(e){
    console.error(e);
    setStatus('Erro ao guardar na base de dados', 'error');
  }
}

// usados pela UI moderna (se usado o modal de seleção)
window.saveEurocode = async (euro, ocrText) => {
  await saveToDatabase(ocrText || '', euro || '', '', 'mobile', '');
};
window.saveWithoutEurocode = async (ocrText) => {
  await saveToDatabase(ocrText || '', '', '', 'mobile', '');
};

// =========================
// Export CSV
// =========================
function exportCSV(){
  const dataToExport = FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS;
  if (!dataToExport.length){ showToast('Nenhum dado para exportar', 'error'); return; }

  const headers = ['#','Data/Hora','Texto OCR','Marca','Eurocode','Ficheiro'];
  const csv = [
    headers.join(','),
    ...dataToExport.map((r,i)=>[
      i+1,
      `"${r.timestamp}"`,
      `"${(r.text||'').replace(/"/g,'""')}"`,
      `"${r.marca||''}"`,
      `"${r.eurocode||''}"`,
      `"${r.filename||''}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expressglass_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('CSV exportado com sucesso!', 'success');
}

// =========================
// Listeners (desktop + clássico)
// =========================
if (btnUpload) btnUpload.addEventListener('click', () => fileInput?.click());
if (fileInput)  fileInput.addEventListener('change', (e)=>{
  const f = e.target.files?.[0];
  if (f) processImage(f);
  e.target.value = ''; // permite reusar o mesmo ficheiro
});
if (btnCamera)  btnCamera.addEventListener('click', ()=> cameraInput?.click());
if (cameraInput) cameraInput.addEventListener('change', (e)=>{
  const f = e.target.files?.[0];
  if (f) processImage(f);
  e.target.value = '';
});
if (btnExport) btnExport.addEventListener('click', exportCSV);
if (btnClear)  btnClear.addEventListener('click', ()=> showToast('Função de limpar tabela não disponível', 'error'));

// =========================
// Init
// =========================
document.addEventListener('DOMContentLoaded', loadResults);