/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr"; // se quiseres editar no futuro
const DEMO_MODE    = false;

/* ===== HELPERS ===== */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

const pad = n => String(n).padStart(2,"0");
const fmtDate = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};

function normalizeOcrText(txt){
  if (!txt) return "";
  return String(txt)
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

// 4 dígitos + 2 a 9 alfanuméricos (aceita ruído com espaços/hífens, depois limpa)
function extractEurocode(txt){
  if (!txt) return null;
  const pattern = /(\d{4}[\s\-A-Z0-9]{2,12})/gi;
  let m, cand;
  while ((m = pattern.exec(txt)) !== null) {
    cand = m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^\d{4}[A-Z0-9]{2,9}$/.test(cand)) return cand;
  }
  return null;
}
const isValidEurocode = (code) => typeof code === "string" && /^\d{4}[A-Z0-9]{2,9}$/.test(code);

/* ===== TABELA ===== */
async function loadRows(){
  try{
    const res = await fetch(LIST_URL);
    if(!res.ok) throw new Error("Falha ao carregar lista");
    const rows = await res.json(); // [{id, created_at, ocr_text, eurocode, valid}]
    renderTable(rows || []);
  }catch(e){
    console.error(e);
    renderTable([]);
  }
}

function renderTable(rows){
  const tbody = $("#ocrTableBody");
  tbody.innerHTML = "";

  rows.forEach((r, i) => {
    const tr = document.createElement("tr");

    // #
    const tdIdx = document.createElement("td");
    tdIdx.className = "idx";
    tdIdx.textContent = String(i+1);
    tr.appendChild(tdIdx);

    // Data/Hora
    const tdTime = document.createElement("td");
    tdTime.className = "time-col";
    tdTime.textContent = fmtDate(r.created_at || new Date());
    tr.appendChild(tdTime);

    // Texto OCR
    const tdOcr = document.createElement("td");
    tdOcr.className = "ocr-col";
    const div = document.createElement("div");
    div.className = "ocr-text";
    div.textContent = normalizeOcrText(r.ocr_text || "");
    tdOcr.appendChild(div);
    tr.appendChild(tdOcr);

    // Eurocode
    const tdEuro = document.createElement("td");
    tdEuro.className = "euro-col";
    const valid = !!r.valid && isValidEurocode(r.eurocode);
    const badge = document.createElement("span");
    badge.className = "badge " + (valid ? "green" : "red");
    badge.innerHTML = `${r.eurocode ? r.eurocode : "—"} <span class="hint">${valid ? "validado" : "inválido"}</span>`;
    tdEuro.appendChild(badge);
    tr.appendChild(tdEuro);

    // Ações (desktop)
    const tdAct = document.createElement("td");
    tdAct.className = "only-desktop";
    tdAct.innerHTML = ""; // reservado para futuro (editar/apagar)
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  });
}

/* ===== OCR / UPLOAD ===== */
async function handleUpload(file){
  const form = new FormData();
  form.append("file", file, file.name || "captura.jpg");

  // Chama OCR
  const ocrRes = await fetch(OCR_ENDPOINT, { method:"POST", body: form });
  if(!ocrRes.ok) throw new Error("Falha no OCR");
  const { text = "" } = await ocrRes.json();

  // Normaliza + extrai eurocode
  const cleanText = normalizeOcrText(text);
  const eurocode  = extractEurocode(cleanText);
  const valid     = isValidEurocode(eurocode);

  // Grava no Neon
  const saveRes = await fetch(SAVE_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ ocr_text: cleanText, eurocode, valid })
  });
  if(!saveRes.ok) throw new Error("Falha ao guardar");
}

/* ===== CSV EXPORT ===== */
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
  const res = await fetch(LIST_URL);
  if(!res.ok) { alert("Não foi possível obter os dados."); return; }
  const rows = await res.json();
  const csv  = rowsToCSV(rows || []);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `ocr_expressglass_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ===== LIMPAR TABELA ===== */
async function clearTable(){
  if(!confirm("Limpar todos os registos?")) return;
  const res = await fetch(DELETE_URL, { method:"POST" });
  if(!res.ok){ alert("Falha ao limpar."); return; }
  await loadRows();
}

/* ===== INIT ===== */
window.addEventListener("DOMContentLoaded", ()=>{
  // Botões
  const input = $("#ocrFileInput");
  input?.addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    try{
      await handleUpload(f);
      await loadRows();
    }catch(err){
      console.error(err);
      alert("Erro no processamento da imagem.");
    }finally{
      input.value = "";
    }
  });

  $("#btnClear")?.addEventListener("click", clearTable);
  $("#btnExport")?.addEventListener("click", exportCSV);

  // Carregar tabela
  loadRows();
});