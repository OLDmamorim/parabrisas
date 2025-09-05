/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";

/* — grab elements — */
let cameraBtn   = document.getElementById("btnCamera");
let cameraInput = document.getElementById("cameraInput");
const mobileStatus  = document.getElementById("mobileStatus");
const uploadBtn     = document.getElementById("btnUpload");
const fileInput     = document.getElementById("fileInput");
const exportBtn     = document.getElementById("btnExport");
const clearBtn      = document.getElementById("btnClear");
const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");
const toast         = document.getElementById("toast");

/* ===== CSS rápido ===== */
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
    .euro { font-weight:700; padding:2px 6px; border-radius:6px; display:inline-block; }
    .euro-ok { background:#064e3b; color:#d1fae5; }     /* verde escuro */
    .euro-miss { background:#7c2d12; color:#ffedd5; }   /* laranja/tostado */
    .euro-cell { cursor:copy; }
    .toast.show{ opacity:1; }
  `;
  document.head.appendChild(s);
})();

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== EUROCODE ===== */
const EUROCODE_REGEX = /^[0-9]{4}[A-Z0-9]{2,9}$/;
function normalizeAmbiguous(s=''){
  return s.toUpperCase()
    .replaceAll('O','0')
    .replaceAll('I','1')
    .replaceAll('S','5')
    .replaceAll('B','8')
    .replace(/[^A-Z0-9]+/g,' ');
}
function extractEurocode(text=''){
  const toks1 = (text||'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  let hit = toks1.find(t => EUROCODE_REGEX.test(t));
  if (hit) return hit;
  const norm = normalizeAmbiguous(text);
  const toks2 = norm.split(/\s+/).filter(Boolean);
  hit = toks2.find(t => EUROCODE_REGEX.test(t));
  return hit || "";
}

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

/* ===== Cabeçalho Desktop ===== */
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
      <th style="width:110px">Ações</th>
    </tr>
  `;
}

/* ===== API ===== */
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

/* ===== Render ===== */
function renderTable(){
  if(!isDesktop) return;
  ensureActionsHeader();
  resultsBody.innerHTML = "";
  RESULTS.forEach((r,i)=>{
    const raw = (r.text || "").replace(/\s*\n\s*/g, " ").trim();
    const euro = extractEurocode(raw);
    const ok = !!euro;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${raw}</div></td>
      <td class="euro-cell" title="${ok ? 'Clique para copiar' : 'Não encontrado'}">
        <span class="euro ${ok ? 'euro-ok' : 'euro-miss'}">${ok ? euro : '—'}</span>
      </td>
      <td>
        <button class="btn-icon editBtn" title="Editar" data-id="${r.id}">✏️</button>
        <button class="btn-icon delBtn"  title="Apagar" data-id="${r.id}">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* Copiar Eurocode com clique */
resultsBody?.addEventListener("click", (e)=>{
  const cell = e.target.closest(".euro-cell");
  if (!cell) return;
  const code = cell.textContent.trim();
  if (!code || code === "—") return;
  navigator.clipboard?.writeText(code).then(()=> showToast("Eurocode copiado")).catch(()=>{});
});

/* Delegação — editar e apagar */
resultsBody?.addEventListener("click", async (e)=>{
  const editBtn = e.target.closest(".editBtn");
  const delBtn  = e.target.closest(".delBtn");

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

/* ===== Fluxo Principal ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 10);
    await new Promise(r=>setTimeout(r, 120));

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const textRead = data?.text || (data?.qr ? `QR: ${data.qr}` : "");
    const row = {
      id: Date.now().toString(),
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: textRead
    };

    showProgress("A gravar no Neon…", 90);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    RESULTS = await fetchServerRows();
    renderTable();

    showProgress("Concluído ✅", 100);
    setTimeout(()=> setStatus(""), 300);
    showToast("OCR concluído");
  }catch(err){
    console.error(err);
    showError(err.message || "Erro inesperado");
    showToast("Falha no OCR");
  }
}

/* ===== Bind seguro da câmara ===== */
function bindCameraOnce(){
  if (!cameraBtn || !cameraInput) return;

  // remove possíveis listeners antigos clonando o nó
  const clone = cameraBtn.cloneNode(true);
  cameraBtn.parentNode.replaceChild(clone, cameraBtn);
  cameraBtn = document.getElementById("btnCamera");

  let camBusy = false;

  cameraBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (camBusy) return;
    camBusy = true;
    cameraBtn.blur();
    cameraInput.click();
  });

  cameraInput.addEventListener("change", async (e) => {
    try{
      const file = e.target.files?.[0];
      if (!file) { camBusy = false; return; }
      await handleImage(file, "camera");
    } finally {
      cameraInput.value = "";
      setTimeout(()=>{ camBusy = false; }, 350);
    }
  });
}

/* ===== Bootstrap ===== */
(async function(){
  try { RESULTS = await fetchServerRows(); }
  catch(e){ console.warn("Sem Neon:", e.message); RESULTS = []; }
  renderTable();
  bindCameraOnce();
})();

/* ===== Upload Desktop ===== */
uploadBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "upload");
  fileInput.value = "";
});

/* ===== Export / Limpar ===== */
exportBtn?.addEventListener("click", async () => {
  if(!RESULTS.length) return showToast("Nada para exportar");
  const header = ["idx","timestamp","eurocode","text"];
  const lines = [header.join(",")].concat(
    RESULTS.map((r,i)=>{
      const raw = (r.text||"").replace(/\s*\n\s*/g," ").trim();
      const euro = extractEurocode(raw);
      return [
        i+1,
        new Date(r.ts).toISOString(),
        euro,
        `"${raw.replace(/"/g,'""')}"`
      ].join(",");
    })
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

/* ===== Modal Ajuda ===== */
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