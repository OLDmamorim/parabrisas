/* =========================
   CONFIG / ENDPOINTS
   ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";   // editar no Neon se precisares
const DEMO_MODE    = false;

/* =========================
   ELEMENTS (com fallbacks)
   ========================= */
const el = {
  // botões modo
  btnOCR:      document.querySelector('#btn-ocr, [data-action="ocr"]'),
  btnEURO:     document.querySelector('#btn-eurocode, [data-action="eurocode"]'),

  // input câmara/ficheiro
  fileInput:   document.querySelector('#file-input, input[type="file"][capture]') || createHiddenFile(),

  // UI resultados/erros
  resultBox:   document.querySelector('#result, .result-box, .alert-area'),
  errorBox:    document.querySelector('#error, .error-box'),
  retryBtn:    document.querySelector('#retry-btn, [data-action="retry"]'),

  // lista histórico
  capturesList:document.querySelector('#captures, #capturas, .captures-list'),

  // spinner/estado
  spinner:     document.querySelector('#spinner, .spinner')
};

function createHiddenFile(){
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = 'image/*';
  i.capture = 'environment';
  i.style.display = 'none';
  document.body.appendChild(i);
  return i;
}

/* =========================
   STATE
   ========================= */
let CURRENT_MODE = 'EUROCODE'; // 'OCR' | 'EUROCODE'
let lastOcrText  = '';

/* =========================
   HELPERS UI
   ========================= */
function setMode(mode){
  CURRENT_MODE = mode;
  toggleActive(el.btnOCR, mode === 'OCR');
  toggleActive(el.btnEURO, mode === 'EUROCODE');
  clearResult();
}

function toggleActive(btn, on){
  if (!btn) return;
  btn.classList.toggle('active', !!on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function showSpinner(on=true){
  if (!el.spinner) return;
  el.spinner.style.display = on ? 'block' : 'none';
}

function showError(msg){
  if (el.resultBox) el.resultBox.innerHTML = '';
  if (!el.errorBox){
    console.error(msg);
    return;
  }
  el.errorBox.style.display = 'block';
  el.errorBox.innerHTML = `
    <div class="alert alert-error">
      <strong>❌</strong> ${msg}
    </div>`;
  if (el.retryBtn) el.retryBtn.style.display = 'inline-flex';
}

function showSuccess(title, value, helper=''){
  if (el.errorBox) el.errorBox.style.display = 'none';
  if (el.retryBtn) el.retryBtn.style.display = 'none';
  if (!el.resultBox) return;
  el.resultBox.innerHTML = `
    <div class="card ok">
      <div class="card-title">${title}</div>
      <div class="card-value">${value}</div>
      ${helper ? `<div class="card-helper">${helper}</div>` : ''}
    </div>`;
}

function clearResult(){
  if (el.errorBox) { el.errorBox.style.display = 'none'; el.errorBox.innerHTML=''; }
  if (el.resultBox) el.resultBox.innerHTML = '';
  if (el.retryBtn)  el.retryBtn.style.display = 'none';
}

/* =========================
   EUROCODE - EXTRAÇÃO ROBUSTA
   ========================= */
// Regra final válida: 4 dígitos + 2–7 A-Z/0-9 (sem espaços/hífens)
function normalizeDigitLike(c) {
  const map = { 'O':'0', 'Q':'0', 'D':'0', 'I':'1', 'L':'1', 'B':'8', 'S':'5', 'Z':'2' };
  return map[c] || c;
}
function sanitizeForScan(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/\u00A0/g, ' ');
}
function extractEurocodeCandidates(rawText) {
  const txt = sanitizeForScan(rawText);
  const tokens = txt.split(/[^A-Z0-9]+/).filter(Boolean);
  const out = new Set();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Caso direto
    let m = t.match(/^(\d{4})([A-Z0-9]{2,7})$/);
    if (m) { out.add(m[1] + m[2]); continue; }

    // Token com 4 dígitos e sufixo quebrado
    m = t.match(/^(\d{4})([A-Z0-9]{0,7})$/);
    if (m) {
      let prefix = m[1], suffix = m[2] || '';
      let j = i + 1;
      while (suffix.length < 7 && j < tokens.length && /^[A-Z0-9]+$/.test(tokens[j])) {
        const need = 7 - suffix.length;
        suffix += tokens[j].slice(0, need);
        j++;
      }
      if (suffix.length >= 2 && suffix.length <= 7) out.add(prefix + suffix);
    }

    // Dígitos partidos em vários tokens
    if (/^\d+$/.test(t)) {
      let num = t, k = i + 1;
      while (num.length < 4 && k < tokens.length && /^\d+$/.test(tokens[k])) { num += tokens[k]; k++; }
      if (num.length === 4) {
        let suf = '';
        while (suf.length < 2 && k < tokens.length && /^[A-Z0-9]+$/.test(tokens[k])) {
          suf += tokens[k]; k++;
        }
        if (suf.length >= 2) {
          suf = suf.slice(0, 7);
          out.add(num + suf);
        }
      }
    }
  }

  // Corrige confusões nos 4 primeiros (devem ser dígitos)
  const fixed = [];
  for (const cand of out) {
    let head = cand.slice(0,4).replace(/[A-Z]/g, normalizeDigitLike);
    let tail = cand.slice(4);
    const fixedCand = head + tail;
    if (/^\d{4}[A-Z0-9]{2,7}$/.test(fixedCand)) fixed.push(fixedCand);
  }
  return [...new Set(fixed)];
}
function getBestEurocode(rawText) {
  const list = extractEurocodeCandidates(rawText);
  if (list.length === 0) return null;
  return list.sort((a, b) => {
    const len = b.length - a.length;
    if (len !== 0) return len;
    const letters = s => (s.slice(4).match(/[A-Z]/g) || []).length;
    return letters(b) - letters(a);
  })[0];
}

/* =========================
   OCR
   ========================= */
async function doOCR(fileOrBlob){
  if (DEMO_MODE) {
    await wait(600);
    return "3999 AGN V\nPBL HONDA CIVIC HYBRID 4P SD 06> VRD JNL\nPB1-U44";
  }
  const fd = new FormData();
  fd.append('file', fileOrBlob, 'photo.jpg');
  const res = await fetch(OCR_ENDPOINT, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`OCR falhou (${res.status})`);
  const data = await res.json();
  // espera-se { text: "..." } do teu proxy
  return (data && (data.text || data.fullText || data.ocr)) || '';
}

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

/* =========================
   SAVE / LIST
   ========================= */
async function saveCapture(payload){
  if (DEMO_MODE) return { ok:true, id:Date.now() };
  const res = await fetch(SAVE_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Falha ao guardar.');
  return await res.json();
}

async function listCaptures(){
  if (DEMO_MODE) {
    return [{id:1, eurocode:'3999AGNV', created_at:new Date().toISOString(), desc:'DEMO'}];
  }
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error('Falha ao carregar capturas.');
  return await res.json();
}

async function refreshList(){
  if (!el.capturesList) return;
  try{
    const rows = await listCaptures();
    if (!rows || rows.length === 0){
      el.capturesList.innerHTML = `<div class="muted">Ainda não há capturas realizadas.</div>`;
      return;
    }
    el.capturesList.innerHTML = rows.map(r => {
      const date = new Date(r.created_at || Date.now()).toLocaleString();
      return `
        <div class="cap-row">
          <div><strong>${r.eurocode || r.code || '—'}</strong></div>
          <div class="cap-meta">${r.desc || ''}</div>
          <div class="cap-date">${date}</div>
        </div>`;
    }).join('');
  }catch(e){
    console.error(e);
  }
}

/* =========================
   FLUXO PRINCIPAL
   ========================= */
async function handleCapture(file){
  clearResult();
  showSpinner(true);
  try{
    const ocrText = await doOCR(file);
    lastOcrText = ocrText || '';

    if (CURRENT_MODE === 'EUROCODE') {
      const euro = getBestEurocode(ocrText);
      if (euro) {
        showSuccess('EUROCODE encontrado', euro, 'Já normalizado sem espaços/hífens.');
        await saveCapture({ type:'EUROCODE', eurocode:euro, raw: ocrText });
        refreshList();
      } else {
        showError('Não encontrei um EUROCODE válido (4 dígitos + 2–7 A/Z/0–9, pode ter espaço/hífen).');
      }
    } else {
      // Modo OCR “genérico” – mostra texto e tenta eurocode opcionalmente
      const maybe = getBestEurocode(ocrText);
      const helper = maybe ? `Sugestão de EUROCODE: <code>${maybe}</code>` : '';
      showSuccess('Texto OCR', `<pre class="ocr">${escapeHtml(ocrText)}</pre>`, helper);
      await saveCapture({ type:'OCR', eurocode: maybe || null, raw: ocrText });
      refreshList();
    }
  }catch(err){
    console.error(err);
    showError('Falha no OCR. Tenta novamente.');
  }finally{
    showSpinner(false);
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* =========================
   EVENTOS
   ========================= */
if (el.btnOCR)  el.btnOCR.addEventListener('click',  () => setMode('OCR'));
if (el.btnEURO) el.btnEURO.addEventListener('click', () => setMode('EUROCODE'));

document.addEventListener('click', (ev)=>{
  const isShoot = ev.target.matches('#shoot, [data-action="shoot"], .card[data-action="shoot"]');
  if (isShoot) {
    el.fileInput.click();
  }
});

if (el.fileInput) {
  el.fileInput.addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await handleCapture(file);
    // limpa para poder tirar outra foto igual
    e.target.value = '';
  });
}

if (el.retryBtn) {
  el.retryBtn.addEventListener('click', ()=>{
    clearResult();
    el.fileInput.click();
  });
}

/* =========================
   INIT
   ========================= */
(function init(){
  // por defeito, o botão destacado na tua UI era EUROCODE
  setMode('EUROCODE');
  refreshList();
})();