/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";     // Função Netlify do OCR
const LIST_URL     = "/api/list-ocr";      // Lê do Neon
const SAVE_URL     = "/api/save-ocr";      // Grava no Neon
const DEMO_MODE    = false;                // true = simula OCR

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

/* ===== (pequeno CSS para o texto ficar corrido) ===== */
(function injectOCRCss(){
  const id = "ocr-text-style";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `.ocr-text{ white-space: normal; overflow-wrap: anywhere; line-height: 1.4; }`;
  document.head.appendChild(s);
})();

/* ===== Estado em memória (fonte única) ===== */
let RESULTS = []; // <- Só dados vindos do Neon

/* ===== Helpers UI ===== */
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2200);
}

function renderTable(){
  if(!isDesktop) return;
  resultsBody.innerHTML = "";

  RESULTS.forEach((r,i)=>{
    const compactText = (r.text || "").replace(/\s*\n\s*/g, " ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${compactText}</div></td>`;
    resultsBody.appendChild(tr);
  });

  desktopStatus.textContent = RESULTS.length
    ? `${RESULTS.length} registo(s).`
    : "Sem registos ainda.";
}

/* ===== API (Neon) ===== */
async function fetchServerRows(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const { rows } = await r.json();
  // normaliza
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
  if(!resp.ok){
    const txt = await resp.text().catch(()=>resp.statusText);
    throw new Error(txt || ('HTTP ' + resp.status));
  }
}

/* ===== OCR ===== */
async function runOCR(file){
  if (!file) throw new Error("Sem ficheiro");

  if (DEMO_MODE){
    await new Promise(r=>setTimeout(r, 600));
    return { text: "DEMO: Texto simulado de OCR\nLinha 2: 123 ABC\nLinha 3: EXP-GLS" };
  }

  const fd = new FormData();
  fd.append("file", file, file.name || "foto.jpg");

  const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });
  if(!res.ok){
    const t = await res.text().catch(()=>res.statusText);
    throw new Error(`Falha no OCR: ${res.status} ${t}`);
  }
  return await res.json(); // { text, qr, filename }
}

/* ===== Fluxo comum ===== */
async function handleImage(file, origin="camera"){
  try{
    (isDesktop ? desktopStatus : mobileStatus).textContent = "A processar…";

    // 1) OCR
    const data = await runOCR(file);
    const row = {
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    // 2) Gravar no Neon
    await persistToDB({
      ts: row.ts, text: row.text, filename: row.filename, origin
    });

    // 3) Recarregar do Neon (fonte única)
    RESULTS = await fetchServerRows();
    renderTable();

    showToast("✅ OCR concluído");
  }catch(err){
    console.error(err);
    (isDesktop ? desktopStatus : mobileStatus).textContent = "Erro: " + err.message;
    showToast("Falha no processo: " + err.message);
  }finally{
    (isDesktop ? desktopStatus : mobileStatus).textContent = "";
  }
}

/* ===== Bootstrap ===== */
async function bootstrap(){
  if(!isDesktop) return;
  try{
    RESULTS = await fetchServerRows();
  }catch(e){
    console.warn("Sem Neon (lista):", e.message);
    RESULTS = []; // sem dados
  }
  renderTable();
}
bootstrap();

/* ===== Ações (mobile/desktop) ===== */
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

/* Exporta CSV a partir do que está no Neon (RESULTS) */
exportBtn?.addEventListener("click", () => {
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

/* Botão "Limpar Tabela" agora só limpa a vista local (não apaga no Neon) */
clearBtn?.addEventListener("click", async ()=>{
  RESULTS = [];
  renderTable();
  showToast("Vista limpa (dados no Neon mantidos)");
});