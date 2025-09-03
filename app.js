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

/* ===== (CSS para texto corrido) ===== */
(function injectOCRCss(){
  const id = "ocr-text-style";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `.ocr-text{ white-space: normal; overflow-wrap: anywhere; line-height: 1.4; }`;
  document.head.appendChild(s);
})();

/* ===== Estado em memória (só Neon) ===== */
let RESULTS = [];

/* ===== UI ===== */
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
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* ===== API (Neon) ===== */
async function fetchServerRows(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const { rows } = await r.json();
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
  const txt = await resp.text().catch(()=>resp.statusText);
  if(!resp.ok) throw new Error(txt || ('HTTP ' + resp.status));
}

/* ===== OCR ===== */
/* Reduz a imagem no cliente para evitar 500s no backend (HEIC, fotos muito grandes, etc.) */
async function optimizeImageForOCR(file){
  const srcBlob = file instanceof Blob ? file : new Blob([file]);
  const imgBitmap = await createImageBitmap(srcBlob);
  const scale = Math.min(1600 / imgBitmap.width, 1600 / imgBitmap.height, 1);
  const w = Math.round(imgBitmap.width * scale);
  const h = Math.round(imgBitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgBitmap, 0, 0, w, h);
  const optimizedBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
  return new File([optimizedBlob], (file.name || 'foto') + '.jpg', { type: 'image/jpeg' });
}

async function runOCR(file){
  if (!file) throw new Error("Sem ficheiro");

  if (DEMO_MODE){
    await new Promise(r=>setTimeout(r, 500));
    return { text: "DEMO: Texto simulado de OCR\nLinha 2: 123 ABC" };
  }

  const optimizedFile = await optimizeImageForOCR(file);
  const fd = new FormData();
  fd.append("file", optimizedFile, optimizedFile.name);

  const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });
  const t = await res.text().catch(()=>res.statusText);
  if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
  return JSON.parse(t); // { text, filename }
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

    // 3) Ler do Neon para manter tudo sincronizado
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
    RESULTS = [];
  }
  renderTable();
}
bootstrap();

/* ===== Ações ===== */
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

clearBtn?.addEventListener("click", ()=>{
  RESULTS = [];
  renderTable();
  showToast("Vista limpa (dados no Neon mantidos)");
});