/* =========================
   CONFIG / ENDPOINTS
   ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;
const DIAG         = false;

/* =========================
   ELEMENTS
   ========================= */
const el = {
  btnOCR:      document.querySelector('#btn-ocr, [data-action="ocr"]'),
  btnEURO:     document.querySelector('#btn-eurocode, [data-action="eurocode"]'),
  fileInput:   document.querySelector('#file-input, input[type="file"][capture]') || createHiddenFile(),
  resultBox:   document.querySelector('#result, .result-box, .alert-area'),
  errorBox:    document.querySelector('#error, .error-box'),
  retryBtn:    document.querySelector('#retry-btn, [data-action="retry"]'),
  capturesList:document.querySelector('#captures, #capturas, .captures-list'),
  spinner:     document.querySelector('#spinner, .spinner')
};
function createHiddenFile(){
  const i = document.createElement('input');
  i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment'; i.style.display = 'none';
  document.body.appendChild(i); return i;
}

/* =========================
   STATE / UI HELPERS
   ========================= */
let CURRENT_MODE = 'EUROCODE';
let lastOcrText  = '';

function setMode(mode){ CURRENT_MODE = mode; toggleActive(el.btnOCR, mode==='OCR'); toggleActive(el.btnEURO, mode==='EUROCODE'); clearResult(); }
function toggleActive(btn,on){ if(!btn) return; btn.classList.toggle('active',!!on); btn.setAttribute('aria-pressed', on?'true':'false'); }
function showSpinner(on=true){ if(el.spinner) el.spinner.style.display = on?'block':'none'; }
function showError(msg){ if(el.resultBox) el.resultBox.innerHTML=''; if(!el.errorBox){ console.error(msg); return; }
  el.errorBox.style.display='block'; el.errorBox.innerHTML=`<div class="alert alert-error"><strong>❌</strong> ${msg}</div>`; if(el.retryBtn) el.retryBtn.style.display='inline-flex'; }
function showSuccess(title,value,helper=''){ if(el.errorBox) el.errorBox.style.display='none'; if(el.retryBtn) el.retryBtn.style.display='none'; if(!el.resultBox) return;
  el.resultBox.innerHTML=`<div class="card ok"><div class="card-title">${title}</div><div class="card-value">${value}</div>${helper?`<div class="card-helper">${helper}</div>`:''}</div>`; }
function clearResult(){ if(el.errorBox){ el.errorBox.style.display='none'; el.errorBox.innerHTML=''; } if(el.resultBox) el.resultBox.innerHTML=''; if(el.retryBtn) el.retryBtn.style.display='none'; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

/* =========================
   EUROCODE EXTRAÇÃO v11
   ========================= */
function sanitize(raw){ return String(raw||'').toUpperCase().replace(/\u00A0/g,' '); }

function normalizeHeadDigits(head){
  return head
    .replace(/[OQ]/g,'0')
    .replace(/[IL]/g,'1')
    .replace(/B/g,'8');
}

// check final sufixo: não pode ser só dígitos
function isValidSuffix(suffix){
  if (!suffix) return true;
  return /[A-Z]/.test(suffix); // precisa ter pelo menos uma letra
}

function validEuro(code){
  if (!/^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(code)) return false;
  const suffix = code.slice(6); // depois dos 4 dígitos + 2 letras
  return isValidSuffix(suffix);
}

const STRICT_RE = /(?<![A-Z0-9])(\d{4})([A-Z]{2}[A-Z0-9]{0,5})(?![A-Z0-9])/g;
function findStrict(text){
  const hits = [];
  for (const line of text.split(/\r?\n/)){
    let m;
    while((m=STRICT_RE.exec(line))!==null){
      const head = normalizeHeadDigits(m[1]);
      const code = head + m[2];
      if (validEuro(code)) hits.push({code, idx:m.index});
    }
  }
  return hits;
}

function splitTokens(text){
  return text.split(/[^A-Z0-9]+/).filter(Boolean);
}
function fallback(text){
  const toks = splitTokens(text);
  for (let i=0;i<toks.length;i++){
    const t = toks[i];
    if (/^\d{4}$/.test(t)){ 
      const head = normalizeHeadDigits(t);
      const next = toks[i+1]||'';
      if (/^[A-Z]{2,}/.test(next)){
        let suffix = next.slice(0,7);
        let code = head+suffix;
        if (validEuro(code)) return code;
      }
    }
    if (/^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(t) && validEuro(t)){
      return t; 
    }
  }
  return null;
}

function getBestEurocode(raw){
  const txt = sanitize(raw);
  const strict = findStrict(txt);
  if (strict.length){
    strict.sort((a,b)=>a.idx-b.idx);
    return strict[0].code;
  }
  return fallback(txt);
}

/* =========================
   OCR
   ========================= */
async function doOCR(file){
  if (DEMO_MODE){
    await wait(300);
    return "5350\nAGS\nMERCEDES SMART";
  }
  const fd = new FormData(); fd.append('file', file, 'photo.jpg');
  const res = await fetch(OCR_ENDPOINT,{method:'POST',body:fd});
  if (!res.ok) throw new Error(`OCR falhou (${res.status})`);
  const data = await res.json();
  return data?.text || data?.fullText || data?.ocr || '';
}

/* =========================
   SAVE / LIST
   ========================= */
async function saveCapture(payload){
  if (DEMO_MODE) return {ok:true,id:Date.now()};
  const res = await fetch(SAVE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if (!res.ok) throw new Error('Falha ao guardar.');
  return await res.json();
}
async function listCaptures(){
  if (DEMO_MODE) return [{id:1,eurocode:'5350AGS',created_at:new Date().toISOString(),desc:'DEMO'}];
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error('Falha ao carregar capturas.');
  return await res.json();
}
async function refreshList(){
  if (!el.capturesList) return;
  try{
    const rows = await listCaptures();
    if (!rows || !rows.length){ el.capturesList.innerHTML='<div class="muted">Ainda não há capturas realizadas.</div>'; return; }
    el.capturesList.innerHTML = rows.map(r=>{
      const date = new Date(r.created_at||Date.now()).toLocaleString();
      return `<div class="cap-row"><div><strong>${r.eurocode||'—'}</strong></div><div class="cap-meta">${r.desc||''}</div><div class="cap-date">${date}</div></div>`;
    }).join('');
  }catch(e){ console.error(e); }
}

/* =========================
   MAIN FLOW
   ========================= */
async function handleCapture(file){
  clearResult(); showSpinner(true);
  try{
    const ocrText = await doOCR(file); lastOcrText=ocrText||'';
    if (CURRENT_MODE==='EUROCODE'){
      const euro = getBestEurocode(ocrText);
      if (euro){
        showSuccess('EUROCODE encontrado', euro, 'Formato: 4 dígitos + 2 letras + até 5 chars (pelo menos 1 letra)');
        await saveCapture({type:'EUROCODE', eurocode:euro, raw:ocrText});
        refreshList();
      } else showError('Não encontrei um EUROCODE válido.');
    } else {
      const maybe = getBestEurocode(ocrText);
      const helper = maybe?`Sugestão: <code>${maybe}</code>`:'';
      showSuccess('Texto OCR', `<pre>${escapeHtml(ocrText)}</pre>`, helper);
      await saveCapture({type:'OCR', eurocode:maybe||null, raw:ocrText});
      refreshList();
    }
  }catch(e){ console.error(e); showError('Falha no OCR.'); }
  finally{ showSpinner(false); }
}

/* =========================
   EVENTOS / INIT
   ========================= */
if (el.btnOCR) el.btnOCR.addEventListener('click',()=>setMode('OCR'));
if (el.btnEURO) el.btnEURO.addEventListener('click',()=>setMode('EUROCODE'));
document.addEventListener('click',ev=>{ if (ev.target.matches('#shoot,[data-action="shoot"]')) el.fileInput.click(); });
if (el.fileInput){ el.fileInput.addEventListener('change',async e=>{const f=e.target.files[0]; if(f) await handleCapture(f); e.target.value='';}); }
if (el.retryBtn) el.retryBtn.addEventListener('click',()=>{clearResult(); el.fileInput.click();});
(function init(){ setMode('EUROCODE'); refreshList(); })();