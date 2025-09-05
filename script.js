/* ===== CONFIG =====
   Mantém os mesmos endpoints das tuas Netlify Functions.
   Se LIST_URL falhar, mostramos um banner com o motivo.
*/
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;

/* ===== HELPERS ===== */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2,"0");
const fmtDate = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};
function showError(msg){
  const b = $("#errorBanner");
  if(!b) return;
  b.textContent = msg;
  b.classList.remove("hidden");
}
function hideError(){
  $("#errorBanner")?.classList.add("hidden");
}

/* Normaliza texto OCR para linha corrida */
function normalizeOcrText(txt){
  if (!txt) return "";
  return String(txt)
    .replace(/\r\n/g,"\n")
    .replace(/\n+/g," ")
    .replace(/[ \t]+/g," ")
    .replace(/\u0000/g,"")
    .trim();
}

/* Eurocode: 4 dígitos + 2 a 9 alfanuméricos (aceita ruído intermédio e limpa) */
function extractEurocode(txt){
  if (!txt) return null;
  const pattern = /(\d{4}[\s\-A-Z0-9]{2,12})/gi;
  let m, cand;
  while ((m = pattern.exec(txt)) !== null) {
    cand = m[1].toUpperCase().replace(/[^A-Z0-9]/g,"");
    if (/^\d{4}[A-Z0-9]{2,9}$/.test(cand)) return cand;
  }
  return null;
}
const isValidEurocode = (code) => typeof code === "string" && /^\d{4}[A-Z0-9]{2,9}$/.test(code);

/* ===== TABELA ===== */
function renderTable(rows){
  const tbody = $("#ocrTableBody");
  if(!tbody) return;
  tbody.innerHTML = "";

  rows.forEach((r,i)=>{
    const tr = document.createElement("tr");

    const tdIdx = document.createElement("td");
    tdIdx.className = "idx";
    tdIdx.textContent = i+1;
    tr.appendChild(tdIdx);

    const tdTime = document.createElement("td");
    tdTime.className = "time-col";
    tdTime.textContent = fmtDate(r.created_at || new Date());
    tr.appendChild(tdTime);

    const tdOcr = document.createElement("td");
    tdOcr.className = "ocr-col";
    const div = document.createElement("div");
    div.className = "ocr-text";
    div.textContent = normalizeOcrText(r.ocr_text || "");
    tdOcr.appendChild(div);
    tr.appendChild(tdOcr);

    const tdEuro = document.createElement("td");
    tdEuro.className = "euro-col";
    const ok = !!r.valid && isValidEurocode(r.eurocode);
    const badge = document.createElement("span");
    badge.className = "badge " + (ok ? "green" : "red");
    badge.innerHTML = `${r.eurocode || "—"} <span class="hint">${ok ? "validado" : "inválido"}</span>`;
    tdEuro.appendChild(badge);
    tr.appendChild(tdEuro);

    const tdAct = document.createElement("td");
    tdAct.className = "only-desktop";
    tdAct.innerHTML = "";
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  });
}

async function loadRows(){
  try{
    hideError();
    const res = await fetch(LIST_URL, { headers:{ "Accept":"application/json" } });
    if(!res.ok){
      const txt = await res.text().catch(()=> "");
      throw new Error(`LIST falhou (${res.status}) ${txt || ""}`.trim());
    }
    const rows = await res.json();
    renderTable(rows || []);
  }catch(err){
    console.error(err);
    showError("Sem ligação à base de dados (falha em /api/list-ocr). Verifica endpoints e variáveis no Netlify.");
    renderTable([]);
  }
}

/* ===== OCR / UPLOAD ===== */
async function handleUpload(file){
  const form = new FormData();
  form.append("file", file, file.name || "captura.jpg");

  // 1) OCR
  const ocrRes = await fetch(OCR_ENDPOINT, { method:"POST", body: form });
  if(!ocrRes.ok){
    const t = await ocrRes.text().catch(()=> "");
    throw new Error(`OCR falhou (${ocrRes.status}) ${t}`);
  }
  const { text = "" } = await ocrRes.json();

  // 2) Limpa + extrai
  const cleanText = normalizeOcrText(text);
  const eurocode  = extractEurocode(cleanText);
  const valid     = isValidEurocode(eurocode);

  // 3) Grava
  const saveRes = await fetch(SAVE_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ ocr_text: cleanText, eurocode, valid })
  });
  if(!saveRes.ok){
    const t = await saveRes.text().catch(()=> "");
    throw new Error(`SAVE falhou (${saveRes.status}) ${t}`);
  }
}

/* ===== CSV ===== */
function rowsToCSV(rows){
  const header = ["#", "Data/Hora", "Texto lido (OCR)", "Eurocode", "Validado"];
  const lines = [header.join(";")];
  rows.forEach((r, i)=>{
    const line = [
      i+1,
      fmtDate(r.created_at || new Date()),
      `"${normalizeOcrText(r.ocr_text||"").replace(/"/g,'""')}"`,
      r.eurocode || "",
      (r.valid && isValidEurocode(r.eurocode)) ? "Sim" : "Não"
    ];
    lines.push(line.join(";"));
  });
  return lines.join("\n");
}
async function exportCSV(){
  try{
    const res = await fetch(LIST_URL);
    if(!res.ok) throw new Error(`LIST falhou (${res.status})`);
    const rows = await res.json();
    const csv  = rowsToCSV(rows || []);
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href:url, download:`ocr_expressglass_${Date.now()}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }catch(err){
    console.error(err);
    showError("Não foi possível exportar CSV (DB offline?).");
  }
}

/* ===== LIMPAR ===== */
async function clearTable(){
  if(!confirm("Limpar todos os registos?")) return;
  try{
    const res = await fetch(DELETE_URL, { method:"POST" });
    if(!res.ok) throw new Error(`DELETE falhou (${res.status})`);
    await loadRows();
  }catch(err){
    console.error(err);
    showError("Falha ao limpar dados (DB offline?).");
  }
}

/* ===== INIT ===== */
window.addEventListener("DOMContentLoaded", ()=>{
  const input = $("#ocrFileInput");
  input?.addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    try{
      hideError();
      await handleUpload(f);
      await loadRows();
    }catch(err){
      console.error(err);
      showError(err.message || "Erro no processamento.");
    }finally{
      input.value = "";
    }
  });

  $("#btnExport")?.addEventListener("click", exportCSV);
  $("#btnClear")?.addEventListener("click", clearTable);

  loadRows(); // tenta ligar à DB logo ao abrir
});