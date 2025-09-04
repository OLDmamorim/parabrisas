/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const UPDATE_URL   = "/api/update-ocr";  // <— atualizar no Neon
const DELETE_URL   = "/api/delete-ocr";  // <— apagar no Neon
const DEMO_MODE    = false;

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge")?.textContent = isDesktop ? "Desktop" : "Mobile";

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

/* ===== CSS mínimo injetado (caso falte no style.css) ===== */
(function(){
  const id = "ocr-inline-style";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .ocr-text{white-space:normal;overflow-wrap:anywhere;line-height:1.4}
    .error{background:#300;color:#fff;padding:6px;border-radius:6px}
    .progress{background:#222;height:6px;border-radius:3px;margin-top:4px}
    .progress span{display:block;height:100%;background:#3b82f6;border-radius:3px}
    .btn-icon{cursor:pointer;border:none;background:none;font-size:16px}
    .actions .btn-icon{margin:0 2px}
    .edit-area{width:100%;min-height:120px;border-radius:8px;padding:8px;background:#0f172a;color:#e5e7eb;border:1px dashed #3b82f6}
    .edit-controls{margin-top:6px;display:flex;gap:8px}
    .small{opacity:.8;font-size:.9em}
  `;
  document.head.appendChild(s);
})();

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== Helpers UI ===== */
function showToast(msg){
  if(!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2200);
}
function statusEl(){ return isDesktop ? desktopStatus : mobileStatus; }
function setStatus(html, opts={}) {
  const el = statusEl(); if(!el) return;
  el.classList.toggle("error", !!opts.error);
  el.innerHTML = html || "";
}
function showProgress(label, pct=0, asError=false){
  const el = statusEl(); if(!el) return;
  el.classList.toggle("error", !!asError);
  el.innerHTML = `
    <div>${label}</div>
    <div class="progress"><span style="width:${pct}%"></span></div>
  `;
}
function updateProgress(pct){
  const el = statusEl(); if(!el) return;
  const bar = el.querySelector(".progress > span");
  if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
}
function showError(message){
  const el = statusEl(); if(!el) return;
  el.classList.add("error");
  el.innerHTML = `
    <div>❌ ${message}</div>
    <div class="progress"><span style="width:0%"></span></div>
    <button class="retry-btn" id="retryBtn">🔄 Tentar novamente</button>
  `;
  document.getElementById("retryBtn")?.addEventListener("click", ()=> lastFile && handleImage(lastFile, "retry"));
}

/* ===== Cabeçalho da tabela (desktop) ===== */
function ensureActionsHeader() {
  if (!isDesktop) return;
  const thead = document.querySelector("#resultsTable thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr>
      <th style="width:60px">#</th>
      <th style="width:220px">Data/Hora</th>
      <th style="width:auto">Texto lido (OCR)</th>
      <th style="width:120px">Ações</th>
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
async function updateInDB(id, text){
  const resp = await fetch(UPDATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error) throw new Error(data?.error || ('HTTP '+resp.status));
  return true;
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

/* ===== Render da tabela (desktop) ===== */
function renderTable(){
  if(!isDesktop) return;
  ensureActionsHeader();
  resultsBody.innerHTML = "";
  RESULTS.forEach((r,i)=>{
    const txt = (r.text || "").replace(/\s*\n\s*/g, " ");
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td class="col-text"><div class="ocr-text">${txt}</div></td>
      <td class="actions">
        <button class="btn-icon editBtn" title="Editar" data-id="${r.id}">📝</button>
        <button class="btn-icon delBtn"  title="Apagar" data-id="${r.id}">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* ===== Delegação de eventos (editar/apagar) ===== */
resultsBody?.addEventListener("click", async (e)=>{
  const edit = e.target.closest(".editBtn");
  const del  = e.target.closest(".delBtn");
  const save = e.target.closest(".saveEdit");
  const cancel = e.target.closest(".cancelEdit");

  // APAGAR
  if (del) {
    const id = Number(del.dataset.id);
    if(!id) return;
    if(!confirm("Apagar este registo da base de dados?")) return;
    const old = del.textContent;
    del.disabled = true; del.textContent = "…";
    try{
      await deleteFromDB(id);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast("Registo apagado.");
    }catch(err){
      del.disabled = false; del.textContent = old;
      showToast("Falha ao apagar: " + (err.message || "erro"));
    }
    return;
  }

  // ENTRAR EM MODO EDIÇÃO
  if (edit) {
    const id = Number(edit.dataset.id);
    const tr = edit.closest("tr");
    const col = tr.querySelector(".col-text");
    const current = col.querySelector(".ocr-text")?.textContent || "";

    col.innerHTML = `
      <textarea class="edit-area">${current}</textarea>
      <div class="edit-controls">
        <button class="btn-icon saveEdit" data-id="${id}" title="Guardar">💾 Guardar</button>
        <button class="btn-icon cancelEdit" data-id="${id}" title="Cancelar">❌ Cancelar</button>
      </div>
      <div class="small">A editar…</div>
    `;
    return;
  }

  // GUARDAR EDIÇÃO
  if (save) {
    const id = Number(save.dataset.id);
    const tr = save.closest("tr");
    const col = tr.querySelector(".col-text");
    const ta = col.querySelector(".edit-area");
    const newText = (ta.value || "").trim();

    save.disabled = true; save.textContent = "…";
    try{
      await updateInDB(id, newText);
      // refetch para ficar 100% igual ao Neon
      RESULTS = await fetchServerRows();
      renderTable();
      showToast("Alterações guardadas.");
    }catch(err){
      save.disabled = false; save.textContent = "💾 Guardar";
      alert("Falha a guardar: " + (err.message || "erro"));
    }
    return;
  }

  // CANCELAR EDIÇÃO
  if (cancel) {
    renderTable(); // simplesmente volta a renderizar a lista
    return;
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

/* ===== Fluxo comum ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 12);
    await new Promise(r=>setTimeout(r, 120));

    showProgress("A otimizar…", 28);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 58);
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", 82);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    showProgress("A gravar no Neon…", 92);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    RESULTS = await fetchServerRows();
    renderTable();

    showProgress("Concluído ✅", 100);
    setTimeout(()=> setStatus(""), 500);
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

/* ===== Ações (mobile/desktop) ===== */
cameraBtn?.addEventListener("click", () => cameraInput?.click());
cameraInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "camera");
  cameraInput.value = "";
});
uploadBtn?.addEventListener("click", () => fileInput?.click());
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