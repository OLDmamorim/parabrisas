// APP.JS (BD + Editar só OCR sem tocar no Eurocode) — versão com correção da captura de foto
// ==========================================================================

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
      editOcrTextarea.setSelectionRange(
        editOcrTextarea.value.length,
        editOcrTextarea.value.length
      );
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
// Normalização MELHORADA (ajusta aqui se os nomes do backend diferirem)
// =========================
function normalizeRow(r){
  // Tentar encontrar a timestamp em vários campos possíveis
  let timestamp = r.timestamp || r.datahora || r.created_at || r.createdAt ||
                  r.date || r.datetime || r.data || r.hora || r.created ||
                  r.updated_at || r.updatedAt || '';

  // Se não encontrou timestamp, criar uma nova (fallback)
  if (!timestamp) {
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
      // ignora erro
    }
  }

  return {
    id:        r.id ?? r.rowId ?? r.uuid ?? r._id ?? null,
    timestamp: timestamp,
    text:      r.text ?? r.ocr_text ?? r.ocr ?? r.texto ?? '',
    eurocode:  r.euro_validado ?? r.euro_user ?? r.euroUser ?? r.eurocode ?? r.euro ?? r.codigo ?? ''
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
  const rows = Array.isArray(data) ? data : (data.rows || data.items || data.data || []);
  return rows.map(normalizeRow);
}

async function saveRowToServer({ text, eurocode, timestamp }){
  const payload = {
    text,
    eurocode,
    timestamp: timestamp || new Date().toLocaleString('pt-PT')
  };
  const res = await fetch(SAVE_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('SAVE HTTP '+res.status);
  const result = await res.json().catch(()=>payload);
  return normalizeRow(result);
}

// >>> AQUI ESTÁ O PONTO CRÍTICO: EDITAR SÓ OCR, PRESERVANDO O RESTO <<<
async function updateOCRInServer(row){
  const payload = {
    id: row.id,
    text: row.text,
    eurocode: row.eurocode,
    euro_validado: row.eurocode,
    timestamp: row.timestamp,
    datahora: row.timestamp
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
    const displayTimestamp = row.timestamp || 'Sem data';
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
  renderMobileEuroList();
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
// Histórico Mobile — Eurocodes da BD (mostra as últimas 5)
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
  const last5 = codes.slice(-5).reverse();
  const frag = document.createDocumentFragment();
  last5.forEach(c => {
    const div = document.createElement('div');
    div.className = 'history-item-text';
    div.textContent = c.split(/\s+/)[0];
    frag.appendChild(div);
  });
  mobileHistoryList.innerHTML = '';
  mobileHistoryList.appendChild(frag);
}

// =========================
// Upload Desktop -> OCR -> Eurocode -> GUARDA NA BD
// =========================
btnUpload?.addEventListener('click', () => fileInput.click());
fileInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  setStatus(desktopStatus, '⏳ A processar…');
  try{
    // Lê o ficheiro como DataURL para evitar estouro de stack com fotos grandes
    const img64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
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
btnCamera?.addEventListener('click', () => cameraInput.click());
cameraInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  setStatus(mobileStatus, '⏳ A processar…');
  try{
    // Lê o ficheiro como DataURL para evitar estouro de stack com fotos grandes
    const img64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
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
    const csv = rows.map(r => r.map(c =>
      `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
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