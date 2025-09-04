/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";   // <- editar no Neon
const DEMO_MODE    = false;

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";

const cameraBtn     = document.getElementById("btnCamera");
const cameraInput   = document.getElementById("cameraInput");
const mobileStatus  = document.getElementById("mobileStatus");
const uploadBtn     = document.getElementById("btnUpload");
const fileInput     = document.getElementById("fileInput");
const exportBtn     = document.getElementById("btnExport");
const clearBtn      = document.getElementById("btnClear");
const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");
const toast         = document.getElementById("toast");

/* ===== CSS para texto corrido ===== */
(function(){
  const id = "ocr-text-style";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .ocr-text{ white-space: normal; overflow-wrap:anywhere; line-height:1.4 }
    .error { background:#300; color:#fff; padding:6px; border-radius:6px }
    .progress { background:#222; height:6px; border-radius:3px; margin-top:4px }
    .progress span{ display:block; height:100%; background:#3b82f6; border-radius:3px }
    .btn-icon { cursor:pointer; border:none; background:none; font-size:16px }
    .cell-wrap.editing{ outline:2px solid #3b82f6; border-radius:6px; padding:2px 4px; background:rgba(59,130,246,.08); }
    .col-actions .btn.btn-mini{ margin-right:6px }
  `;
  document.head.appendChild(s);
})();

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== Helpers UI ===== */
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2200);
}
function statusEl(){ return isDesktop ? desktopStatus : mobileStatus; }
function setStatus(html, opts={}) {
  const el = statusEl();
  el.classList.toggle("error", !!opts.error);
  el.innerHTML = html || "";
}
function showProgress(label, pct=0, asError=false){
  const el = statusEl();
  el.classList.toggle("error", !!asError);
  el.innerHTML = `
    <div>${label}</div>
    <div class="progress"><span style="width:${pct}%"></span></div>
  `;
}
function updateProgress(pct){
  const el = statusEl();
  const bar = el.querySelector(".progress > span");
  if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
}
function showError(message){
  const el = statusEl();
  el.classList.add("error");
  el.innerHTML = `
    <div>❌ ${message}</div>
    <div class="progress"><span style="width:0%"></span></div>
    <button class="retry-btn" id="retryBtn">🔄 Tentar novamente</button>
  `;
  document.getElementById("retryBtn")?.addEventListener("click", ()=> lastFile && handleImage(lastFile, "retry"));
}

/* ===== Cabeçalho da tabela ===== */
function ensureActionsHeader() {
  if (!isDesktop) return;
  const thead = document.querySelector("#resultsTable thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr>
      <th style="width:60px">#</th>
      <th style="width:220px">Data/Hora</th>
      <th style="width:auto">Texto lido (OCR)</th>
      <th style="width:180px">Eurocode</th>
      <th style="width:140px">Ações</th>
    </tr>
  `;
}

/* ===== API Neon ===== */
async function fetchServerRows(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const { rows } = await r.json();
  return rows.map(x => ({
    id: x.id,
    ts: new Date(x.ts).getTime(),
    text: x.text || '',
    filename: x.filename || '',
    source: x.source || ''
  }));
}
async function persistToDB({ ts, text, filename, origin }) {
  const resp = await fetch(SAVE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ts, text, filename, source: origin })
  });
  const txt = await resp.text().catch(()=>resp.statusText);
  if(!resp.ok) throw new Error(txt || ('HTTP ' + resp.status));
}
async function deleteFromDB(id){
  const resp = await fetch(DELETE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error) throw new Error(data?.error || ('HTTP ' + resp.status));
  return true;
}
/* Atualizar no Neon */
async function updateInDB(id, text){
  const resp = await fetch(UPDATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error || !data?.ok) throw new Error(data?.error || ('HTTP ' + resp.status));
  return data.row;
}

/* ===== Extração de EUROCODE a partir do texto OCR ===== */
function extractEurocode(text='') {
  const EUROCODE_REGEX = /^[0-9]{4}[A-Z0-9]{5,8}$/;
  const normalize = (s) => s.toUpperCase()
    .replaceAll('O','0').replaceAll('I','1').replaceAll('S','5').replaceAll('B','8')
    .replace(/[^A-Z0-9\s]/g,' ');
  const toks = (text||'').toUpperCase().split(/[\s\r\n]+/).filter(Boolean);
  let hit = toks.find(t => EUROCODE_REGEX.test(t));
  if (hit) return hit;
  const clean = normalize(text);
  return clean.split(/\s+/).find(t => EUROCODE_REGEX.test(t)) || '';
}

/* ===== Render da tabela ===== */
function renderTable(){
  if(!isDesktop) return;
  ensureActionsHeader();
  resultsBody.innerHTML = "";
  RESULTS.forEach((r,i)=>{
    const txt  = (r.text || "").replace(/\s*\n\s*/g, " ");
    const euro = extractEurocode(r.text || "");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${txt}</div></td>
      <td><div class="ocr-text">${euro}</div></td>
      <td>
        <button class="btn-icon editBtn" title="Editar" data-id="${r.id}">✏️</button>
        <button class="btn-icon delBtn"  title="Apagar" data-id="${r.id}">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* Delegação — editar e apagar */
resultsBody?.addEventListener("click", async (e)=>{
  const editBtn = e.target.closest(".editBtn");
  const delBtn  = e.target.closest(".delBtn");

  // EDITAR
  if (editBtn) {
    const id = Number(editBtn.dataset.id);
    if (!id) return;

    const rowEl = editBtn.closest('tr');
    const currentText = rowEl.querySelector('.ocr-text')?.innerText || '';

    const newText = prompt('Editar texto lido (OCR):', currentText);
    if (newText === null) return; // cancelou

    try{
      editBtn.disabled = true; editBtn.textContent = '…';
      await updateInDB(id, newText);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast('Registo atualizado.');
    }catch(err){
      console.error(err);
      showToast('Falha ao atualizar: ' + (err.message || 'erro'));
    }finally{
      editBtn.disabled = false; editBtn.textContent = '✏️';
    }
    return;
  }

  // APAGAR
  if(!delBtn) return;
  const id = Number(delBtn.dataset.id);
  if(!id) return;
  if(!confirm("Apagar este registo da base de dados?")) return;

  const old = delBtn.textContent;
  delBtn.disabled = true; delBtn.textContent = "…";
  try{
    await deleteFromDB(id);
    RESULTS = await fetchServerRows();
    renderTable();
    showToast("Registo apagado.");
  }catch(err){
    console.error(err);
    showToast("Falha ao apagar: " + (err.message || "erro"));
  }finally{
    delBtn.disabled = false; delBtn.textContent = old;
  }
});

/* ===== OCR ===== */
async function optimizeImageForOCR(file){
  const srcBlob = file instanceof Blob ? file : new Blob([file]);
  const bmp = await createImageBitmap(srcBlob);
  const scale = Math.min(1600 / bmp.width, 1600 / bmp.height, 1);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bmp, 0, 0, w, h);
  const out = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
  return new File([out], (file.name || 'foto') + '.jpg', { type: 'image/jpeg' });
}
async function runOCR(file){
  if (DEMO_MODE){
    await new Promise(r=>setTimeout(r, 500));
    return { text: "DEMO: Texto simulado de OCR\nLinha 2: 123 ABC" };
  }
  const optimized = await optimizeImageForOCR(file);
  const fd = new FormData();
  fd.append("file", optimized, optimized.name);
  const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });
  const t = await res.text().catch(()=>res.statusText);
  if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
  return JSON.parse(t);
}

/* ===== OCR EUROCODE local (Tesseract) ===== */
async function ensureTesseract() {
  if (window.Tesseract) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
    s.onload = res; s.onerror = () => rej(new Error('Falha a carregar Tesseract'));
    document.head.appendChild(s);
  });
}
let _tessWorker = null;
async function ocrImageEuro(file) {
  await ensureTesseract();
  const worker = _tessWorker || ( _tessWorker = await window.Tesseract.createWorker() );
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  await worker.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    user_defined_dpi: '300',
    preserve_interword_spaces: '1'
  });
  const prepped = await optimizeImageForOCR(file);
  const { data } = await worker.recognize(prepped);
  await worker.clear();
  const raw = (data.text || '').trim();
  const euro = extractEurocode(raw);
  const conf = (data.confidence || 0) / 100;
  return { raw, euro, conf };
}

/* ===== Fluxo ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 10);
    await new Promise(r=>setTimeout(r, 150));

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
      id: Date.now().toString(),
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    showProgress("A gravar no Neon…", 90);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    RESULTS = await fetchServerRows();
    renderTable();

    showProgress("Concluído ✅", 100);
    setTimeout(()=> setStatus(""), 400);
    showToast("OCR concluído");
  }catch(err){
    console.error(err);
    showError(err.message || "Erro inesperado");
    showToast("Falha no OCR");
  }
}

/* ===== Bootstrap ===== */
(async function(){
  if(!isDesktop) return;
  try { RESULTS = await fetchServerRows(); }
  catch(e){ console.warn("Sem Neon:", e.message); RESULTS = []; }
  renderTable();
})();

/* ===== Ações ===== */
cameraBtn?.addEventListener("click", () => cameraInput.click());

cameraInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const mode = (window.OCR_MODE || 'ocr');
  const when = Date.now();

  try{
    if (mode === 'euro') {
      // OCR local com Tesseract e extração do Eurocode
      showProgress("EUROCODE: a ler localmente…", 40);
      const { raw, euro, conf } = await ocrImageEuro(file);

      if (!euro) {
        showError('Não encontrei um EUROCODE válido (4 dígitos + 5–8 A/Z/0–9).');
        showToast('⚠️ EUROCODE não detetado', 'error');
        e.target.value = "";
        return;
      }

      // Guardar apenas o texto completo no Neon (como antes)
      await persistToDB({ ts: when, text: raw, filename: file.name || "captura.jpg", origin: "camera-euro" });

      // Atualizar vista
      RESULTS = await fetchServerRows();
      renderTable();

      setStatus("Concluído ✅", { success:true });
      showToast(`EUROCODE: ${euro} • ${Math.round(conf*100)}%`, 'success');
    } else {
      // Fluxo normal (endpoint)
      await handleImage(file, "camera");
    }
  }catch(err){
    console.error(err);
    showError(err.message || 'Erro no OCR');
    showToast('Falha no OCR', 'error');
  }finally{
    cameraInput.value = "";
  }
});

uploadBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await handleImage(file, "upload");
  fileInput.value = "";
});

/* ===== Exportar CSV (com coluna Eurocode) ===== */
exportBtn?.addEventListener("click", async () => {
  if(!RESULTS.length) return showToast("Nada para exportar");
  const header = ["idx","timestamp","ocr_text","eurocode"];
  const lines = [header.join(",")].concat(
    RESULTS.map((r,i)=>{
      const euro = extractEurocode(r.text||"");
      return [
        i+1,
        new Date(r.ts).toISOString(),
        `"${(r.text||"").replace(/"/g,'""')}"`,
        `"${(euro||"").replace(/"/g,'""')}"`
      ].join(",");
    })
  );
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "express_ocr.csv"; a.click();
  URL.revokeObjectURL(url);
});

/* ===== Limpar vista ===== */
clearBtn?.addEventListener("click", ()=>{
  RESULTS = [];
  renderTable();
  showToast("Vista limpa (dados no Neon mantidos)");
});

/* ===== MODAL DE AJUDA ===== */
const helpModal = document.getElementById("helpModal");
const helpBtn = document.getElementById("helpBtn");
const helpBtnDesktop = document.getElementById("helpBtnDesktop");
const helpClose = document.getElementById("helpClose");

function showHelpModal() { helpModal?.classList.add("show"); }
function hideHelpModal() { helpModal?.classList.remove("show"); }
helpBtn?.addEventListener("click", showHelpModal);
helpBtnDesktop?.addEventListener("click", showHelpModal);
helpClose?.addEventListener("click", hideHelpModal);
helpModal?.addEventListener("click", (e) => { if (e.target === helpModal) hideHelpModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && helpModal?.classList.contains("show")) hideHelpModal();
});

/* ===== FEEDBACK VISUAL MELHORADO (mantido) ===== */
function showToastWithType(msg, type = 'info') {
  toast.textContent = msg;
  toast.classList.remove('success', 'error');
  if (type === 'success') toast.classList.add('success');
  else if (type === 'error') toast.classList.add('error');
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}
function setCardState(state) {
  const card = isDesktop ? document.getElementById("desktopView") : document.getElementById("mobileView");
  card.classList.remove('success', 'error');
  if (state === 'success') { card.classList.add('success'); setTimeout(() => card.classList.remove('success'), 3000); }
  else if (state === 'error') { card.classList.add('error'); setTimeout(() => card.classList.remove('error'), 3000); }
}
function addFeedbackIcon(message, type) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  return `<span class="feedback-icon">${icons[type] || icons.info}</span>${message}`;
}
function animateCameraButton(state) {
  if (!cameraBtn) return;
  cameraBtn.classList.remove('pulse');
  if (state === 'processing') {
    cameraBtn.style.transform = 'scale(0.95)';
    cameraBtn.style.opacity = '0.7';
  } else if (state === 'success') {
    cameraBtn.style.transform = 'scale(1.05)'; cameraBtn.style.borderColor = 'var(--success)';
    setTimeout(() => { cameraBtn.style.transform = ''; cameraBtn.style.borderColor = ''; cameraBtn.classList.add('pulse'); }, 1000);
  } else if (state === 'error') {
    cameraBtn.style.transform = 'scale(1.05)'; cameraBtn.style.borderColor = 'var(--danger)';
    setTimeout(() => { cameraBtn.style.transform = ''; cameraBtn.style.borderColor = ''; cameraBtn.classList.add('pulse'); }, 1000);
  } else {
    cameraBtn.style.transform = ''; cameraBtn.style.opacity = ''; cameraBtn.style.borderColor = ''; cameraBtn.classList.add('pulse');
  }
}
const originalShowToast = showToast;
showToast = function(msg, type = 'info') { showToastWithType(msg, type); };
const originalSetStatus = setStatus;
setStatus = function(html, opts = {}) {
  const el = statusEl();
  el.classList.toggle("error", !!opts.error);
  if (opts.error) { html = addFeedbackIcon(html, 'error'); setCardState('error'); }
  else if (opts.success) { html = addFeedbackIcon(html, 'success'); setCardState('success'); }
  el.innerHTML = html || "";
};
const originalShowError = showError;
showError = function(message) {
  const el = statusEl();
  el.classList.add("error");
  el.innerHTML = `
    <div>${addFeedbackIcon(message, 'error')}</div>
    <div class="progress"><span style="width:0%"></span></div>
    <button class="retry-btn" id="retryBtn">🔄 Tentar novamente</button>
  `;
  document.getElementById("retryBtn")?.addEventListener("click", () => lastFile && handleImage(lastFile, "retry"));
  setCardState('error'); animateCameraButton('error'); showToast(message, 'error');
};

/* ===== HISTÓRICO (mantido) ===== */
let captureHistory = [];
function addToHistory(c){ captureHistory.unshift(c); if(captureHistory.length>10) captureHistory=captureHistory.slice(0,10); localStorage.setItem('expressglass_history', JSON.stringify(captureHistory)); }
function loadHistory(){ try{ const s=localStorage.getItem('expressglass_history'); if(s) captureHistory=JSON.parse(s);}catch(e){ captureHistory=[]; } }
loadHistory();