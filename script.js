/* =========================
 * CONFIG
 * ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;

/* =========================
 * HELPERS
 * ========================= */
const $  = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const fmtDate = (d) => {
  const dt = (d instanceof Date) ? d : new Date(d);
  const pad = (n)=> String(n).padStart(2,'0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};

/** Normaliza texto do OCR: remove quebras de linha e espaços extra */
function normalizeOcrText(txt){
  if (!txt) return "";
  // junta linhas -> um espaço; remove múltiplos espaços; trim
  return String(txt)
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\u0000/g, "")   // caracteres nulos estranhos
    .trim();
}

/** Extrai eurocode do texto (regra: 4 dígitos + 2 a 9 caracteres alfanuméricos) */
function extractEurocode(txt){
  if (!txt) return null;
  // Permitimos espaços/hífens intermédios no reconhecimento e depois limpamos
  const pattern = /(\d{4}[\s\-A-Z0-9]{2,12})/gi;
  const matches = [];
  let m;
  while ((m = pattern.exec(txt)) !== null) {
    let cand = m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^\d{4}[A-Z0-9]{2,9}$/.test(cand)) {
      matches.push(cand);
    }
  }
  // Escolhe o primeiro candidato válido
  return matches[0] || null;
}

/** Valida eurocode já “limpo” */
function isValidEurocode(code){
  return typeof code === "string" && /^\d{4}[A-Z0-9]{2,9}$/.test(code);
}

/* =========================
 * RENDERIZAÇÃO DA TABELA
 * ========================= */
async function loadRows(){
  try{
    const res = await fetch(LIST_URL);
    if(!res.ok) throw new Error("Falha ao carregar lista.");
    const data = await res.json(); // espera [{id, created_at, ocr_text, eurocode, valid}]
    renderTable(data || []);
  }catch(err){
    console.error(err);
    renderTable([]);
  }
}

function renderTable(rows){
  const tbody = $("#ocrTableBody");
  if(!tbody) return;
  tbody.innerHTML = "";

  rows.forEach(row=>{
    const tr = document.createElement("tr");

    // Data/Hora
    const tdTime = document.createElement("td");
    tdTime.className = "time-col";
    tdTime.textContent = fmtDate(row.created_at || new Date());
    tr.appendChild(tdTime);

    // Texto OCR (compactado + scroll)
    const tdOcr = document.createElement("td");
    tdOcr.className = "ocr-col";
    const ocr = document.createElement("div");
    ocr.className = "ocr-text";
    ocr.textContent = normalizeOcrText(row.ocr_text || "");
    tdOcr.appendChild(ocr);
    tr.appendChild(tdOcr);

    // Eurocode + estado
    const tdEuro = document.createElement("td");
    tdEuro.className = "euro-col";
    const badge = document.createElement("span");
    const valid = !!row.valid && isValidEurocode(row.eurocode);
    badge.className = "badge " + (valid ? "green" : "red");
    badge.innerHTML = `${row.eurocode ? row.eurocode : "—"} <span class="hint">${valid ? "validado" : "inválido"}</span>`;
    tdEuro.appendChild(badge);
    tr.appendChild(tdEuro);

    tbody.appendChild(tr);
  });
}

/* =========================
 * CAPTURA/ENVIO OCR
 * ========================= */
// Exemplo: botão que dispara a captura (ou upload) e envia ao backend OCR
async function handleCaptureOrUpload(fileOrBlob){
  // 1) envia para OCR
  const form = new FormData();
  form.append("file", fileOrBlob, "captura.jpg");

  const ocrRes = await fetch(OCR_ENDPOINT, { method:"POST", body: form });
  if(!ocrRes.ok) throw new Error("Falha no OCR.");
  const ocrData = await ocrRes.json(); // { text: "...", ... }

  // 2) normaliza texto
  const cleanText = normalizeOcrText(ocrData.text || "");

  // 3) extrai/valida eurocode
  const eurocode = extractEurocode(cleanText);
  const valid = isValidEurocode(eurocode);

  // 4) grava no Neon via API
  const payload = {
    ocr_text: cleanText,
    eurocode: eurocode,
    valid: valid
  };

  const saveRes = await fetch(SAVE_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  if(!saveRes.ok) throw new Error("Falha ao gravar registo.");
  // 5) recarrega tabela
  await loadRows();
}

/* =========================
 * LIMPESA TABELA (opcional)
 * ========================= */
async function clearTable(){
  if(!confirm("Limpar todos os registos?")) return;
  const res = await fetch(DELETE_URL, { method:"POST" });
  if(!res.ok) { alert("Falha ao limpar."); return; }
  await loadRows();
}

/* =========================
 * INICIALIZAÇÃO
 * ========================= */
window.addEventListener("DOMContentLoaded", () => {
  // liga botões se existirem
  const btnClear = $("#btnClear");
  if (btnClear) btnClear.addEventListener("click", clearTable);

  // Se tiveres um input file para upload manual:
  const fileInput = $("#ocrFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", async (e)=>{
      const f = e.target.files?.[0];
      if(!f) return;
      try{
        await handleCaptureOrUpload(f);
      }catch(err){
        console.error(err);
        alert("Ocorreu um erro no processamento do OCR.");
      }finally{
        fileInput.value = "";
      }
    });
  }

  // carrega dados
  loadRows();
});