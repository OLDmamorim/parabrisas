/* =========================
 * CONFIG
 * ========================= */
const LIST_URL    = "/api/list-ocr";
const SAVE_URL    = "/api/save-ocr";
const UPDATE_URL  = "/api/update-ocr";
const DELETE_URL  = "/api/delete-ocr";
const OCR_URL     = "/api/ocr-proxy";

/* =========================
 * STATE & SELECTORS
 * ========================= */
let RESULTS = []; // [{id, text, eurocode, created_at, ...}]

const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");
const toast         = document.getElementById("toast");

const btnUpload     = document.getElementById("btnUpload");
const fileInput     = document.getElementById("fileInput");
const btnExportCsv  = document.querySelectorAll("#btnExport");
const btnClearAll   = document.querySelectorAll("#btnClear");
const btnCamera     = document.getElementById("btnCamera");

/* =========================
 * HELPERS UI
 * ========================= */
function $(sel, root = document) { return root.querySelector(sel); }
function setStatus(el, text, type = "info"){
  if(!el) return;
  el.textContent = text;
  el.className = "status " + (type === "error" ? "status-error" : type === "success" ? "status-success" : "status-info");
}
function showToast(msg, type="info"){
  if(!toast) return;
  toast.textContent = msg;
  toast.className = "toast show " + (type === "error" ? "toast-error" : type === "success" ? "toast-success" : "toast-info");
  setTimeout(()=> toast.classList.remove("show"), 2500);
}
function downloadBlob(filename, text){
  const blob = new Blob([text], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

/* =========================
 * API
 * ========================= */
async function requestJSON(url, options){
  const r = await fetch(url, options);
  const body = await r.text();
  if(!r.ok){
    const detail = body?.slice(0,400) || "";
    throw new Error(`HTTP ${r.status} em ${url} — ${detail}`);
  }
  return body ? JSON.parse(body) : null;
}

async function fetchServerRows(){
  const data = await requestJSON(LIST_URL, { headers:{ "Accept":"application/json" } });
  const rows = Array.isArray(data) ? data : (data?.rows || data?.items || []);
  // normaliza
  return rows.map(x => ({
    id: x.id,
    text: x.text ?? x.ocr_text ?? "",
    eurocode: x.eurocode ?? x.euro_validado ?? "",
    created_at: x.created_at ?? x.ts ?? null
  }));
}

async function saveOCRInServer(payload){
  return requestJSON(SAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
async function updateOCRInServer(payload){
  // Mantém id + text; se enviares eurocode/timestamps, o backend pode preservar
  return requestJSON(UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
async function deleteOCRInServer(id){
  return requestJSON(DELETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
}
async function ocrProxyWithFile(file){
  const fd = new FormData();
  fd.append("file", file, file.name);
  return requestJSON(OCR_URL, { method:"POST", body: fd });
}

/* =========================
 * RENDER
 * ========================= */
function renderTable(){
  resultsBody.innerHTML = "";
  if(!RESULTS.length){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "Sem registos.";
    tr.appendChild(td);
    resultsBody.appendChild(tr);
    return;
  }

  const frag = document.createDocumentFragment();
  RESULTS.forEach((row, idx) => {
    const tr = document.createElement("tr");

    const tdText = document.createElement("td");
    tdText.textContent = row.text || "";
    tdText.style.whiteSpace = "pre-wrap";
    tdText.style.wordBreak = "break-word";

    const tdEuro = document.createElement("td");
    const euro = row.eurocode || "—";
    const span = document.createElement("span");
    span.className = "badge-euro";
    span.textContent = euro;
    tdEuro.appendChild(span);

    const tdActions = document.createElement("td");
    tdActions.style.whiteSpace = "pre-wrap";
    tdActions.style.wordBreak = "break-word";

    const btnEdit = document.createElement("button");
    btnEdit.className = "icon-btn";
    btnEdit.textContent = "✏️ Editar";
    btnEdit.addEventListener("click", () => editOCR(idx));

    const btnDel = document.createElement("button");
    btnDel.className = "icon-btn";
    btnDel.textContent = "🗑️ Apagar";
    btnDel.addEventListener("click", () => deleteRowUI(idx));

    tdActions.appendChild(btnEdit);
    tdActions.appendChild(btnDel);

    tr.appendChild(tdText);
    tr.appendChild(tdEuro);
    tr.appendChild(tdActions);
    frag.appendChild(tr);
  });

  resultsBody.appendChild(frag);
}

/* =========================
 * MODAL DE EDIÇÃO (Textarea)
 * ========================= */
const ocrModal = (() => {
  const modal   = document.getElementById("ocrEditModal");
  const ta      = document.getElementById("ocrEditTextarea");
  const btnSave = document.getElementById("ocrSaveBtn");
  const btnCancel = document.getElementById("ocrCancelBtn");
  const btnX    = document.getElementById("ocrCloseX");

  let currentIdx = null;
  let saving = false;

  function open(idx){
    currentIdx = idx;
    const row = RESULTS[idx];
    ta.value = row?.text || "";
    modal.classList.remove("ocr-hidden");
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(()=>{
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
    });
  }
  function close(){
    if(saving) return;
    modal.classList.add("ocr-hidden");
    modal.setAttribute("aria-hidden", "true");
    currentIdx = null;
  }
  async function save(){
    if(currentIdx == null || saving) return;
    saving = true;
    const row = RESULTS[currentIdx];
    const newText = ta.value.trim();

    try{
      setStatus(desktopStatus, "A guardar…");
      await updateOCRInServer({ id: row.id, text: newText, eurocode: row.eurocode });
      RESULTS = await fetchServerRows();
      renderTable();
      setStatus(desktopStatus, "OCR atualizado", "success");
      showToast("Texto lido (OCR) atualizado ✅", "success");
      close();
    }catch(e){
      console.error(e);
      setStatus(desktopStatus, "Erro ao guardar", "error");
      showToast("Falha ao atualizar o registo", "error");
    }finally{
      saving = false;
    }
  }

  btnSave?.addEventListener("click", save);
  btnCancel?.addEventListener("click", close);
  btnX?.addEventListener("click", close);
  modal?.addEventListener("click", (e)=>{ if(e.target === modal) close(); });
  window.addEventListener("keydown", (e)=>{
    if(modal?.classList.contains("ocr-hidden")) return;
    if(e.key === "Escape") close();
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase() === "s"){ e.preventDefault(); save(); }
  });

  return { open, close };
})();

/* =========================
 * ACTIONS
 * ========================= */
function editOCR(idx){
  if(!RESULTS[idx]) return;
  ocrModal.open(idx);
}

async function deleteRowUI(idx){
  const row = RESULTS[idx];
  if(!row) return;
  if(!confirm("Apagar este registo?")) return;

  try{
    setStatus(desktopStatus, "A apagar…");
    await deleteOCRInServer(row.id);
    RESULTS.splice(idx, 1);
    renderTable();
    setStatus(desktopStatus, "Registo apagado", "success");
    showToast("Registo apagado 🗑️", "success");
  }catch(e){
    console.error(e);
    setStatus(desktopStatus, "Erro ao apagar", "error");
    showToast("Falha ao apagar o registo", "error");
  }
}

function exportCSV(){
  if(!RESULTS.length){
    showToast("Nada para exportar", "info");
    return;
  }
  const header = ["id","eurocode","text","created_at"];
  const lines = [header.join(";")];
  RESULTS.forEach(r=>{
    const row = [
      (r.id ?? "").toString().replace(/;/g, ","),
      (r.eurocode ?? "").toString().replace(/;/g, ","),
      (r.text ?? "").toString().replace(/;/g, ","),
      (r.created_at ?? "").toString().replace(/;/g, ","),
    ];
    lines.push(row.join(";"));
  });
  downloadBlob(`ocr_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`, lines.join("\n"));
  showToast("CSV exportado ⬇️", "success");
}

function clearTableUI(){
  RESULTS = [];
  renderTable();
  showToast("Tabela limpa localmente", "info");
  setStatus(desktopStatus, "Pronto");
}

/* =========================
 * OCR: UPLOAD / CÂMARA
 * ========================= */
function triggerUpload(){
  if(!fileInput) return;
  fileInput.value = "";
  fileInput.click();
}
async function handleFileChange(e){
  const file = e.target.files?.[0];
  if(!file) return;

  try{
    setStatus(desktopStatus, "A processar OCR…");
    const ocr = await ocrProxyWithFile(file); // { text, eurocode?, ... }
    const payload = {
      text: ocr?.text || "",
      eurocode: ocr?.eurocode || ocr?.euro_validado || ""
    };
    await saveOCRInServer(payload);
    RESULTS = await fetchServerRows();
    renderTable();
    setStatus(desktopStatus, "OCR guardado", "success");
    showToast("OCR guardado ✅", "success");
  }catch(e){
    console.error(e);
    setStatus(desktopStatus, "Erro no OCR", "error");
    showToast("Falha ao processar/guardar OCR", "error");
  }finally{
    if(fileInput) fileInput.value = "";
  }
}

// Mobile “Capturar Eurocode”: usa o mesmo fluxo do upload, mas
// em muitos navegadores abrir o seletor com `capture` é suficiente.
function triggerMobileCamera(){
  if(!fileInput) return showToast("Câmara indisponível", "error");
  // Tenta pedir câmara: muitos browsers honram capture via HTML no input.
  fileInput.setAttribute("accept", "image/*,.pdf");
  fileInput.setAttribute("capture", "environment");
  fileInput.value = "";
  fileInput.click();
}

/* =========================
 * INIT
 * ========================= */
async function init(){
  try{
    setStatus(desktopStatus, "A carregar…");
    RESULTS = await fetchServerRows();
    renderTable();
    setStatus(desktopStatus, "Pronto", "success");
  }catch(e){
    console.error(e);
    setStatus(desktopStatus, "Sem ligação ao servidor", "error");
  }

  // Botões (existem 2 Export/Clear: mobile e desktop)
  btnUpload?.addEventListener("click", triggerUpload);
  fileInput?.addEventListener("change", handleFileChange);

  if(btnCamera){ btnCamera.addEventListener("click", triggerMobileCamera); }

  (btnExportCsv?.forEach ? btnExportCsv : [btnExportCsv]).forEach(b=>{
    b?.addEventListener("click", exportCSV);
  });
  (btnClearAll?.forEach ? btnClearAll : [btnClearAll]).forEach(b=>{
    b?.addEventListener("click", clearTableUI);
  });
}
init();