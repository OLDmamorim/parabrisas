/* =========================
 * CONFIG
 * ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";   // editar no Neon
const DEMO_MODE    = false;

/* =========================
 * STATE
 * ========================= */
let OCR_ROWS = [];      // { id, ocr_text, eurocode, ... }

/* =========================
 * HELPERS
 * ========================= */
const $ = sel => document.querySelector(sel);
function setBadge(){
  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  $("#viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";
}
setBadge();
window.addEventListener("resize", setBadge);

function el(tag, attrs={}, ...children){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if(k === "class") n.className = v;
    else if(k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if(k === "html") n.innerHTML = v;
    else n.setAttribute(k,v);
  });
  children.forEach(c => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return n;
}

/* =========================
 * API
 * ========================= */
async function apiList(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error("Falha ao carregar lista");
  return r.json(); // espera [{id, ocr_text, eurocode}]
}
async function apiUpdate({ id, ocr_text }){
  const r = await fetch(UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ocr_text })
  });
  if(!r.ok) throw new Error("Falha ao atualizar OCR");
  return r.json();
}
async function apiDelete(id){
  const r = await fetch(DELETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  if(!r.ok) throw new Error("Falha ao apagar registo");
  return r.json();
}

/* =========================
 * RENDER
 * ========================= */
function renderTable(){
  const tbody = $("#ocrTbody");
  tbody.innerHTML = "";

  if(!OCR_ROWS.length){
    tbody.appendChild(
      el("tr",{}, el("td",{colspan:"3"}, "Sem registos."))
    );
    return;
  }

  OCR_ROWS.forEach(row => {
    const tdText = el("td",{}, row.ocr_text || "");
    const tdEuro = el("td",{}, el("span",{class:"badge-euro"}, row.eurocode || "—"));

    const btnEdit = el("button",{class:"icon-btn", onclick:()=>onClickEdit(row)}, "✏️ Editar");
    const btnDel  = el("button",{class:"icon-btn", onclick:()=>onClickDelete(row)}, "🗑️ Apagar");

    const tdActions = el("td",{}, el("div",{class:"actions"}, btnEdit, btnDel));
    const tr = el("tr",{}, tdText, tdEuro, tdActions);
    tbody.appendChild(tr);
  });
}

/* =========================
 * MODAL EDIÇÃO OCR
 * ========================= */
(function(){
  let _currentRow = null;
  let _saving = false;

  const modal   = document.getElementById('ocrEditModal');
  const ta      = document.getElementById('ocrEditTextarea');
  const btnSave = document.getElementById('ocrSaveBtn');
  const btnCancel = document.getElementById('ocrCancelBtn');
  const btnX    = document.getElementById('ocrCloseX');

  function open(row){
    _currentRow = row;
    ta.value = row.ocr_text || "";
    modal.classList.remove('ocr-hidden');
    modal.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
    });
  }
  function close(){
    if(_saving) return;
    modal.classList.add('ocr-hidden');
    modal.setAttribute('aria-hidden','true');
    _currentRow = null;
  }
  async function save(){
    if(!_currentRow || _saving) return;
    _saving = true;
    const newText = ta.value.trim();

    try{
      await apiUpdate({ id: _currentRow.id, ocr_text: newText });
      // reflete na memória e re-renderiza
      _currentRow.ocr_text = newText;
      renderTable();
      close();
    }catch(err){
      console.error(err);
      alert("Não foi possível atualizar. Tenta novamente.");
    }finally{
      _saving = false;
    }
  }

  btnSave.addEventListener('click', save);
  btnCancel.addEventListener('click', close);
  btnX.addEventListener('click', close);
  modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });
  window.addEventListener('keydown', (e)=>{
    if(modal.classList.contains('ocr-hidden')) return;
    if(e.key === 'Escape') close();
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); save(); }
  });

  // torna acessível
  window.__openOcrModal = open;
})();

/* ===== Handlers dos botões da tabela ===== */
function onClickEdit(row){
  // Abre modal
  window.__openOcrModal(row);
}
async function onClickDelete(row){
  if(!confirm("Apagar este registo?")) return;
  try{
    await apiDelete(row.id);
    OCR_ROWS = OCR_ROWS.filter(r => r.id !== row.id);
    renderTable();
  }catch(err){
    console.error(err);
    alert("Falha ao apagar o registo.");
  }
}

/* =========================
 * INIT
 * ========================= */
async function init(){
  $("#refreshBtn").addEventListener("click", loadData);
  await loadData();
}
async function loadData(){
  try{
    const data = await apiList();
    // normaliza campos mínimos esperados
    OCR_ROWS = (data||[]).map(r => ({
      id: r.id,
      ocr_text: r.ocr_text ?? r.text ?? "",
      eurocode: r.eurocode ?? r.ec ?? ""
    }));
    renderTable();
  }catch(err){
    console.error(err);
    alert("Erro a carregar dados.");
  }
}
init();