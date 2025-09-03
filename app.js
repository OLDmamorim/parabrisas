/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/.netlify/functions/ocr-proxy"; // função Netlify: netlify/functions/ocr-proxy.mjs
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

/* ===== Storage ===== */
const STORAGE_KEY = "express_ocr_results_v1";
const loadResults = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const saveResults = (rows) => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));

/* ===== Render ===== */
function renderTable(){
  if(!isDesktop) return;
  const rows = loadResults();
  resultsBody.innerHTML = "";
  rows.forEach((r,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><pre>${r.text || ""}</pre></td>`;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = rows.length ? `${rows.length} registo(s).` : "Sem registos ainda.";
}
renderTable();

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
      // Guardamos filename internamente caso um dia queiras voltar a mostrar/exportar
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    });
    saveResults(rows);

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
  const header = ["idx","timestamp","text"]; // removido filename
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