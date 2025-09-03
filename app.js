/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
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
  s.textContent = `.ocr-text{ white-space: normal; overflow-wrap:anywhere; line-height:1.4 }`;
  document.head.appendChild(s);
})();

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

/* ===== Tabela ===== */
function renderTable(){
  if(!isDesktop) return;
  resultsBody.innerHTML = "";
  RESULTS.forEach((r,i)=>{
    const txt = (r.text || "").replace(/\s*\n\s*/g, " ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${txt}</div></td>`;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* ===== Neon API ===== */
async function fetchServerRows(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const { rows } = await r.json();
  return rows.map(x => ({
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

/* ===== Fluxo ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 10);
    await new Promise(r=>setTimeout(r, 150)); // só para animar

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    // reutilizamos a função de OCR mas como já otimizámos em cima,
    // passamos o ficheiro otimizado diretamente:
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
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