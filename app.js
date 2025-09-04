/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";   // novo endpoint para editar
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
      <th style="width:110px">Ações</th>
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
      <td>
        <button class="btn-icon editBtn" title="Editar" data-id="${r.id}">📝</button>
        <button class="btn-icon delBtn" title="Apagar" data-id="${r.id}">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* clique em AÇÕES */
resultsBody?.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const id = Number(btn.dataset.id);
  if(!id) return;

  // --- Apagar ---
  if (btn.classList.contains("delBtn")) {
    if(!confirm("Apagar este registo da base de dados?")) return;
    btn.disabled = true; btn.textContent = "…";
    try{
      await deleteFromDB(id);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast("Registo apagado.");
    }catch(err){
      console.error(err);
      showToast("Falha ao apagar: " + (err.message || "erro"));
    }
  }

  // --- Editar ---
  if (btn.classList.contains("editBtn")) {
    const row = RESULTS.find(r => r.id == id);
    if(!row) return;

    const td = btn.closest("tr").querySelector("td:nth-child(3)");
    const original = row.text;

    td.innerHTML = `
      <textarea id="editArea" style="width:100%;min-height:60px">${original}</textarea>
      <div style="margin-top:6px;display:flex;gap:6px">
        <button class="btn saveEdit" data-id="${id}">💾 Guardar</button>
        <button class="btn cancelEdit" data-id="${id}">❌ Cancelar</button>
      </div>
    `;
  }

  // --- Guardar edição ---
  if (btn.classList.contains("saveEdit")) {
    const area = btn.closest("td").querySelector("#editArea");
    const newText = area.value.trim();
    try {
      await updateDB(id, newText);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast("Registo atualizado.");
    } catch(err) {
      console.error(err);
      showToast("Erro ao atualizar: " + (err.message || "erro"));
    }
  }

  // --- Cancelar edição ---
  if (btn.classList.contains("cancelEdit")) {
    renderTable();
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
  if(!resp.ok) throw new Error("Falha ao gravar");
}
async function deleteFromDB(id){
  const resp = await fetch(DELETE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error) throw new Error(data?.error || ('HTTP ' + resp.status));
}
async function updateDB(id, newText){
  const resp = await fetch(UPDATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text:newText })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error) throw new Error(data?.error || ('HTTP ' + resp.status));
}

/* ===== OCR / resto igual (mantém o fluxo anterior) ===== */
/* ... (mantém exactamente igual ao código que já tens para OCR, histórico, etc.) ... */