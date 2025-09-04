/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DEMO_MODE    = false;

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

/* ===== CSS para texto corrido ===== */
(function(){
  const id = "ocr-text-style";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .ocr-text{ white-space: normal; overflow-wrap:anywhere; line-height:1.4 }
    .error { background:#300; color:#fff; padding:6px; border-radius:6px }
    .progress { background:#222; height:6px; border-radius:3px; margin-top:4px }
    .progress span{ display:block; height:100%; background:#3b82f6; border-radius:3px }
    .btn-icon { cursor:pointer; border:none; background:none; font-size:16px }
  `;
  document.head.appendChild(s);
})();

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== Helpers UI ===== */
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2200);
}
function statusEl(){ return isDesktop ? desktopStatus : mobileStatus; }
function setStatus(html, opts={}) {
  const el = statusEl();
  el.classList.toggle("error", !!opts.error);
  el.innerHTML = html || "";
}
function showProgress(label, pct=0, asError=false){
  const el = statusEl();
  el.classList.toggle("error", !!asError);
  el.innerHTML = `
    <div>${label}</div>
    <div class="progress"><span style="width:${pct}%"></span></div>
  `;
}
function updateProgress(pct){
  const el = statusEl();
  const bar = el.querySelector(".progress > span");
  if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
}
function showError(message){
  const el = statusEl();
  el.classList.add("error");
  el.innerHTML = `
    <div>❌ ${message}</div>
    <div class="progress"><span style="width:0%"></span></div>
    <button class="retry-btn" id="retryBtn">🔄 Tentar novamente</button>
  `;
  document.getElementById("retryBtn")?.addEventListener("click", ()=> lastFile && handleImage(lastFile, "retry"));
}

/* ===== Cabeçalho da tabela ===== */
function ensureActionsHeader() {
  if (!isDesktop) return;
  const thead = document.querySelector("#resultsTable thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr>
      <th style="width:60px">#</th>
      <th style="width:220px">Data/Hora</th>
      <th style="width:auto">Texto lido (OCR)</th>
      <th style="width:80px">Ações</th>
    </tr>
  `;
}

/* ===== Render da tabela ===== */
function renderTable(){
  if(!isDesktop) return;
  ensureActionsHeader();
  resultsBody.innerHTML = "";
  RESULTS.forEach((r,i)=>{
    const txt = (r.text || "").replace(/\s*\n\s*/g, " ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${txt}</div></td>
      <td>
        <button class="btn-icon delBtn" title="Apagar" data-id="${r.id}">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });
  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";

  // listeners para apagar linhas
  document.querySelectorAll(".delBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      RESULTS = RESULTS.filter(r=>r.id!=id);
      renderTable();
    });
  });
}

/* ===== Neon API ===== */
async function fetchServerRows(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const { rows } = await r.json();
  return rows.map(x => ({
    id: x.id,
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
async function optimizeImageForOCR(file){
  const srcBlob = file instanceof Blob ? file : new Blob([file]);
  const bmp = await createImageBitmap(srcBlob);
  const scale = Math.min(1600 / bmp.width, 1600 / bmp.height, 1);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bmp, 0, 0, w, h);
  const out = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
  return new File([out], (file.name || 'foto') + '.jpg', { type: 'image/jpeg' });
}
async function runOCR(file){
  if (DEMO_MODE){
    await new Promise(r=>setTimeout(r, 500));
    return { text: "DEMO: Texto simulado de OCR\nLinha 2: 123 ABC" };
  }
  const optimized = await optimizeImageForOCR(file);
  const fd = new FormData();
  fd.append("file", optimized, optimized.name);
  const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });
  const t = await res.text().catch(()=>res.statusText);
  if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
  return JSON.parse(t);
}

/* ===== Fluxo ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 10);
    await new Promise(r=>setTimeout(r, 150));

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
      id: Date.now().toString(),
      ts: Date.now(),
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    showProgress("A gravar no Neon…", 90);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    RESULTS = await fetchServerRows();
    renderTable();

    showProgress("Concluído ✅", 100);
    setTimeout(()=> setStatus(""), 400);
    showToast("OCR concluído");
  }catch(err){
    console.error(err);
    showError(err.message || "Erro inesperado");
    showToast("Falha no OCR");
  }
}

/* ===== Bootstrap ===== */
(async function(){
  if(!isDesktop) return;
  try { RESULTS = await fetchServerRows(); }
  catch(e){ console.warn("Sem Neon:", e.message); RESULTS = []; }
  renderTable();
})();

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
exportBtn?.addEventListener("click", async () => {
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

/* ===== MODAL DE AJUDA ===== */
const helpModal = document.getElementById("helpModal");
const helpBtn = document.getElementById("helpBtn");
const helpBtnDesktop = document.getElementById("helpBtnDesktop");
const helpClose = document.getElementById("helpClose");

function showHelpModal() {
  helpModal.classList.add("show");
}

function hideHelpModal() {
  helpModal.classList.remove("show");
}

// Event listeners para o modal de ajuda
helpBtn?.addEventListener("click", showHelpModal);
helpBtnDesktop?.addEventListener("click", showHelpModal);
helpClose?.addEventListener("click", hideHelpModal);

// Fechar modal ao clicar fora
helpModal?.addEventListener("click", (e) => {
  if (e.target === helpModal) {
    hideHelpModal();
  }
});

// Fechar modal com ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && helpModal.classList.contains("show")) {
    hideHelpModal();
  }
});

/* ===== FEEDBACK VISUAL MELHORADO ===== */
function showToastWithType(msg, type = 'info') {
  toast.textContent = msg;
  toast.classList.remove('success', 'error');
  if (type === 'success') {
    toast.classList.add('success');
  } else if (type === 'error') {
    toast.classList.add('error');
  }
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function setCardState(state) {
  const card = isDesktop ? document.getElementById("desktopView") : document.getElementById("mobileView");
  card.classList.remove('success', 'error');
  if (state === 'success') {
    card.classList.add('success');
    setTimeout(() => card.classList.remove('success'), 3000);
  } else if (state === 'error') {
    card.classList.add('error');
    setTimeout(() => card.classList.remove('error'), 3000);
  }
}

function addFeedbackIcon(message, type) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return `<span class="feedback-icon">${icons[type] || icons.info}</span>${message}`;
}

/* ===== ANIMAÇÕES DO BOTÃO ===== */
function animateCameraButton(state) {
  if (!cameraBtn) return;
  
  cameraBtn.classList.remove('pulse');
  
  if (state === 'processing') {
    cameraBtn.style.transform = 'scale(0.95)';
    cameraBtn.style.opacity = '0.7';
  } else if (state === 'success') {
    cameraBtn.style.transform = 'scale(1.05)';
    cameraBtn.style.borderColor = 'var(--success)';
    setTimeout(() => {
      cameraBtn.style.transform = '';
      cameraBtn.style.borderColor = '';
      cameraBtn.classList.add('pulse');
    }, 1000);
  } else if (state === 'error') {
    cameraBtn.style.transform = 'scale(1.05)';
    cameraBtn.style.borderColor = 'var(--danger)';
    setTimeout(() => {
      cameraBtn.style.transform = '';
      cameraBtn.style.borderColor = '';
      cameraBtn.classList.add('pulse');
    }, 1000);
  } else {
    // reset
    cameraBtn.style.transform = '';
    cameraBtn.style.opacity = '';
    cameraBtn.style.borderColor = '';
    cameraBtn.classList.add('pulse');
  }
}

/* ===== OVERRIDE DAS FUNÇÕES EXISTENTES ===== */
// Melhorar a função showToast existente
const originalShowToast = showToast;
showToast = function(msg, type = 'info') {
  showToastWithType(msg, type);
};

// Melhorar a função setStatus existente
const originalSetStatus = setStatus;
setStatus = function(html, opts = {}) {
  const el = statusEl();
  el.classList.toggle("error", !!opts.error);
  
  if (opts.error) {
    html = addFeedbackIcon(html, 'error');
    setCardState('error');
  } else if (opts.success) {
    html = addFeedbackIcon(html, 'success');
    setCardState('success');
  }
  
  el.innerHTML = html || "";
};

// Melhorar a função showError existente
const originalShowError = showError;
showError = function(message) {
  const el = statusEl();
  el.classList.add("error");
  el.innerHTML = `
    <div>${addFeedbackIcon(message, 'error')}</div>
    <div class="progress"><span style="width:0%"></span></div>
    <button class="retry-btn" id="retryBtn">🔄 Tentar novamente</button>
  `;
  document.getElementById("retryBtn")?.addEventListener("click", () => lastFile && handleImage(lastFile, "retry"));
  
  setCardState('error');
  animateCameraButton('error');
  showToast(message, 'error');
};

/* ===== MELHORAR FLUXO DE HANDLEIMAGE ===== */
const originalHandleImage = handleImage;
handleImage = async function(file, origin = "camera") {
  lastFile = file;
  animateCameraButton('processing');
  
  try {
    showProgress("A preparar imagem…", 10);
    await new Promise(r => setTimeout(r, 150));

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    const fd = new FormData();
    fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method: "POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(() => res.statusText);
    if (!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
      id: Date.now().toString(),
      ts: Date.now(),
      filename: file.name || (origin === "camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    showProgress("A gravar no Neon…", 90);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    RESULTS = await fetchServerRows();
    renderTable();

    showProgress(addFeedbackIcon("Concluído", 'success'), 100);
    setTimeout(() => setStatus(""), 400);
    
    animateCameraButton('success');
    setCardState('success');
    showToast("OCR concluído com sucesso!", 'success');
    
  } catch (err) {
    console.error(err);
    showError(err.message || "Erro inesperado");
  }
};

/* ===== HISTÓRICO DE CAPTURAS (PREPARAÇÃO) ===== */
let captureHistory = [];

function addToHistory(capture) {
  captureHistory.unshift(capture);
  if (captureHistory.length > 10) {
    captureHistory = captureHistory.slice(0, 10);
  }
  localStorage.setItem('expressglass_history', JSON.stringify(captureHistory));
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('expressglass_history');
    if (saved) {
      captureHistory = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Erro ao carregar histórico:', e);
    captureHistory = [];
  }
}

// Carregar histórico ao inicializar
loadHistory();

console.log('✅ Melhorias EXPRESSGLASS carregadas com sucesso!');


/* ===== GESTÃO DO HISTÓRICO DE CAPTURAS ===== */
const mobileHistoryList = document.getElementById("mobileHistoryList");

function renderHistory() {
  if (!mobileHistoryList) return;
  
  if (captureHistory.length === 0) {
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há capturas realizadas.</p>';
    return;
  }
  
  mobileHistoryList.innerHTML = captureHistory.map((capture, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-item-header">
        <span class="history-item-time">${formatTime(capture.timestamp)}</span>
        <div class="history-item-actions">
          <button class="history-action-btn copy-btn" title="Copiar texto" data-index="${index}">📋</button>
          <button class="history-action-btn resend-btn" title="Reenviar" data-index="${index}">🔄</button>
          <button class="history-action-btn delete-btn" title="Apagar" data-index="${index}">🗑️</button>
        </div>
      </div>
      <div class="history-item-text">${capture.text || 'Sem texto detectado'}</div>
      <div class="history-item-filename">${capture.filename}</div>
    </div>
  `).join('');
  
  // Adicionar event listeners
  addHistoryEventListeners();
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function addHistoryEventListeners() {
  // Copiar texto
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      const capture = captureHistory[index];
      
      try {
        await navigator.clipboard.writeText(capture.text || '');
        showToast('Texto copiado!', 'success');
      } catch (err) {
        // Fallback para browsers mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = capture.text || '';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Texto copiado!', 'success');
      }
    });
  });
  
  // Reenviar captura
  document.querySelectorAll('.resend-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      const capture = captureHistory[index];
      
      try {
        showProgress("A reenviar captura…", 50);
        await persistToDB({
          ts: Date.now(),
          text: capture.text,
          filename: capture.filename + ' (reenviado)',
          origin: 'resend'
        });
        
        RESULTS = await fetchServerRows();
        renderTable();
        
        showProgress(addFeedbackIcon("Reenviado com sucesso", 'success'), 100);
        setTimeout(() => setStatus(""), 400);
        showToast('Captura reenviada!', 'success');
        
      } catch (err) {
        showError('Erro ao reenviar: ' + err.message);
      }
    });
  });
  
  // Apagar do histórico
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      
      if (confirm('Apagar esta captura do histórico?')) {
        captureHistory.splice(index, 1);
        saveHistory();
        renderHistory();
        showToast('Captura removida do histórico', 'info');
      }
    });
  });
}

function saveHistory() {
  try {
    localStorage.setItem('expressglass_history', JSON.stringify(captureHistory));
  } catch (e) {
    console.warn('Erro ao guardar histórico:', e);
  }
}

function addCaptureToHistory(capture) {
  const historyItem = {
    timestamp: capture.ts,
    text: capture.text,
    filename: capture.filename,
    id: capture.id
  };
  
  captureHistory.unshift(historyItem);
  
  // Manter apenas as últimas 20 capturas
  if (captureHistory.length > 20) {
    captureHistory = captureHistory.slice(0, 20);
  }
  
  saveHistory();
  renderHistory();
}

/* ===== ATUALIZAR HANDLEIMAGE PARA INCLUIR HISTÓRICO ===== */
const originalHandleImageWithHistory = handleImage;
handleImage = async function(file, origin = "camera") {
  lastFile = file;
  animateCameraButton('processing');
  
  try {
    showProgress("A preparar imagem…", 10);
    await new Promise(r => setTimeout(r, 150));

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    const fd = new FormData();
    fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method: "POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(() => res.statusText);
    if (!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);

    const row = {
      id: Date.now().toString(),
      ts: Date.now(),
      filename: file.name || (origin === "camera" ? "captura.jpg" : "imagem"),
      text: data?.text || (data?.qr ? `QR: ${data.qr}` : "")
    };

    showProgress("A gravar no Neon…", 90);
    await persistToDB({ ts: row.ts, text: row.text, filename: row.filename, origin });

    // Adicionar ao histórico
    addCaptureToHistory(row);

    RESULTS = await fetchServerRows();
    renderTable();

    showProgress(addFeedbackIcon("Concluído", 'success'), 100);
    setTimeout(() => setStatus(""), 400);
    
    animateCameraButton('success');
    setCardState('success');
    showToast("OCR concluído com sucesso!", 'success');
    
  } catch (err) {
    console.error(err);
    showError(err.message || "Erro inesperado");
  }
};

// Renderizar histórico ao carregar
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
});

// Também renderizar se já carregou
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderHistory);
} else {
  renderHistory();
}

console.log('📋 Histórico de capturas implementado com sucesso!');