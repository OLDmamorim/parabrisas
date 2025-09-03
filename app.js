/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DEMO_MODE    = false;

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";

const helpBtn       = document.getElementById("helpBtn");
const helpDialog    = document.getElementById("helpDialog");
const closeHelp     = document.getElementById("closeHelp");

const cameraBtn     = document.getElementById("btnCamera");
const cameraInput   = document.getElementById("cameraInput");
const mobileStatus  = document.getElementById("mobileStatus");

const uploadBtn     = document.getElementById("btnUpload");
const fileInput     = document.getElementById("fileInput");
const exportBtn     = document.getElementById("btnExport");
const clearBtn      = document.getElementById("btnClear");
const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");

const historyList   = document.getElementById("historyList");
const clearHistory  = document.getElementById("clearHistory");

const toast         = document.getElementById("toast");

/* ===== Estado ===== */
let RESULTS = [];   // tabela desktop (Neon)
let lastFile = null;

/* ===== Ajuda ===== */
helpBtn?.addEventListener("click", ()=> helpDialog.showModal());
closeHelp?.addEventListener("click", ()=> helpDialog.close());

/* ===== Helpers UI ===== */
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2000);
}
function statusEl(){ return isDesktop ? desktopStatus : mobileStatus; }
function setStatusSuccess(msg){
  const el = statusEl();
  el.classList.remove("error");
  el.classList.add("success");
  el.innerHTML = `<div class="status-flex">
    <div class="progress-ring" style="--val:1turn; background:conic-gradient(var(--success) 1turn,#233 0), radial-gradient(closest-side,#0000 calc(100% - 6px), #0e1726 0);"></div>
    <div>${msg}</div>
  </div>`;
}
function setStatusError(msg){
  const el = statusEl();
  el.classList.remove("success");
  el.classList.add("error");
  el.innerHTML = `<div class="status-flex">
    <div class="progress-ring" style="--val:1turn; background:conic-gradient(var(--error) 1turn,#233 0), radial-gradient(closest-side,#0000 calc(100% - 6px), #0e1726 0);"></div>
    <div>${msg}</div>
  </div>
  <button class="btn" id="retryBtn">🔄 Tentar novamente</button>`;
  document.getElementById("retryBtn")?.addEventListener("click", ()=> lastFile && handleImage(lastFile, "retry"));
}
function showProgress(label, frac=0){
  const el = statusEl();
  el.classList.remove("success","error");
  const turn = Math.max(0, Math.min(1, frac)) + "turn";
  el.innerHTML = `<div class="status-flex">
    <div class="progress-ring" style="--val:${turn}"></div>
    <div>${label}</div>
  </div>
  <div class="progress"><span style="width:${frac*100}%"></span></div>`;
}

/* ===== Cabeçalho fixo (1 coluna Ações) ===== */
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
    </tr>`;
}

/* ===== Render Desktop ===== */
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
      <td><button class="btn-icon delBtn" title="Apagar" data-id="${r.id}">🗑️</button></td>`;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";

  document.querySelectorAll(".delBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      RESULTS = RESULTS.filter(r=>r.id != id);
      renderTable();
    });
  });
}

/* ===== Histórico (mobile, local) ===== */
const HK = "express_history_v1";
function loadHistory(){
  try { return JSON.parse(localStorage.getItem(HK) || "[]"); } catch { return []; }
}
function saveHistory(rows){
  localStorage.setItem(HK, JSON.stringify(rows.slice(0,10))); // guarda últimos 10
}
function pushHistory(row){
  const h = loadHistory();
  h.unshift({ ts: row.ts, text: row.text });
  saveHistory(h);
  renderHistory();
}
function renderHistory(){
  if (!historyList) return;
  const h = loadHistory();
  historyList.innerHTML = h.length ? "" : `<li class="history-item"><em>Sem histórico ainda.</em></li>`;
  h.forEach(item=>{
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `<time>${new Date(item.ts).toLocaleString()}</time><div class="ocr-text">${(item.text||"").replace(/\s*\n\s*/g," ")}</div>`;
    historyList.appendChild(li);
  });
}
clearHistory?.addEventListener("click", ()=>{
  saveHistory([]); renderHistory(); showToast("Histórico limpo");
});

/* ===== Neon API ===== */
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
    await new Promise(r=>setTimeout(r, 600));
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

/* ===== Fluxo ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", .15);
    await new Promise(r=>setTimeout(r, 120));

    showProgress("A otimizar…", .35);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", .65);
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", .82);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
      id: Date.now().toString(),
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    showProgress("A gravar no Neon…", .95);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    // Atualiza UI
    pushHistory(row); // histórico mobile
    if (isDesktop) {
      RESULTS = await fetchServerRows();
      renderTable();
    }
    setStatusSuccess("Concluído ✅");
    showToast("OCR concluído");
  }catch(err){
    console.error(err);
    setStatusError("Falha no processo: " + (err.message || "Erro inesperado"));
    showToast("Erro");
  }
}

/* ===== Bootstrap ===== */
(async function(){
  if (isDesktop) {
    try { RESULTS = await fetchServerRows(); }
    catch(e){ console.warn("Sem Neon:", e.message); RESULTS = []; }
    renderTable();
  }
  renderHistory();
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
  RESULTS = [];
  renderTable();
  showToast("Vista limpa (dados no Neon mantidos)");
});