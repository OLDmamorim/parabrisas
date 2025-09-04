/* =========================
 * CONFIG — Netlify Functions
 * ========================= */
const ENDPOINTS = {
  OCR:    "/.netlify/functions/ocr-proxy",
  LIST:   "/.netlify/functions/list-ocr",
  SAVE:   "/.netlify/functions/save-ocr",
  DELETE: "/.netlify/functions/delete-ocr",
  UPDATE: "/.netlify/functions/update-ocr",
  CLEAR:  "/.netlify/functions/clear-ocr" // se não existir, não é usado
};

/* =========================
 * DOM
 * ========================= */
const els = {
  btnCamera:  document.getElementById("btnCamera"),
  camInput:   document.getElementById("cameraInput"),
  btnUpload:  document.getElementById("btnUpload"),
  fileInput:  document.getElementById("fileInput"),
  btnExport:  document.getElementById("btnExport"),
  btnClear:   document.getElementById("btnClear"),
  tbody:      document.getElementById("resultsBody"),
  mobileList: document.getElementById("mobileHistoryList"),
  toast:      document.getElementById("toast"),
  helpBtn:    document.getElementById("helpBtn"),
  helpBtn2:   document.getElementById("helpBtnDesktop"),
  helpModal:  document.getElementById("helpModal"),
  helpClose:  document.getElementById("helpClose"),
};

/* =========================
 * EUROCODE PARSER
 * 4 dígitos + 2 letras + 0–5 alfanuméricos,
 * e o sufixo (posições 7..11) tem pelo menos 1 letra
 * ========================= */
function parseEurocode(raw){
  const text = String(raw || "").toUpperCase();
  const tokens = text.split(/[^A-Z0-9]+/).filter(Boolean);
  const VALID = /^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/;
  const tailHasLetter = code => /[A-Z]/.test(code.slice(6));

  // A) match dentro de um token
  for (const t of tokens){
    const m = t.match(/\d{4}[A-Z]{2}[A-Z0-9]{0,5}/);
    if (m && VALID.test(m[0]) && tailHasLetter(m[0])) return m[0];
  }
  // B) reconstrução entre tokens consecutivos
  for (let i = 0; i < tokens.length - 1; i++){
    const a = tokens[i], b = tokens[i+1];
    if (/^\d{4}$/.test(a) && /^[A-Z]{2}/.test(b)){
      const code = (a + b).slice(0, 11);
      if (VALID.test(code) && tailHasLetter(code)) return code;
    }
  }
  return null;
}

/* =========================
 * UI helpers
 * ========================= */
let toastTimer;
function toast(msg, kind = "ok"){
  if (!els.toast) return;
  els.toast.className = `toast ${kind}`;
  els.toast.textContent = msg;
  els.toast.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.style.opacity = "0", 2600);
}
function fmtDate(ts){
  try { return new Date(ts).toLocaleString("pt-PT"); } catch { return ts; }
}
function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
  }[m]));
}
function wireHelp(){
  const open = ()=>{ els.helpModal?.setAttribute("aria-hidden","false"); els.helpModal?.classList.add("open"); };
  const close= ()=>{ els.helpModal?.setAttribute("aria-hidden","true");  els.helpModal?.classList.remove("open"); };
  els.helpBtn?.addEventListener("click", open);
  els.helpBtn2?.addEventListener("click", open);
  els.helpClose?.addEventListener("click", close);
  els.helpModal?.addEventListener("click", e => { if (e.target === els.helpModal) close(); });
}

/* =========================
 * BACKEND
 * ========================= */
async function apiList(){
  const r = await fetch(ENDPOINTS.LIST, { cache: "no-store" });
  if (!r.ok) throw new Error("Falha ao listar");
  return await r.json(); // [{id, ts, text, eurocode}, ...]
}
async function apiSave(row){
  const r = await fetch(ENDPOINTS.SAVE, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new Error("Falha ao guardar");
  return await r.json(); // { ok:true, id }
}
async function apiDelete(id){
  const r = await fetch(ENDPOINTS.DELETE, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ id })
  });
  if (!r.ok) throw new Error("Falha ao apagar");
  return await r.json();
}
async function apiUpdate(id, patch){
  const r = await fetch(ENDPOINTS.UPDATE, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ id, ...patch })
  });
  if (!r.ok) throw new Error("Falha ao atualizar");
  return await r.json();
}
async function apiClear(){
  const r = await fetch(ENDPOINTS.CLEAR, { method: "POST" });
  if (!r.ok) throw new Error("Falha ao limpar");
  return await r.json();
}

/* =========================
 * OCR
 * ========================= */
async function doOCR(file){
  const fd = new FormData();
  fd.append("file", file, "etiqueta.jpg");
  const res = await fetch(ENDPOINTS.OCR, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`OCR falhou (${res.status})`);
  const data = await res.json();
  return data?.text || data?.fullText || data?.ocr || "";
}

/* =========================
 * RENDER
 * ========================= */
function renderTable(rows){
  if (!els.tbody) return;
  if (!rows?.length){ els.tbody.innerHTML = ""; return; }
  els.tbody.innerHTML = rows.map((r, idx) => `
    <tr>
      <td>${rows.length - idx}</td>
      <td>${fmtDate(r.ts)}</td>
      <td class="ocr-cell"><pre>${escapeHtml(r.text || "")}</pre></td>
      <td class="euro-cell"><span class="eurocode">${r.eurocode ? escapeHtml(r.eurocode) : "—"}</span></td>
      <td>
        <button class="mini" data-edit="${r.id}">✏️</button>
        <button class="mini danger" data-del="${r.id}">🗑️</button>
      </td>
    </tr>
  `).join("");
}
function renderMobile(rows){
  if (!els.mobileList) return;
  if (!rows?.length){
    els.mobileList.innerHTML = `<p class="history-empty">Ainda não há capturas realizadas.</p>`;
    return;
  }
  els.mobileList.innerHTML = rows.slice(0,20).map(r => `
    <div class="cap-row">
      <div class="cap-time">${fmtDate(r.ts)}</div>
      <div class="cap-euro">${r.eurocode ? `<strong>${escapeHtml(r.eurocode)}</strong>` : "—"}</div>
      <div class="cap-text">${escapeHtml((r.text || "").slice(0,160))}${(r.text || "").length > 160 ? "…" : ""}</div>
    </div>
  `).join("");
}

/* =========================
 * FLOW
 * ========================= */
async function refresh(){
  try{
    const rows = await apiList();
    renderTable(rows);
    renderMobile(rows);
    wireRowActions();
  }catch(e){
    console.error(e);
    toast("Não consegui carregar os registos.", "err");
  }
}
function wireRowActions(){
  // apagar
  document.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async () => {
      try{
        await apiDelete(Number(btn.dataset.del));
        toast("Registo apagado.");
        refresh();
      }catch(e){
        console.error(e);
        toast("Erro a apagar.", "err");
      }
    };
  });
  // editar eurocode
  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.onclick = async () => {
      try{
        const id = Number(btn.dataset.edit);
        const val = prompt("Editar Eurocode:");
        if (val === null) return;
        const clean = (val || "").toUpperCase().replace(/[^A-Z0-9]/g,"");
        await apiUpdate(id, { eurocode: clean });
        toast("Eurocode atualizado.");
        refresh();
      }catch(e){
        console.error(e);
        toast("Erro a atualizar.", "err");
      }
    };
  });
}

async function handleFiles(files){
  const file = files?.[0];
  if (!file) return;
  try{
    toast("A ler etiqueta…");
    const text = await doOCR(file);
    const euro = parseEurocode(text);
    const row = {
      ts: new Date().toISOString(),
      text,
      eurocode: euro
    };
    await apiSave(row);
    toast(euro ? `EUROCODE: ${euro}` : "Texto lido. Eurocode não detetado.");
    refresh();
  }catch(e){
    console.error(e);
    toast("Falha no OCR/guardar.", "err");
  }
}

/* =========================
 * INIT
 * ========================= */
function init(){
  // Abrir câmara ao clicar no botão
  els.btnCamera?.addEventListener("click", () => els.camInput?.click());

  // Inputs de ficheiros
  els.camInput?.addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });
  els.btnUpload?.addEventListener("click", () => els.fileInput?.click());
  els.fileInput?.addEventListener("change", e => { handleFiles(e.target.files); e.target.value = ""; });

  // Exportar CSV
  els.btnExport?.addEventListener("click", async () => {
    try{
      const rows = await apiList();
      if (!rows.length) return toast("Sem dados para exportar.");
      const csv = toCSV(rows);
      const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `capturas_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    }catch(e){
      console.error(e);
      toast("Erro a exportar.", "err");
    }
  });

  // Limpar tudo (se o endpoint existir)
  els.btnClear?.addEventListener("click", async () => {
    if (!confirm("Limpar todos os registos?")) return;
    try{
      await apiClear();
      toast("Tabela limpa.");
      refresh();
    }catch(e){
      console.error(e);
      toast("Não consegui limpar (endpoint ausente?).", "err");
    }
  });

  wireHelp();
  refresh();
}
document.addEventListener("DOMContentLoaded", init);