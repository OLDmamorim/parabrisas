// =========================
// APP.JS (BD + Modal editar SÓ OCR)
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/api/ocr-proxy';     // fallback Netlify mais abaixo
const LIST_URL     = '/api/list-ocr';
const SAVE_URL     = '/api/save-ocr';
const UPDATE_URL   = '/api/update-ocr';    // EDITA SÓ OCR (enviamos eurocode/timestamp para não os perder)
const DELETE_URL   = '/api/delete-ocr';

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
const ocrModal      = document.getElementById('ocrEditModal');
const ocrTextArea   = document.getElementById('ocrEditText');
const ocrBtnClose   = document.getElementById('ocrEditClose');
const ocrBtnCancel  = document.getElementById('ocrEditCancel');
const ocrBtnSave    = document.getElementById('ocrEditSave');
let   EDIT_IDX      = null; // índice no array RESULTS da linha a editar

// ---- Estado ----
let RESULTS = [];  // [{id, timestamp, text, eurocode}, ...]

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
// Normalização (ajusta aqui se os nomes do backend diferirem)
// =========================
function normalizeRow(r){
  return {
    id:          r.id ?? r.rowId ?? r.uuid ?? r._id ?? null,
    timestamp:   r.timestamp ?? r.datahora ?? r.created_at ?? r.createdAt ?? '',
    text:        r.text ?? r.ocr_text ?? r.ocr ?? '',
    eurocode:    r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? ''
  };
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
    try { return await tryOnce(OCR_ENDPOINT); }
    catch { return await tryOnce('/.netlify/functions/ocr-proxy'); }
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
// BD: listar, guardar, atualizar (só OCR), apagar
// =========================
async function fetchServerRows(){
  const res = await fetch(LIST_URL, { headers:{'Accept':'application/json'} });
  if (!res.ok) throw new Error('LIST HTTP '+res.status);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : (data.rows || data.items || []);
  return rows.map(normalizeRow);
}

async function saveRowToServer({ text, eurocode, timestamp }){
  const payload = { text, eurocode, timestamp };
  const res = await fetch(SAVE_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('SAVE HTTP '+res.status);
  return normalizeRow(await res.json().catch(()=>payload));
}

// >>> Ponto crítico: EDITAR SÓ OCR, preservando o resto (para backends que "substituem" o registo)
async function updateOCRInServer(row){
  const payload = {
    id: row.id,
    text: row.text,            // OCR novo
    eurocode: row.eurocode,    // preserva
    euro_validado: row.eurocode, // se o backend usar este nome, preserva também
    timestamp: row.timestamp   // preserva
  };
  const res = await fetch(UPDATE_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('UPDATE HTTP '+res.status);
  return await res.json().catch(()=>({ok:true}));
}

async function deleteRowInServer(id){
  const res = await fetch(DELETE_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('DELETE HTTP '+res.status);
  return await res.json().catch(()=>({ok:true}));
}

// =========================
// Render Desktop + Ações
// =========================
function renderTable() {
  resultsBody.innerHTML = '';
  RESULTS.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${row.timestamp || ''}</td>
      <td class="ocr-text">${(row.text || '')}</td>
      <td>${row.eurocode || ''}</td>
      <td>
        <button class="btn btn-mini" onclick="openOCREdit(${idx})" title="Editar OCR">✏️</button>
        <button class="btn btn-mini danger" onclick="deleteRowUI(${idx})" title="Apagar">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  renderMobileEuroList();   // atualiza lista mobile
}

async function deleteRowUI(idx){
  const row = RESULTS[idx];
  if (!row?.id) { showToast('Linha sem ID', 'error'); return; }
  if (!confirm('Apagar este registo?')) return;
  try{
    await deleteRowInServer(row.id);
    RESULTS = await fetchServerRows();
    renderTable();
    showToast('Registo apagado', 'success');
  }catch(e){
    console.error(e);
    showToast('Erro ao apagar', 'error');
  }
}

// =========================
// Modal: abrir/fechar/guardar (SÓ OCR)
// =========================
function openOCREdit(idx){
  const row = RESULTS[idx];
  if (!row) return;
  EDIT_IDX = idx;
  if (ocrTextArea) ocrTextArea.value = row.text || '';
  if (ocrModal){
    ocrModal.classList.remove('hidden');
    ocrModal.setAttribute('aria-hidden','false');
  }
  setTimeout(()=> ocrTextArea?.focus(), 50);
}
function closeOCREdit(){
  EDIT_IDX = null;
  if (ocrModal){
    ocrModal.classList.add('hidden');
    ocrModal.setAttribute('aria-hidden','true');
  }
}
ocrBtnClose?.addEventListener('click', closeOCREdit);
ocrBtnCancel?.addEventListener('click', closeOCREdit);
ocrModal?.addEventListener('click', (e)=>{ if(e.target.dataset.close) closeOCREdit(); });
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && !ocrModal?.classList.contains('hidden')) closeOCREdit(); });

ocrBtnSave?.addEventListener('click', async () => {
  if (EDIT_IDX === null) return;
  const row = RESULTS[EDIT_IDX];
  const novoText = ocrTextArea?.value ?? '';
  try{
    setStatus(desktopStatus, 'A guardar…');
    await updateOCRInServer({ ...row, text: novoText }); // atualiza SÓ OCR na BD
    RESULTS = await fetchServerRows();
    renderTable();
    setStatus(desktopStatus, 'OCR atualizado', 'success');
    showToast('Texto lido (OCR) atualizado ✅', 'success');
    closeOCREdit();
  }catch(e){
    console.error(e);
    setStatus(desktopStatus, 'Erro ao guardar', 'error');
    showToast('Erro ao atualizar OCR','error');
  }
});

// =========================
/* Histórico Mobile — Eurocodes da BD */
// =========================
function renderMobileEuroList(){
  if (!mobileHistoryList) return;
  if (!RESULTS.length){
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há Eurocodes guardados.</p>';
    return;
  }
  const codes = RESULTS
    .map(r => (r.eurocode || '').toString().trim())
    .filter(Boolean);
  if (!codes.length){
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há Eurocodes guardados.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  codes.forEach(c=>{
    const div = document.createElement('div');
    div.className = 'history-item-text';
    div.textContent = c.split(/\s+/)[0]; // só o código
    frag.appendChild(div);
  });
  mobileHistoryList.innerHTML = '';
  mobileHistoryList.appendChild(frag);
}

// =========================
// Upload Desktop -> OCR -> Eurocode -> GUARDA NA BD
// =========================
btnUpload?.addEventListener('click', ()=> fileInput.click());
fileInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  setStatus(desktopStatus, '⏳ A processar…');

  try{
    const buf = await f.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mime = f.type || 'image/png';
    const img64 = `data:${mime};base64,${base64}`;

    const text = await runOCR(img64);
    const euro = extractEurocode(text);
    if (!euro){
      setStatus(desktopStatus, 'Sem Eurocode válido', 'error');
      showToast('Nenhum Eurocode válido encontrado','error');
      return;
    }

    const ts = new Date().toLocaleString('pt-PT');
    await saveRowToServer({ text, eurocode: euro, timestamp: ts });
    RESULTS = await fetchServerRows();
    renderTable();
    setStatus(desktopStatus, 'Guardado ✅', 'success');
    showToast('Eurocode adicionado ✅','success');
  }catch(err){
    console.error(err);
    setStatus(desktopStatus, 'Erro no processo', 'error');
    showToast('Erro ao guardar','error');
  }finally{
    e.target.value = '';
  }
});

// =========================
// Câmera Mobile -> OCR -> Eurocode -> GUARDA NA BD
// =========================
btnCamera?.addEventListener('click', ()=> cameraInput.click());
cameraInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  setStatus(mobileStatus, '⏳ A processar…');

  try{
    const buf = await f.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mime = f.type || 'image/png';
    const img64 = `data:${mime};base64,${base64}`;

    const text = await runOCR(img64);
    const euro = extractEurocode(text);
    if (!euro){
      setStatus(mobileStatus, 'Sem Eurocode válido', 'error');
      showToast('Nenhum Eurocode válido encontrado','error');
      return;
    }

    const ts = new Date().toLocaleString('pt-PT');
    await saveRowToServer({ text, eurocode: euro, timestamp: ts });
    RESULTS = await fetchServerRows();
    renderTable();
    setStatus(mobileStatus, 'Guardado ✅', 'success');
    showToast('Eurocode guardado ✅','success');
  }catch(err){
    console.error(err);
    setStatus(mobileStatus, 'Erro no processo', 'error');
    showToast('Erro ao guardar','error');
  }finally{
    e.target.value = '';
  }
});

// =========================
/* Exportar CSV (da BD carregada) */
// =========================
btnExport?.addEventListener('click', async () => {
  try{
    if (!RESULTS.length) RESULTS = await fetchServerRows();
    if (!RESULTS.length){
      showToast('Não há dados para exportar','error');
      return;
    }
    const rows = [
      ['#','Data/Hora','Texto','Eurocode'],
      ...RESULTS.map((r,i)=> [i+1, r.timestamp||'', r.text||'', r.eurocode||''])
    ];
    const csv = rows.map(r => r.map(c => `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'capturas.csv'; a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    showToast('Erro ao exportar','error');
  }
});

// =========================
/* Limpar Tabela (só UI; não apaga BD) */
// =========================
btnClear?.addEventListener('click', async () => {
  if (!confirm('Queres limpar apenas a vista local? (Isto não apaga na BD)')) return;
  RESULTS = [];
  renderTable();
  showToast('Vista limpa (BD intacta)','success');
});

// =========================
// Bootstrap
// =========================
(async function init(){
  try{
    setStatus(desktopStatus, 'A carregar…');
    RESULTS = await fetchServerRows();
    renderTable();
    setStatus(desktopStatus, '');
  }catch(e){
    console.error(e);
    setStatus(desktopStatus, 'Erro a carregar dados', 'error');
  }
})();