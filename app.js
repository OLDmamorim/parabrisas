/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy"; // função Netlify: netlify/functions/ocr-proxy.mjs
const DEMO_MODE = false; // true = simula OCR sem backend

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";

const cameraBtn   = document.getElementById("btnCamera");
const cameraInput = document.getElementById("cameraInput");
const mobileStatus = document.getElementById("mobileStatus");

const uploadBtn   = document.getElementById("btnUpload");
const fileInput   = document.getElementById("fileInput");
const exportBtn   = document.getElementById("btnExport");
const clearBtn    = document.getElementById("btnClear");
const resultsBody = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");

const toast = document.getElementById("toast");

/* ===== (Opcional) injectar CSS para o texto OCR ficar em linha corrida ===== */
(function injectOCRCss(){
  const id = "ocr-text-style";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .ocr-text{ white-space: normal; overflow-wrap: anywhere; line-height: 1.4; }
  `;
  document.head.appendChild(s);
})();

/* ===== Storage (local) ===== */
const STORAGE_KEY = "express_ocr_results_v1";
const loadResults = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const saveResults = (rows) => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));

/* ===== Persistência no Neon (API) ===== */
async function persistToDB({ ts, text, filename, origin }) {
  try {
    const resp = await fetch('/api/save-ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ts, text, filename, source: origin })
    });
    const txt = await resp.text();
    console.log('[save-ocr] status:', resp.status, 'body:', txt);
    if (!resp.ok) throw new Error(txt || ('HTTP ' + resp.status));
  } catch (e) {
    console.warn('Falha ao gravar no Neon:', e.message);
    try { toast && (toast.textContent = '⚠️ Neon: ' + e.message); toast && toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 2500); } catch {}
  }
}

async function loadServerRows(){
  try{
    const r = await fetch('/api/list-ocr');
    if(!r.ok) throw new Error('HTTP '+r.status);
    const { rows } = await r.json();
    // normaliza para o formato usado localmente
    return rows.map(x => ({
      ts: new Date(x.ts).getTime(),
      text: x.text || '',
      filename: x.filename || '',
      source: x.source || ''
    }));
  }catch(e){
    console.warn('Sem Neon (uso local):', e.message);
    return null;
  }
}

/* ===== Render ===== */
function renderTable(){
  if(!isDesktop) return;
  const rows = loadResults();
  resultsBody.innerHTML = "";
  rows.forEach((r,i)=>{
    const compactText = (r.text || "").replace(/\s*\n\s*/g, " ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${compactText}</div></td>`;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = rows.length ? `${rows.length} registo(s).` : "Sem registos ainda.";
}

/* ===== Bootstrap (carrega do Neon ao abrir) ===== */
async function bootstrap(){
  if(isDesktop){
    const serverRows = await loadServerRows();
    if (serverRows && serverRows.length){
      saveResults(serverRows); // cache local para navegação rápida
    }
    renderTable();
  }
}
bootstrap();

/* ===== Toast ===== */
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2200);
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

/* ===== Common handler ===== */
async function handleImage(file, origin="camera"){
  try{
    (isDesktop ? desktopStatus : mobileStatus).textContent = "A processar…";
    const data = await runOCR(file);

    const rows = loadResults();
    rows.unshift({
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    });
    saveResults(rows);

    // Gravar também no Neon
    await persistToDB({
      ts: rows[0].ts,
      text: rows[0].text,
      filename: rows[0].filename,
      origin
    });

    renderTable();
    showToast("✅ OCR concluído");
  }catch(err){
    console.error(err);
    (isDesktop ? desktopStatus : mobileStatus).textContent = "Erro: " + err.message;
    if(!DEMO_MODE) showToast("Falha no OCR. Verifica o endpoint ou ativa DEMO_MODE para testar.");
  }finally{
    (isDesktop ? desktopStatus : mobileStatus).textContent = "";
  }
}

/* ===== Mobile camera ===== */
cameraBtn?.addEventListener("click", () => cameraInput.click());
cameraInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "camera");
  cameraInput.value = ""; // permite nova captura
});

/* ===== Desktop actions ===== */
uploadBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "upload");
  fileInput.value = "";
});
exportBtn?.addEventListener("click", () => {
  const rows = loadResults();
  if(!rows.length) return showToast("Nada para exportar");
  const header = ["idx","timestamp","text"];
  const lines = [header.join(",")].concat(
    rows.map((r,i)=>[
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
  if(confirm("Apagar todos os registos da tabela?")){
    saveResults([]); renderTable(); showToast("Tabela limpa");
  }
});