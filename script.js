/* =========================
   CONFIG / ENDPOINTS
   ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy";
const LIST_URL     = "/api/list-ocr";
const SAVE_URL     = "/api/save-ocr";
const DELETE_URL   = "/api/delete-ocr";
const UPDATE_URL   = "/api/update-ocr";
const DEMO_MODE    = false;
const DIAG         = false; // põe true p/ ver diagnósticos no console

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
   EUROCODE - EXTRAÇÃO v7
   ========================= */
// Regra final válida: 4 dígitos + 2–7, SEM hífen, e sufixo a começar por 2 letras
function sanitize(raw){ return String(raw||'').toUpperCase().replace(/\u00A0/g,' '); }
function normalizeHeadDigits(head){ return head.replace(/[A-Z]/g, c => ({O:'0',Q:'0',D:'0',I:'1',L:'1',B:'8',S:'5',Z:'2'}[c]||c)); }

// STRICT por linha: contíguo, sem hífen, sufixo começa por 2 letras
const STRICT_RE = /(?<![A-Z0-9])(\d{4})([A-Z]{2}[A-Z0-9]{0,5})(?![A-Z0-9])/g;

function findStrictPerLine(text){
  const lines = text.split(/\r?\n/);
  const hits = [];
  let offset = 0;
  for (const line of lines){
    let m;
    while ((m = STRICT_RE.exec(line)) !== null){
      const head = normalizeHeadDigits(m[1]);
      const code = head + m[2]; // NUNCA mexer no sufixo
      if (/^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(code)){
        hits.push({
          code,
          line,
          indexInLine: m.index,
          lineOffset: offset
        });
      }
    }
    offset += line.length + 1;
  }
  return hits;
}

function scoreStrictHit(h){
  const tail = h.code.slice(4);
  const letters = (tail.match(/[A-Z]/g)||[]).length;
  const digits  = (tail.match(/\d/g)||[]).length;
  const len     = tail.length;
  // LEFT-MOST manda: posição pequena = melhor (peso muito alto)
  return -100000*h.indexInLine + 50*(len===4||len===5) + 10*letters - 20*digits;
}

// Fallback ultra-restrito (mesma linha, sem hífen, 2 letras no início, hard stop)
function splitWithSeps(line){
  const parts = []; const re = /[A-Z0-9]+|[^A-Z0-9]+/g; let m;
  while ((m = re.exec(line)) !== null) parts.push(m[0]);
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

function fallbackPerLine(text){
  const lines = text.split(/\r?\n/);
  const hits  = [];

  lines.forEach((line, lineNo)=>{
    const seq = splitWithSeps(line);
    for (let i=0;i<seq.length;i++){
      const cur = seq[i];
      // precisa começar por 4 dígitos num token
      if (!/^\d{4}/.test(cur.tok)) continue;

      // extrair os 4 primeiros do token
      const head = normalizeHeadDigits(cur.tok.slice(0,4));
      if (!/^\d{4}$/.test(head)) continue;

      let suffix = cur.tok.slice(4).replace(/[^A-Z0-9]/g,''); // resto do mesmo token
      let j = i;

      // construir sufixo (exigir 2 letras no início)
      while (suffix.length < 7){
        const sep = seq[j].sepAfter || '';
        if (sep.includes('-')) break; // NÃO atravessa hífen

        const nxt = seq[j+1]; if (!nxt) break;
        const tk  = nxt.tok;

        if (suffix.length < 2){
          // precisamos garantir duas letras no início
          const letters = tk.replace(/[^A-Z]/g,'');
          if (!letters.length) break;
          const need = Math.min(2 - suffix.length, letters.length);
          suffix += letters.slice(0, need);

          // depois das 2 letras, podemos aproveitar o resto do token (até 7)
          if (suffix.length >= 2){
            const rest = tk.slice(0, 7 - suffix.length).replace(/[^A-Z0-9]/g,'');
            suffix += rest.slice(0, 7 - suffix.length);
          }
        } else {
          // já válido: só aceitar letras isoladas (HARD STOP para tokens >1)
          if (tk.length === 1 && /^[A-Z]$/.test(tk)) suffix += tk;
          else break;
        }
        j++;
      }

      if (suffix.length >= 2){
        const code = head + suffix.slice(0,7);
        if (/^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/.test(code)){
          // posição daquele head na linha (aprox.)
          const idx = line.indexOf(seq[i].tok);
          hits.push({ code, line, indexInLine: idx<0?99999:idx });
        }
      }
    }
  });

  // escolher o mais à esquerda; depois letras>digitos; len 4–5 preferido
  hits.sort((a,b)=>{
    if (a.indexInLine !== b.indexInLine) return a.indexInLine - b.indexInLine;
    const ta=a.code.slice(4), tb=b.code.slice(4);
    const la=(ta.match(/[A-Z]/g)||[]).length, lb=(tb.match(/[A-Z]/g)||[]).length;
    if (la !== lb) return lb - la;
    const da=(ta.match(/\d/g)||[]).length, db=(tb.match(/\d/g)||[]).length;
    if (da !== db) return da - db;
    const pa = (+((ta.length===4)||(ta.length===5)));
    const pb = (+((tb.length===4)||(tb.length===5)));
    return pb - pa;
  });
  return hits[0]?.code || null;
}

function getBestEurocode(rawText){
  const txt = sanitize(rawText);

  // STRICT (por linha)
  const strictHits = findStrictPerLine(txt);
  if (strictHits.length){
    strictHits.sort((a,b)=>scoreStrictHit(b)-scoreStrictHit(a));
    if (DIAG) console.log('[STRICT hits]', strictHits);
    return strictHits[0].code;
  }

  // FALLBACK por linha
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
    return "7289BGNM 2000000 OCL DACIA LODGY 3/5P MVM 1\nPILKINGTON AUTOMOTIVE\n3351BGSHBW1J R FIAT";
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
      if (DIAG) console.log('[OCR TEXT]\\n'+ocrText, '\\n[EUROCODE]', euro);
      if (euro){
        showSuccess('EUROCODE encontrado', euro, 'STRICT por linha; sem hífens; sufixo começa por 2 letras.');
        await saveCapture({ type:'EUROCODE', eurocode:euro, raw: ocrText });
        refreshList();
      } else {
        showError('Não encontrei um EUROCODE válido (4 dígitos + 2–7, sufixo começa por 2 letras, sem hífen).');
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