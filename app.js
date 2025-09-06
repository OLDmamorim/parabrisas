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
// Funções do Modal de Edição OCR
// =========================
function showEditOcrModal(text) {
  return new Promise((resolve) => {
    if (!editOcrModal || !editOcrTextarea) {
      resolve(null);
      return;
    }

    // Preencher o textarea com o texto atual
    editOcrTextarea.value = text || '';
    
    // Mostrar o modal
    editOcrModal.classList.add('show');
    
    // Focar no textarea e posicionar cursor no final
    setTimeout(() => {
      editOcrTextarea.focus();
      editOcrTextarea.setSelectionRange(editOcrTextarea.value.length, editOcrTextarea.value.length);
    }, 100);

    // Função para fechar o modal
    function closeModal(result) {
      editOcrModal.classList.remove('show');
      resolve(result);
    }

    // Event listeners temporários
    function handleSave() {
      const newText = editOcrTextarea.value;
      cleanup();
      closeModal(newText);
    }

    function handleCancel() {
      cleanup();
      closeModal(null);
    }

    function handleKeydown(e) {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    }

    function handleBackdropClick(e) {
      if (e.target === editOcrModal) {
        handleCancel();
      }
    }

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
  });
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

// >>> AQUI ESTÁ O PONTO CRÍTICO: EDITAR SÓ OCR, PRESERVANDO O RESTO <<<
// Muitos backends fazem "replace" do registo inteiro no update.
// Para não perder o eurocode, enviamos também eurocode/timestamp INALTERADOS.
async function updateOCRInServer(row){
  const payload = {
    id: row.id,
    // OCR novo:
    text: row.text,
    // Campos preservados (mesmos nomes que teu backend aceita; duplica onde for comum):
    eurocode: row.eurocode,
    euro_validado: row.eurocode,
    timestamp: row.timestamp
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
// Event Listeners para Modal de Ajuda
// =========================
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const helpBtnDesktop = document.getElementById('helpBtnDesktop');
const helpClose = document.getElementById('helpClose');

function showHelpModal() {
  if (helpModal) {
    helpModal.classList.add('show');
  }
}

function hideHelpModal() {
  if (helpModal) {
    helpModal.classList.remove('show');
  }
}

// Event listeners para o modal de ajuda
helpBtn?.addEventListener('click', showHelpModal);
helpBtnDesktop?.addEventListener('click', showHelpModal);
helpClose?.addEventListener('click', hideHelpModal);

// Fechar modal ao clicar no backdrop
helpModal?.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    hideHelpModal();
  }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (helpModal?.classList.contains('show')) {
      hideHelpModal();
    }
  }
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

/* ========= PESQUISA ULTRA-LEVE (desktop) ========= */
(function initTableSearch() {
  function norm(s=''){ return s.toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase(); }

  function mount() {
    const toolbar = document.querySelector('.toolbar');
    const tbody = document.querySelector('#resultsTable tbody, #resultsBody');
    if (!toolbar || !tbody) return false;

    // Evitar duplicar se já existir
    if (toolbar.querySelector('[data-role="table-search"]')) return true;

    const wrap = document.createElement('div');
    wrap.style.marginLeft = 'auto';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Pesquisar… (/ foca, Esc limpa)';
    input.autocomplete = 'off';
    input.setAttribute('data-role','table-search');
    Object.assign(input.style, {
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.15)',
      color: 'inherit',
      padding: '10px 12px',
      borderRadius: '12px',
      minWidth: '220px',
      outline: 'none'
    });
    input.addEventListener('focus', () => {
      input.style.boxShadow = '0 0 0 3px rgba(34,211,238,.12)';
      input.style.borderColor = 'rgba(34,211,238,1)';
    });
    input.addEventListener('blur', () => {
      input.style.boxShadow = 'none';
      input.style.borderColor = 'rgba(255,255,255,0.15)';
    });

    wrap.appendChild(input);
    toolbar.appendChild(wrap);

    function applyFilter(){
      const q = norm(input.value);
      const rows = Array.from(tbody.querySelectorAll('tr'));
      for (const tr of rows){
        const c3 = tr.querySelector('td:nth-child(3)');
        const c4 = tr.querySelector('td:nth-child(4)');
        const t3 = norm(c3 ? (c3.innerText || c3.textContent) : '');
        const t4 = norm(c4 ? (c4.innerText || c4.textContent) : '');
        const match = !q || t3.includes(q) || t4.includes(q);
        tr.style.display = match ? '' : 'none';
      }
    }

    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', (e)=>{
      if(e.key==='Escape'){ input.value=''; applyFilter(); }
    });
    document.addEventListener('keydown', (e)=>{
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if(e.key==='/' && tag!=='input' && tag!=='textarea' && !e.ctrlKey && !e.metaKey && !e.altKey){
        e.preventDefault(); input.focus(); input.select();
      }
    });

    // 1ª aplicação caso já existam linhas
    applyFilter();
    return true;
  }

  // Monta quando o DOM estiver pronto (e tenta novamente se a tabela chegar mais tarde)
  if (!mount()){
    document.addEventListener('DOMContentLoaded', mount);
    // Tenta mais 10x a cada 300ms (para casos em que as linhas chegam via fetch após load)
    let tries = 0;
    const iv = setInterval(()=>{
      if (mount() || ++tries >= 10) clearInterval(iv);
    }, 300);
  }
})();

/* ========= BACKFILL Data/Hora (só se estiver vazia) =========
   Nota: isto NÃO altera nada se a tua app já escreve o timestamp.
*/
(function backfillTimestampsIfMissing(){
  function nowPT(){
    try{
      return new Date().toLocaleString('pt-PT', {
        year:'2-digit', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      });
    }catch(_){ return new Date().toISOString(); }
  }
  function fill(){
    const tbody = document.querySelector('#resultsTable tbody, #resultsBody');
    if(!tbody) return false;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if(!rows.length) return false;
    let changed = false;
    for(const tr of rows){
      const tdDate = tr.querySelector('td:nth-child(2)');
      // se a célula existir e estiver vazia, preenche
      if (tdDate && !tdDate.textContent.trim()){
        tdDate.textContent = nowPT();
        changed = true;
      }
    }
    return changed;
  }
  if (!fill()){
    // tenta de novo algumas vezes (conteúdo pode chegar via fetch)
    let tries = 0;
    const iv = setInterval(()=>{
      if (fill() || ++tries >= 10) clearInterval(iv);
    }, 300);
  }
})();

/* ===== DEBUG MOBILE: mostrar erro detalhado do SAVE no ecrã ===== */
(function patchSaveForMobileDebug(){
  if (window.__saveDebugPatched) return;
  window.__saveDebugPatched = true;

  const originalSave = window.saveRowToServer;

  async function readBodySafe(res){
    try{
      const txt = await res.text();
      try { return JSON.stringify(JSON.parse(txt), null, 2); } catch { return txt; }
    }catch{ return '<sem corpo>'; }
  }

  window.saveRowToServer = async function ({ text, eurocode, timestamp }){
    const payload = { text, eurocode, timestamp };
    try{
      const res = await fetch(SAVE_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok){
        const body = await readBodySafe(res);
        const msg =
`❌ Erro ao guardar
URL: ${SAVE_URL}
HTTP: ${res.status} ${res.statusText}
Payload: ${JSON.stringify(payload)}
Resposta do servidor:
${body}`;
        // mostra em alerta (bom para telemóvel) e também no status
        try { alert(msg.slice(0, 1500)); } catch {}
        (window.mobileStatus || window.desktopStatus) && setStatus(mobileStatus || desktopStatus, msg, 'error');
        throw new Error(msg);
      }

      const data = await res.json().catch(()=>payload);
      return normalizeRow(data);

    }catch(err){
      const msg = (err && err.message) ? err.message : String(err);
      try { alert(('❌ EXCEÇÃO SAVE\n' + msg).slice(0,1500)); } catch {}
      (window.mobileStatus || window.desktopStatus) && setStatus(mobileStatus || desktopStatus, msg, 'error');
      showToast('Falha ao guardar', 'error');
      throw err;
    }
  };
})();