// APP.JS (BD + Editar só OCR sem tocar no Eurocode)
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/api/ocr-proxy';     // fallback Netlify mais abaixo
const LIST_URL     = '/api/list-ocr';
const SAVE_URL     = '/api/save-ocr';
const UPDATE_URL   = '/api/update-ocr';    // EDITA SÓ OCR (mas enviamos os outros campos para não os perder)
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
/* Normalização MELHORADA (ajusta aqui se os nomes do backend diferirem) */
// =========================
function normalizeRow(r){
  // Debug: mostrar que dados estão a chegar (remover depois de testar)
  console.log('Dados recebidos do servidor:', r);

  // Tentar encontrar a timestamp em vários campos possíveis (inclui "ts")
  let timestamp = r.timestamp || r.ts || r.datahora || r.created_at || r.createdAt ||
                  r.date || r.datetime || r.data || r.hora || r.created ||
                  r.updated_at || r.updatedAt || '';

  // Se não encontrou timestamp, criar uma nova (fallback)
  if (!timestamp) {
    console.warn('Nenhuma timestamp encontrada nos dados, usando timestamp atual');
    timestamp = new Date().toLocaleString('pt-PT');
  }

  // Se a timestamp é um número (Unix timestamp), converter
  if (typeof timestamp === 'number') {
    timestamp = new Date(timestamp).toLocaleString('pt-PT');
  }

  // Se a timestamp é uma string ISO, converter para formato português
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
    eurocode:    r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? r.codigo ?? ''
  };

  // Debug: mostrar dados normalizados
  console.log('Dados normalizados:', normalized);

  return normalized;
}

// =========================
// OCR (enviar como multipart/form-data)
// =========================
async function runOCR(imageBase64) {
  // Converte dataURL -> Blob
  function dataURLtoBlob(dataURL){
    const [meta, b64] = dataURL.split(',');
    const mime = (meta.match(/data:(.*?);/) || [,'image/png'])[1];
    const bin = atob(b64);
    const len = bin.length;
    const u8 = new Uint8Array(len);
    for (let i=0; i<len; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  async function tryOnce(url){
    const blob = dataURLtoBlob(imageBase64);
    const fd = new FormData();
    fd.append('file', blob, 'photo.jpg');

    const res = await fetch(url, { method:'POST', body: fd });
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

  // Debug: mostrar resposta completa do servidor
  console.log('Resposta completa do servidor:', data);

  const rows = Array.isArray(data) ? data : (data.rows || data.items || data.data || []);
  console.log('Linhas extraídas:', rows);

  return rows.map(normalizeRow);
}

async function saveRowToServer({ text, eurocode, timestamp }){
  // Alinha com o teu save-ocr.mjs — usa euro_validado e ts
  const payload = {
    ts: timestamp || new Date().toLocaleString('pt-PT'),
    text,
    euro_validado: eurocode,
    filename: 'camera',
    source: 'webapp'
  };

  console.log('Enviando para o servidor:', payload);

  const res = await fetch(SAVE_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('SAVE HTTP '+res.status);

  const result = await res.json().catch(()=>payload);
  console.log('Resposta do servidor após guardar:', result);

  // Normaliza o que voltou (result.row ou o próprio result)
  const row = result.row || result;
  return normalizeRow({
    id: row.id,
    ts: row.ts,
    text: row.text,
    euro_validado: row.euro_validado
  });
}

// >>> EDITAR SÓ OCR, PRESERVANDO EUROCODE/TIMESTAMP <<<
async function updateOCRInServer(row){
  const payload = {
    id: row.id,
    text: row.text,                        // novo OCR
    euro_validado: row.eurocode,           // preserva o eurocode
    ts: row.timestamp                      // preserva o timestamp
  };

  console.log('Atualizando no servidor:', payload);

  const res = await fetch(UPDATE_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('UPDATE HTTP '+res.status);

  const result = await res.json().catch(()=>({ok:true}));
  console.log('Resposta do servidor após atualizar:', result);

  return result;
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

    // Debug: verificar se a timestamp existe
    const displayTimestamp = row.timestamp || 'Sem data';
    console.log(`Linha ${idx + 1} - Timestamp:`, displayTimestamp);

    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${displayTimestamp}</td>
      <td class="ocr-text">${(row.text || '')}</td>
      <td>${row.eurocode || ''}</td>
      <td>
        <button class="btn btn-mini" onclick="editOCR(${idx})" title="Editar OCR">✏️</button>
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
// Editar APENAS OCR (com modal personalizado)
// =========================
async function editOCR(idx){
  const row = RESULTS[idx];
  if (!row) return;

  currentEditingRow = row;
  const atual = row.text || '';

  try {
    // Mostrar o modal e aguardar resposta
    const novo = await showEditOcrModal(atual);

    if (novo === null) {
      // Utilizador cancelou
      currentEditingRow = null;
      return;
    }

    // Atualizar o texto
    const updated = { ...row, text: novo };
    setStatus(desktopStatus, 'A guardar…');

    await updateOCRInServer(updated);
    RESULTS = await fetchServerRows();
    renderTable();

    setStatus(desktopStatus, 'OCR atualizado', 'success');
    showToast('Texto lido (OCR) atualizado ✅','success');

  } catch(e) {
    console.error(e);
    setStatus(desktopStatus, 'Erro ao guardar', 'error');
    showToast('Erro ao atualizar OCR','error');
  } finally {
    currentEditingRow = null;
  }
}

// =========================
// Histórico Mobile — Eurocodes da BD
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
    console.log('Timestamp criada:', ts);

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
/* Câmera Mobile -> OCR -> Eurocode -> GUARDA NA BD */
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
    console.log('Timestamp criada (mobile):', ts);

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
// Modal de Ajuda (abrir/fechar)
// =========================
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const helpBtnDesktop = document.getElementById('helpBtnDesktop');
const helpClose = document.getElementById('helpClose');

function showHelpModal() { if (helpModal) helpModal.classList.add('show'); }
function hideHelpModal() { if (helpModal) helpModal.classList.remove('show'); }

helpBtn?.addEventListener('click', showHelpModal);
helpBtnDesktop?.addEventListener('click', showHelpModal);
helpClose?.addEventListener('click', hideHelpModal);
helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) hideHelpModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && helpModal?.classList.contains('show')) hideHelpModal(); });

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
