/* =========================
   CONFIG / ENDPOINTS
   ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;
const DIAG         = false; // mete true p/ ver no console candidatos e escolhas

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
   EUROCODE EXTRAÇÃO v8
   ========================= */
function sanitize(raw){ return String(raw||'').toUpperCase().replace(/\u00A0/g,' '); }
function normalizeHeadDigits(head){ return head.replace(/[A-Z]/g, c => ({O:'0',Q:'0',D:'0',I:'1',L:'1',B:'8',S:'5',Z:'2'}[c]||c)); }

// Regra oficial: 4 dígitos + 2 letras + até 5 letras/dígitos
const STRICT_RE = /(?<![A-Z0-9])(\d{4})([A-Z]{2}[A-Z0-9]{0,5})(?![A-Z0-9])/g;
function validEuro(code){ return /^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(code); }

// Procurar por linha (STRICT)
function findStrictPerLine(text){
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (const line of lines){
    let m;
    while ((m = STRICT_RE.exec(line)) !== null){
      const head = normalizeHeadDigits(m[1]);
      const code = head + m[2];
      if (validEuro(code)) hits.push({ code, line, index: m.index });
    }
  }
  return hits;
}
function scoreStrict(h){
  const tail = h.code.slice(4);
  const letters = (tail.match(/[A-Z]/g)||[]).length;
  const digits  = (tail.match(/\d/g)||[]).length;
  const len     = tail.length;
  return -1000*h.index + 50*(len===4||len===5) + 10*letters - 20*digits;
}

// Fallback restrito: mesma linha, sem hífen
function splitWithSeps(line){
  const parts=[]; const re=/[A-Z0-9]+|[^A-Z0-9]+/g; let m;
  while((m=re.exec(line))!==null) parts.push(m[0]);
  return parts.map((tok,i)=>({ tok, sepAfter: parts[i+1] && !/^[A-Z0-9]+$/.test(parts[i+1]) ? parts[i+1] : '' }));
}
function fallbackPerLine(text){
  const lines = text.split(/\r?\n/);
  for (const line of lines){
    const seq = splitWithSeps(line);
    for (let i=0;i<seq.length;i++){
      const cur = seq[i];
      if (!/^\d{4}/.test(cur.tok)) continue;
      const head = normalizeHeadDigits(cur.tok.slice(0,4));
      if (!/^\d{4}$/.test(head)) continue;
      let suffix = cur.tok.slice(4).replace(/[^A-Z0-9]/g,'');
      if (suffix.length < 2) continue; // precisa logo de 2 letras
      const code = head + suffix.slice(0,7);
      if (validEuro(code)) return code;
    }
  }
  return null;
}

function getBestEurocode(rawText){
  const txt = sanitize(rawText);

  // STRICT primeiro
  const strict = findStrictPerLine(txt);
  if (strict.length){
    strict.sort((a,b)=>scoreStrict(b)-scoreStrict(a));
    if (DIAG) console.log('[STRICT]', strict);
    return strict[0].code;
  }

  // FALLBACK
  const fb = fallbackPerLine(txt);
  if (DIAG) console.log('[FALLBACK]', fb);
  return fb || null;
}

/* =========================
   OCR
   ========================= */
async function doOCR(fileOrBlob){
  if (DEMO_MODE){
    await wait(300);
    return "5350AGS MERCEDES SMART\n3999AGNV HONDA\n7289BGNM DACIA";
  }
  const fd = new FormData(); fd.append('file', fileOrBlob, 'photo.jpg');
  const res = await fetch(OCR_ENDPOINT, { method:'POST', body: fd });
  if (!res.ok) throw new Error(`OCR falhou (${res.status})`);
  const data = await res.json();
  return (data && (data.text || data.fullText || data.ocr)) || '';
}

/* =========================
   SAVE / LIST
   ========================= */
async function saveCapture(payload){
  if (DEMO_MODE) return { ok:true, id:Date.now() };
  const res = await fetch(SAVE_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Falha ao guardar.');
  return await res.json();
}
async function listCaptures(){
  if (DEMO_MODE) return [{id:1, eurocode:'5350AGS', created_at:new Date().toISOString(), desc:'DEMO'}];
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error('Falha ao carregar capturas.');
  return await res.json();
}
async function refreshList(){
  if (!el.capturesList) return;
  try{
    const rows = await listCaptures();
    if (!rows || rows.length===0){ el.capturesList.innerHTML=`<div class="muted">Ainda não há capturas realizadas.</div>`; return; }
    el.capturesList.innerHTML = rows.map(r=>{
      const date = new Date(r.created_at||Date.now()).toLocaleString();
      return `<div class="cap-row"><div><strong>${r.eurocode||r.code||'—'}</strong></div><div class="cap-meta">${r.desc||''}</div><div class="cap-date">${date}</div></div>`;
    }).join('');
  }catch(e){ console.error(e); }
}

/* =========================
   FLUXO PRINCIPAL
   ========================= */
async function handleCapture(file){
  clearResult(); showSpinner(true);
  try{
    const ocrText = await doOCR(file); lastOcrText = ocrText||'';
    if (CURRENT_MODE === 'EUROCODE'){
      const euro = getBestEurocode(ocrText);
      if (euro){
        showSuccess('EUROCODE encontrado', euro, 'Formato: 4 dígitos + 2 letras + até 5 chars.');
        await saveCapture({ type:'EUROCODE', eurocode:euro, raw: ocrText });
        refreshList();
      } else {
        showError('Não encontrei um EUROCODE válido (4 dígitos + 2 letras + até 5 chars).');
      }
    } else {
      const maybe = getBestEurocode(ocrText);
      const helper = maybe ? `Sugestão de EUROCODE: <code>${maybe}</code>` : '';
      showSuccess('Texto OCR', `<pre class="ocr">${escapeHtml(ocrText)}</pre>`, helper);
      await saveCapture({ type:'OCR', eurocode: maybe || null, raw: ocrText });
      refreshList();
    }
  }catch(err){ console.error(err); showError('Falha no OCR. Tenta novamente.'); }
  finally{ showSpinner(false); }
}

/* =========================
   EVENTOS / INIT
   ========================= */
if (el.btnOCR)  el.btnOCR.addEventListener('click', ()=>setMode('OCR'));
if (el.btnEURO) el.btnEURO.addEventListener('click',()=>setMode('EUROCODE'));

document.addEventListener('click', (ev)=>{
  const isShoot = ev.target.matches('#shoot,[data-action="shoot"],.card[data-action="shoot"]');
  if (isShoot) el.fileInput.click();
});
if (el.fileInput){
  el.fileInput.addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0]; if (!file) return;
    await handleCapture(file); e.target.value='';
  });
}
if (el.retryBtn){ el.retryBtn.addEventListener('click', ()=>{ clearResult(); el.fileInput.click(); }); }

(function init(){ setMode('EUROCODE'); refreshList(); })();