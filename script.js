/* =========================
   CONFIG / ENDPOINTS
   ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;

/* =========================
   ELEMENTS (com fallbacks)
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
   EUROCODE - EXTRAÇÃO v6
   Estratégia:
   1) STRICT: procurar contíguo sem hífen e com sufixo a começar por 2 letras.
   2) FALLBACK: mesma linha, sem hífen, exige sufixo começar por 2 letras.
   - HARD STOP: depois de válido, só aceita tokens de 1 letra (A–Z).
   - Corrige apenas os 4 dígitos iniciais (O/Q/D→0; I/L→1; B→8; S→5; Z→2).
   ========================= */
function normalizeDigitLike(c){ const map={ 'O':'0','Q':'0','D':'0','I':'1','L':'1','B':'8','S':'5','Z':'2' }; return map[c]||c; }
function sanitizeForScan(raw){ return String(raw||'').toUpperCase().replace(/\u00A0/g,' '); }

// STRICT — contíguo, sem hífen, sufixo começa por 2 letras
const STRICT_RE = /\b\d{4}[A-Z]{2}[A-Z0-9]{0,5}\b/g;

function findStrictEurocodes(txt){
  const out = []; let m;
  while ((m = STRICT_RE.exec(txt)) !== null) out.push(m[0]);
  return out;
}
function scoreStrict(code, txt){
  const freq = (txt.match(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g')) || []).length;
  const tail = code.slice(4);
  const letters = (tail.match(/[A-Z]/g)||[]).length;
  const digits  = (tail.match(/\d/g)||[]).length;
  // forte penalização de dígitos; premiar frequência e letras
  return 200*freq + 20*letters - 30*digits;
}

// split preservando separadores (para ver hífens)
function splitWithSeps(txt){
  const parts = []; const re = /[A-Z0-9]+|[^A-Z0-9]+/g; let m;
  while ((m = re.exec(txt)) !== null) parts.push(m[0]);
  const out = [];
  for (let i=0;i<parts.length;i++){
    if (/^[A-Z0-9]+$/.test(parts[i])) {
      const tok = parts[i];
      const sepAfter = (i+1<parts.length && !/^[A-Z0-9]+$/.test(parts[i+1])) ? parts[i+1] : '';
      out.push({ tok, sepAfter });
    }
  }
  return out;
}
function extractEurocodeFallback(rawText){
  const lines = sanitizeForScan(rawText).split(/\r?\n/);
  const found = new Set();

  for (const line of lines){
    const seq = splitWithSeps(line);
    for (let i=0;i<seq.length;i++){
      const cur = seq[i];

      // token com 4 dígitos e sufixo colado (pode estar incompleto)
      let m = cur.tok.match(/^(\d{4})([A-Z0-9]{0,7})$/);
      if (!m) continue;

      const prefix = m[1];
      let suffix = m[2] || '';
      let j = i;

      // construir sufixo respeitando hífens e regra das 2 primeiras letras
      while (suffix.length < 7) {
        if (seq[j].sepAfter && seq[j].sepAfter.includes('-')) break; // não atravessa hífen
        const nxt = seq[j+1]; if (!nxt) break;
        if (seq[j].sepAfter && seq[j].sepAfter.includes('-')) break;

        const tk = nxt.tok; if (!/^[A-Z0-9]+$/.test(tk)) break;

        if (suffix.length < 2){
          // precisamos garantir 2 letras no início do sufixo
          const need = 2 - suffix.length;
          const lettersOnly = tk.replace(/[^A-Z]/g,'');
          if (lettersOnly.length === 0) break; // próximo token não ajuda a cumprir 2 letras
          const take = Math.min(need, lettersOnly.length);
          suffix += lettersOnly.slice(0, take);

          // se ainda sobrar espaço (já com 2 letras), podemos aproveitar o resto do token,
          // mas só até 7 e sem puxar dígitos à frente das letras iniciais
          if (suffix.length >= 2) {
            const rest = (tk.slice(0, 7 - (suffix.length))).replace(/[^A-Z0-9]/g,'');
            suffix += rest.slice(0, Math.max(0, 7 - suffix.length));
          }
        } else {
          // já válido: apenas tokens de 1 letra
          if (tk.length === 1 && /^[A-Z]$/.test(tk)) suffix += tk;
          else break; // HARD STOP
        }
        j++;
      }

      if (suffix.length >= 2) {
        const head = prefix.replace(/[A-Z]/g, normalizeDigitLike);
        const code = head + suffix.slice(0,7);
        if (/^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(code)) found.add(code);
      }
    }
  }
  return Array.from(found);
}

function getBestEurocode(rawText){
  const txt = sanitizeForScan(rawText);

  // 1) STRICT primeiro
  const strict = findStrictEurocodes(txt).map(c=>{
    const head = c.slice(0,4).replace(/[A-Z]/g, normalizeDigitLike); // só os 4 dígitos
    const fixed = head + c.slice(4); // NUNCA mexer no sufixo
    return /^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(fixed) ? fixed : null;
  }).filter(Boolean);

  if (strict.length){
    strict.sort((a,b)=>scoreStrict(b,txt)-scoreStrict(a,txt));
    return strict[0];
  }

  // 2) FALLBACK (mesma linha, sem hífen, sufixo começa por 2 letras)
  const fb = extractEurocodeFallback(txt);
  if (fb.length){
    const score = s=>{
      const t = s.slice(4);
      const len = t.length;
      const letters = (t.match(/[A-Z]/g)||[]).length;
      const digits  = (t.match(/\d/g)||[]).length;
      return (len===4||len===5?50:0) + 5*letters - 10*digits;
    };
    fb.sort((a,b)=>score(b)-score(a));
    return fb[0];
  }

  return null;
}

/* =========================
   OCR
   ========================= */
async function doOCR(fileOrBlob){
  if (DEMO_MODE){
    await wait(300);
    return "7289BGNM 2000000 OCL DACIA LODGY 3/5P MVM 1";
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
  if (DEMO_MODE) return [{id:1, eurocode:'7289BGNM', created_at:new Date().toISOString(), desc:'DEMO'}];
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
        showSuccess('EUROCODE encontrado', euro, 'STRICT (2 letras no início) → Fallback.');
        await saveCapture({ type:'EUROCODE', eurocode:euro, raw: ocrText });
        refreshList();
      } else {
        showError('Não encontrei um EUROCODE válido (4 dígitos + 2–7, começando por 2 letras, sem hífen).');
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