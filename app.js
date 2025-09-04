/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
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
const clearBtnDesktop = document.getElementById("btnClearDesktop");
const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");
const toast         = document.getElementById("toast");

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== Helpers UI ===== */
function showToast(msg){ toast.textContent = msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), 2200); }
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
function showError(message){
  const el = statusEl();
  el.classList.add("error");
  el.innerHTML = `
    <div>❌ ${message}</div>
    <div class="progress"><span style="width:0%"></span></div>
    <button class="retry-btn" id="retryBtn" style="margin-top:6px">🔄 Tentar novamente</button>
  `;
  document.getElementById("retryBtn")?.addEventListener("click", ()=> lastFile && handleImage(lastFile, "retry"));
}

/* ===== TABELA DESKTOP ===== */
function ensureActionsHeader() {
  if (!isDesktop) return;
  const thead = document.querySelector("#resultsTable thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr>
      <th style="width:60px">#</th>
      <th style="width:220px">Data/Hora</th>
      <th style="width:auto">Texto lido (OCR)</th>
      <th style="width:80px">Ações</th>
    </tr>
  `;
}
function renderTable(){
  if(!isDesktop) return;
  ensureActionsHeader();
  resultsBody.innerHTML = "";
  RESULTS.forEach((r,i)=>{
    const txt = (r.text || "").replace(/\s*\n\s*/g, " ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${txt}</div></td>
      <td><button class="btn-icon delBtn" title="Apagar" data-id="${r.id}">🗑️</button></td>
    `;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* clique apagar (delegação) */
resultsBody?.addEventListener("click", async (e)=>{
  const btn = e.target.closest(".delBtn");
  if(!btn) return;
  const id = Number(btn.dataset.id);
  if(!id) return;
  if(!confirm("Apagar este registo da base de dados?")) return;

  const old = btn.textContent;
  btn.disabled = true; btn.textContent = "…";
  try{
    await deleteFromDB(id);              // apaga no Neon
    RESULTS = await fetchServerRows();   // sincroniza
    renderTable();
    showToast("Registo apagado.");
  }catch(err){
    console.error(err);
    btn.disabled = false; btn.textContent = old;
    showToast("Falha ao apagar: " + (err.message || "erro"));
  }
});

/* ===== API NEON ===== */
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

/* ===== OCR ===== */
async function optimizeImageForOCR(file){
  const srcBlob = file instanceof Blob ? file : new Blob([file]);
  const bmp = await createImageBitmap(srcBlob);
  const scale = Math.min(1600 / bmp.width, 1600 / bmp.height, 1);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bmp, 0, 0, w, h);
  const out = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
  return new File([out], (file.name || 'foto') + '.jpg', { type: 'image/jpeg' });
}

/* ===== HISTÓRICO (MOBILE) ===== */
const mobileHistoryList = document.getElementById("mobileHistoryList");
let captureHistory = [];
function loadHistory(){ try{ const s=localStorage.getItem('expressglass_history'); if(s) captureHistory=JSON.parse(s);}catch{captureHistory=[]} }
function saveHistory(){ try{ localStorage.setItem('expressglass_history', JSON.stringify(captureHistory)); }catch{} }
function addCaptureToHistory(capture){
  const item = { timestamp:capture.ts, text:capture.text, filename:capture.filename, id:capture.id };
  captureHistory.unshift(item);
  if (captureHistory.length>20) captureHistory = captureHistory.slice(0,20);
  saveHistory(); renderHistory();
}
function truncate(txt, n=50){
  if(!txt) return "";
  txt = txt.replace(/\s+/g," ").trim();
  return txt.length>n ? txt.slice(0,n)+"…" : txt;
}
function renderHistory(){
  if(!mobileHistoryList) return;
  if (captureHistory.length===0){
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há capturas realizadas.</p>';
    return;
  }
  const limited = captureHistory.slice(0,5);
  mobileHistoryList.innerHTML = limited.map(it=>`
    <div class="hist-item">
      <small class="hist-time">${new Date(it.timestamp).toLocaleString()}</small>
      <div class="hist-text">${truncate(it.text,50)}</div>
    </div>
  `).join('');
}
loadHistory(); renderHistory();

/* ===== RUN OCR ===== */
async function runOCR(file){
  if (!file) throw new Error("Sem ficheiro");
  if (DEMO_MODE){
    await new Promise(r=>setTimeout(r,500));
    return { text:"DEMO: Texto simulado de OCR\nLinha 2: 123 ABC" };
  }
  const optimized = await optimizeImageForOCR(file);
  const fd = new FormData(); fd.append("file", optimized, optimized.name);
  const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });
  const t = await res.text().catch(()=>res.statusText);
  if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
  return JSON.parse(t);
}

/* ===== Fluxo Comum ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 10);
    await new Promise(r=>setTimeout(r,150));

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

    // Histórico (mobile)
    addCaptureToHistory(row);

    // Recarregar tabela (desktop)
    if (isDesktop){
      RESULTS = await fetchServerRows();
      renderTable();
    }

    showProgress("Concluído ✅", 100);
    setTimeout(()=> setStatus(""), 450);
    showToast("OCR concluído");
  }catch(err){
    console.error(err);
    showError(err.message || "Erro inesperado");
    showToast("Falha no OCR");
  }
}

/* ===== Bootstrap ===== */
(async function(){
  if (isDesktop){
    document.getElementById("mobileView")?.classList.add("hidden");
    document.getElementById("desktopView")?.classList.remove("hidden");
    try { RESULTS = await fetchServerRows(); }
    catch(e){ console.warn("Sem Neon:", e.message); RESULTS = []; }
    renderTable();
  }
})();

/* ===== Ações ===== */
cameraBtn?.addEventListener("click", () => cameraInput.click());
cameraInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "camera");
  cameraInput.value = "";
});

uploadBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "upload");
  fileInput.value = "";
});

exportBtn?.addEventListener("click", async () => {
  if(!RESULTS.length) return showToast("Nada para exportar");
  const header = ["idx","timestamp","text"];
  const lines = [header.join(",")].concat(
    RESULTS.map((r,i)=>[
      i+1,
      new Date(r.ts).toISOString(),
      `"${(r.text||"").replace(/"/g,'""')}"`
    ].join(","))
  );
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "express_ocr.csv"; a.click();
  URL.revokeObjectURL(url);
});

clearBtn?.addEventListener("click", ()=>{
  captureHistory = [];
  saveHistory(); renderHistory();
  showToast("Histórico limpo (local)");
});
clearBtnDesktop?.addEventListener("click", ()=>{
  RESULTS = []; renderTable();
  showToast("Vista limpa (dados no Neon mantidos)");
});

/* ===== MODAL INSTRUÇÕES ===== */
const helpModal = document.getElementById("helpModal");
const helpBtn = document.getElementById("helpBtn");
const helpBtnDesktop = document.getElementById("helpBtnDesktop");
const helpClose = document.getElementById("helpClose");

function showHelpModal(){ helpModal?.classList.add("show"); }
function hideHelpModal(){ helpModal?.classList.remove("show"); }
helpBtn?.addEventListener("click", showHelpModal);
helpBtnDesktop?.addEventListener("click", showHelpModal);
helpClose?.addEventListener("click", hideHelpModal);
helpModal?.addEventListener("click", (e)=>{ if(e.target===helpModal) hideHelpModal(); });
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && helpModal?.classList.contains("show")) hideHelpModal(); });