/* ===== CONFIG ===== */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;

/* ===== Elements ===== */
const isDesktop = window.matchMedia("(min-width: 900px)").matches;
document.getElementById("viewBadge").textContent = isDesktop ? "Desktop" : "Mobile";

let cameraBtn   = document.getElementById("btnCamera");
let cameraInput = document.getElementById("cameraInput");
const mobileStatus  = document.getElementById("mobileStatus");
const uploadBtn     = document.getElementById("btnUpload");
const fileInput     = document.getElementById("fileInput");
const exportBtn     = document.getElementById("btnExport");
const clearBtn      = document.getElementById("btnClear");
const resultsBody   = document.getElementById("resultsBody");
const desktopStatus = document.getElementById("desktopStatus");
const toast         = document.getElementById("toast");

/* ===== CSS inline ===== */
(() => {
  const id = "inline-style-app";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    .ocr-text{ white-space: normal; overflow-wrap:anywhere; line-height:1.4 }
    .error { background:#300; color:#fff; padding:6px; border-radius:6px }
    .progress { background:#222; height:6px; border-radius:3px; margin-top:4px }
    .progress span{ display:block; height:100%; background:#3b82f6; border-radius:3px }
    .btn-icon { cursor:pointer; border:none; background:none; font-size:16px }

    .euro { font-weight:700; padding:2px 6px; border-radius:6px; display:inline-block; }
    .euro-ok { background:#064e3b; color:#d1fae5; }
    .euro-miss { background:#7c2d12; color:#ffedd5; }
    .euro-cell { position:relative; }

    .euro-select-wrap{ display:flex; gap:6px; align-items:center; }
    .euro-choose-btn{ border:1px solid #334155; background:#0b1220; color:#e5e7eb; padding:4px 8px; border-radius:6px; cursor:pointer; }

    /* Painel Mobile */
    .mob-euro-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:9998; }
    .mob-euro{ position:fixed; left:0; right:0; bottom:0; z-index:9999; background:#0b1220; color:#e5e7eb; border-top-left-radius:18px; border-top-right-radius:18px; padding:14px; box-shadow:0 -8px 30px rgba(0,0,0,.4); max-height:72vh; overflow:auto; }
    .mob-euro h4{ margin:0 0 8px 0; font-size:16px; }
    .mob-euro table{ width:100%; border-collapse:collapse; margin-top:8px; }
    .mob-euro th, .mob-euro td{ border-bottom:1px solid #1f2937; padding:12px 8px; font-size:15px; }
    .mob-euro tr{ user-select:none; }
    .mob-euro tr.active{ background:#0f172a; }
    .mob-euro-actions{ display:flex; gap:8px; margin-top:12px; }
    .mob-btn{ padding:12px; border-radius:10px; border:1px solid #334155; background:#111827; color:#e5e7eb; flex:1; }
    .mob-btn.primary{ background:#2563eb; border-color:#2563eb; color:white; }
    .mob-btn.primary:disabled{ opacity:.6; }
    .mob-note{ font-size:12px; opacity:.8; margin-top:6px; }
    .toast.show{ opacity:1; }
  `;
  document.head.appendChild(s);
})();

/* ===== Estado ===== */
let RESULTS = [];
let lastFile = null;

/* ===== Back compat ===== */
function readEuroField(row){ 
  return row.euro_validado ?? row.euro_user ?? row.eurocode ?? row.euro ?? ""; 
}
function euroPayload(euro){ 
  return { euro_validado: euro, euro_user: euro, eurocode: euro }; 
}

/* ===== EUROCODE ===== */
const EURO_BASE_RE   = /^\d{4}[A-Z][A-Z0-9]{1,8}$/; // 6..13 chars
const STARTS_4_RE    = /^\d{4}/;
const SUSPECT_WORDS  = /FINAL|MATERIAL|VINYL|GLASS|INSPECT|TEST|QA|ALT|ALTERNATES/i;
const cleanTokens = (s='') => s.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);

function scoreCode(c){
  if (!EURO_BASE_RE.test(c)) return -999;
  let score = 0;
  if (/^00/.test(c)) score -= 12;
  const len = c.length;
  if (len >= 7 && len <= 10) score += 8;   // alvo 7–10
  if (len > 10) score -= 20;               // penaliza longos (ex. ...1R20)
  const letters = (c.match(/[A-Z]/g)||[]).length;
  if (letters >= 3) score += 4;
  if (/\d{2,}/.test(c.slice(5))) score += 3;
  if (SUSPECT_WORDS.test(c)) score -= 15;
  return score;
}
function buildCandidates(tokens){
  const out = new Set();
  for (const t of tokens) {
    if (EURO_BASE_RE.test(t)) out.add(t);
    if (t.length > 10 && EURO_BASE_RE.test(t.slice(0,10))) out.add(t.slice(0,10));
  }
  for (let i=0;i<tokens.length;i++){
    const t0 = tokens[i]; if (!STARTS_4_RE.test(t0)) continue;
    if (i+1<tokens.length){
      let t01 = (t0+tokens[i+1]).slice(0,13);
      if (EURO_BASE_RE.test(t01)) out.add(t01);
      if (t01.length > 10 && EURO_BASE_RE.test(t01.slice(0,10))) out.add(t01.slice(0,10));
    }
    if (i+2<tokens.length){
      let t012 = (t0+tokens[i+1]+tokens[i+2]).slice(0,13);
      if (EURO_BASE_RE.test(t012)) out.add(t012);
      if (t012.length > 10 && EURO_BASE_RE.test(t012.slice(0,10))) out.add(t012.slice(0,10));
    }
  }
  return Array.from(out);
}
function getEuroCandidates(text=''){
  const cands = buildCandidates(cleanTokens(text));
  cands.sort((a,b)=> scoreCode(b)-scoreCode(a));
  return cands;
}

/* ===== UI helpers ===== */
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2000);
}
const statusEl = () => isDesktop ? desktopStatus : mobileStatus;
function setStatus(html, opts={}) {
  const el = statusEl();
  el.classList.toggle("error", !!opts.error);
  el.innerHTML = html || "";
}
function showProgress(label, pct=0, asError=false){
  const el = statusEl();
  el.classList.toggle("error", !!asError);
  el.innerHTML = `<div>${label}</div><div class="progress"><span style="width:${pct}%"></span></div>`;
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

/* ===== Cabeçalho Desktop ===== */
function ensureActionsHeader() {
  if (!isDesktop) return;
  const thead = document.querySelector("#resultsTable thead");
  if (!thead) return;
  thead.innerHTML = `
    <tr>
      <th style="width:60px">#</th>
      <th style="width:220px">Data/Hora</th>
      <th style="width:auto">Texto lido (OCR)</th>
      <th style="width:260px">Eurocode</th>
      <th style="width:110px">Ações</th>
    </tr>
  `;
}

/* ===== API ===== */
async function fetchServerRows(){
  const r = await fetch(LIST_URL);
  if(!r.ok) throw new Error('HTTP '+r.status);
  const { rows } = await r.json();

  return rows.map(x => {
    // TS pode vir em ms/seg/ISO → normaliza para ms
    let tsMs = null;
    if (typeof x.ts === "number") {
      tsMs = x.ts < 1e12 ? x.ts * 1000 : x.ts;
    } else if (typeof x.ts === "string" && x.ts) {
      const d = new Date(x.ts);
      if (!Number.isNaN(d.getTime())) tsMs = d.getTime();
    }
    if (!Number.isFinite(tsMs)) tsMs = Date.now();

    return {
      id: x.id,
      ts: tsMs,
      text: x.text || '',
      filename: x.filename || '',
      source: x.source || '',
      euro_validado: x.euro_validado ?? null,
      euro_user: x.euro_user ?? null,
      eurocode:  x.eurocode  ?? null,
      euro:      x.euro      ?? null,
    };
  });
}
async function persistToDB(payload) {
  const resp = await fetch(SAVE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const txt = await resp.text().catch(()=>resp.statusText);
  if (!resp.ok) throw new Error(txt || ('HTTP ' + resp.status));
  let data = {};
  try { data = JSON.parse(txt); } catch {}
  const id = data?.id ?? data?.row?.id ?? data?.insertId ?? null;
  return { id, raw: data };
}
async function deleteFromDB(id){
  const resp = await fetch(DELETE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error) throw new Error(data?.error || ('HTTP ' + resp.status));
  return true;
}
async function updateEuroValidated(id, euro){
  const resp = await fetch(UPDATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, ...euroPayload(euro) })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error || !data?.ok) throw new Error(data?.error || ('HTTP ' + resp.status));
  return data.row;
}
async function updateInDBText(id, text){
  const resp = await fetch(UPDATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok || data?.error || !data?.ok) throw new Error(data?.error || ('HTTP ' + resp.status));
  return data.row;
}

/* ===== Render Desktop ===== */
function renderTable(){
  if(!isDesktop) return;
  ensureActionsHeader();
  resultsBody.innerHTML = "";

  RESULTS.forEach((r,i)=>{
    const raw   = (r.text || "").replace(/\s*\n\s*/g, " ").trim();
    const auto  = getEuroCandidates(r.text || "")[0] || "";
    const validFromBackend = readEuroField(r) || "";
    const euro  = validFromBackend || auto;
    const validated = !!validFromBackend;

    const tr = document.createElement("tr");
    tr.dataset.id = r.id;

    const euroHtml = `
      <div class="euro-select-wrap">
        <span class="euro ${euro ? 'euro-ok' : 'euro-miss'}">${euro || '—'}</span>
        <button class="btn-icon euroEdit" title="Validar/alterar">▾</button>
      </div>
      ${validated ? '<div class="mob-note">validado</div>' : ''}
    `;

    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${new Date(r.ts).toLocaleString()}</td>
      <td><div class="ocr-text">${raw}</div></td>
      <td class="euro-cell">${euroHtml}</td>
      <td>
        <button class="btn-icon editBtn" title="Editar" data-id="${r.id}">✏️</button>
        <button class="btn-icon delBtn"  title="Apagar" data-id="${r.id}">🗑️</button>
      </td>
    `;
    resultsBody.appendChild(tr);
  });

  desktopStatus.textContent = RESULTS.length ? `${RESULTS.length} registo(s).` : "Sem registos ainda.";
}

/* abre seletor de candidatos (Desktop) e grava no backend */
async function openEuroSelectorDesktop(cell, row){
  const candidates = getEuroCandidates(row.text || "");
  if (!candidates.length){ showToast("Sem candidatos extraídos"); return; }

  const prev = cell.innerHTML;
  const wrap = document.createElement("div");
  wrap.className = "euro-select-wrap";
  wrap.innerHTML = `
    <select class="euro-select">
      ${candidates.map(c => `<option value="${c}" ${c === (readEuroField(row) || candidates[0]) ? 'selected':''}>${c}</option>`).join('')}
    </select>
    <button class="euro-choose-btn">OK</button>
    <button class="btn-icon euro-cancel" title="Cancelar">✖</button>
  `;
  cell.innerHTML = ""; cell.appendChild(wrap);

  const select = wrap.querySelector('.euro-select');
  const btnOk  = wrap.querySelector('.euro-choose-btn');
  const btnX   = wrap.querySelector('.euro-cancel');

  const cancel = ()=> cell.innerHTML = prev;
  btnX.addEventListener('click', cancel);
  btnOk.addEventListener('click', async ()=>{
    const code = select.value || "";
    try{
      await updateEuroValidated(row.id, code);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast("Eurocode validado");
    }catch(e){
      console.error(e);
      showToast("Falha ao validar");
      cancel();
    }
  });
}

/* Delegação Desktop */
resultsBody?.addEventListener("click", async (e)=>{
  const tr  = e.target.closest("tr");
  if (!tr) return;
  const id  = Number(tr.dataset.id);
  const row = RESULTS.find(x => x.id === id);

  if (e.target.closest(".euroEdit")){
    const cell = e.target.closest(".euro-cell");
    openEuroSelectorDesktop(cell, row);
    return;
  }

  const euroChip = e.target.closest(".euro");
  if (euroChip && euroChip.textContent.trim() && euroChip.textContent.trim() !== "—") {
    try { await navigator.clipboard?.writeText(euroChip.textContent.trim()); showToast("Eurocode copiado"); } catch {}
    return;
  }

  if (e.target.closest(".editBtn")){
    const currentText = row?.text || '';
    const newText = prompt('Editar texto lido (OCR):', currentText);
    if (newText === null) return;
    try{
      e.target.disabled = true; e.target.textContent = '…';
      await updateInDBText(id, newText);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast('Registo atualizado.');
    }catch(err){
      console.error(err);
      showToast('Falha ao atualizar');
    }finally{
      e.target.disabled = false; e.target.textContent = '✏️';
    }
  }

  if (e.target.closest(".delBtn")){
    if(!confirm("Apagar este registo da base de dados?")) return;
    const old = e.target.textContent;
    e.target.disabled = true; e.target.textContent = "…";
    try{
      await deleteFromDB(id);
      RESULTS = await fetchServerRows();
      renderTable();
      showToast("Registo apagado.");
    }catch(err){
      console.error(err);
      showToast("Falha ao apagar");
    }finally{
      e.target.disabled = false; e.target.textContent = old;
    }
  }
});

/* ===== Painel Mobile de validação ===== */
function openMobileEuroPanel({ text }) {
  return new Promise((resolve) => {
    const cands = getEuroCandidates(text);
    const single = cands.length === 1;

    const backdrop = document.createElement("div");
    backdrop.className = "mob-euro-backdrop";

    const pane = document.createElement("div");
    pane.className = "mob-euro";
    pane.innerHTML = `
      <h4>Valida o Eurocode</h4>
      <div class="mob-note">Escolhe o código correto antes de gravar.</div>
      <table>
        <thead><tr><th>#</th><th>Possível Eurocode</th><th>Selecionar</th></tr></thead>
        <tbody>
          ${
            (cands.length ? cands : [""]).map((c,idx)=>`
              <tr data-idx="${idx}">
                <td>${c ? idx+1 : "-"}</td>
                <td>${c || "<i>Sem candidatos detetados</i>"}</td>
                <td>${c ? `<input type="radio" name="euroPick" value="${c}" ${single?'checked':''}/>` : ""}</td>
              </tr>
            `).join("")
          }
        </tbody>
      </table>
      <div class="mob-note" style="margin-top:8px;">Se não aparecer, podes seguir sem Eurocode.</div>
      <div class="mob-euro-actions">
        <button class="mob-btn" id="mobEuroSkip">Sem Eurocode</button>
        <button class="mob-btn primary" id="mobEuroOK" ${(!single && cands.length>1)?'disabled':''}>Confirmar</button>
      </div>
    `;

    const close = (val) => { document.body.removeChild(backdrop); document.body.removeChild(pane); resolve(val); };
    backdrop.addEventListener("click", ()=> close(null));
    document.body.appendChild(backdrop);
    document.body.appendChild(pane);

    const tbody = pane.querySelector("tbody");
    const btnOK = pane.querySelector("#mobEuroOK");

    // selecionar ao tocar na linha
    tbody.addEventListener("click", (ev)=>{
      const tr = ev.target.closest("tr");
      if (!tr) return;
      const radio = tr.querySelector('input[type="radio"]');
      if (radio){
        radio.checked = true;
        [...tbody.querySelectorAll("tr")].forEach(x=>x.classList.remove("active"));
        tr.classList.add("active");
        btnOK.disabled = false;
      }
    });

    pane.querySelector("#mobEuroSkip").addEventListener("click", ()=> close(""));
    pane.querySelector("#mobEuroOK").addEventListener("click", ()=>{
      const pick = pane.querySelector('input[name="euroPick"]:checked')?.value || "";
      close(pick);
    });
  });
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

/* ===== Fluxo (Mobile valida antes de gravar + UPDATE) ===== */
async function handleImage(file, origin="camera"){
  lastFile = file;
  try{
    showProgress("A preparar imagem…", 10);
    await new Promise(r=>setTimeout(r, 120));

    showProgress("A otimizar…", 25);
    const prepped = await optimizeImageForOCR(file);

    showProgress("A enviar para o OCR…", 55);
    const fd = new FormData(); fd.append("file", prepped, prepped.name);
    const res = await fetch(OCR_ENDPOINT, { method:"POST", body: fd });

    showProgress("A ler…", 80);
    const t = await res.text().catch(()=>res.statusText);
    if(!res.ok) throw new Error(`Falha no OCR: ${res.status} ${t}`);
    const data = JSON.parse(t);
    const textRead = data?.text || (data?.qr ? `QR: ${data.qr}` : "");

    let euroChosen = "";
    if (!isDesktop) {
      euroChosen = await openMobileEuroPanel({ text: textRead }) || "";
    }

    const tsNow = Date.now();
    showProgress("A gravar no Neon…", 90);

    // 1) grava a captura
    const { id: savedId } = await persistToDB({
      ts: tsNow,
      text: textRead,
      filename: file.name || (origin==="camera" ? "captura.jpg" : "imagem"),
      source: origin,
      ...euroPayload(euroChosen)
    });

    // 2) garante que a escolha fica persistida (se backend ignorar no save)
    if (euroChosen && savedId) {
      try { await updateEuroValidated(savedId, euroChosen); }
      catch(e){ console.warn("UPDATE euro falhou:", e?.message); }
    }

    RESULTS = await fetchServerRows();
    renderTable();

    setStatus("Concluído ✅");
    setTimeout(()=> setStatus(""), 400);
    showToast(!isDesktop ? (euroChosen ? "Eurocode validado" : "Gravado (sem Eurocode)") : "OCR concluído");
  }catch(err){
    console.error(err);
    showError(err.message || "Erro inesperado");
    showToast("Falha no OCR");
  }
}

/* ===== Bind seguro da câmara ===== */
function bindCameraOnce(){
  if (!cameraBtn || !cameraInput) return;

  const clone = cameraBtn.cloneNode(true);
  cameraBtn.parentNode.replaceChild(clone, cameraBtn);
  cameraBtn = document.getElementById("btnCamera");

  let camBusy = false;

  cameraBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (camBusy) return;
    camBusy = true;
    cameraBtn.blur();
    cameraInput.click();
  });

  cameraInput.addEventListener("change", async (e) => {
    try{
      const file = e.target.files?.[0];
      if (!file) { camBusy = false; return; }
      await handleImage(file, "camera");
    } finally {
      cameraInput.value = "";
      setTimeout(()=>{ camBusy = false; }, 350);
    }
  });
}

/* ===== Bootstrap ===== */
(async function(){
  try { RESULTS = await fetchServerRows(); }
  catch(e){ console.warn("List falhou:", e.message); RESULTS = []; }
  renderTable();
  bindCameraOnce();
})();

/* ===== Upload Desktop ===== */
uploadBtn?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) handleImage(file, "upload");
  fileInput.value = "";
});

/* ===== Export / Limpar ===== */
exportBtn?.addEventListener("click", async () => {
  if(!RESULTS.length) return showToast("Nada para exportar");
  const lines = [];
  lines.push(["idx","timestamp","eurocode_auto","eurocode_validado","text"].join(","));
  RESULTS.forEach((r,i)=>{
    const auto  = getEuroCandidates(r.text||"")[0] || "";
    const valid = readEuroField(r) || "";
    const raw   = (r.text||"").replace(/\s*\n\s*/g," ").trim().replace(/"/g,'""');
    lines.push([ i+1, new Date(r.ts).toISOString(), auto, valid, `"${raw}"` ].join(","));
  });
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

/* ===== Modal Ajuda ===== */
const helpModal = document.getElementById("helpModal");
const helpBtn = document.getElementById("helpBtn");
const helpBtnDesktop = document.getElementById("helpBtnDesktop");
const helpClose = document.getElementById("helpClose");
function showHelpModal() { helpModal?.classList.add("show"); }
function hideHelpModal() { helpModal?.classList.remove("show"); }
helpBtn?.addEventListener("click", showHelpModal);
helpBtnDesktop?.addEventListener("click", showHelpModal);
helpClose?.addEventListener("click", hideHelpModal);
helpModal?.addEventListener("click", (e) => { if (e.target === helpModal) hideHelpModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && helpModal?.classList.contains("show")) hideHelpModal();
});