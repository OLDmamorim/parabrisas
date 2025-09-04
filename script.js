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
   EUROCODE - EXTRAÇÃO ROBUSTA v4
   Regras:
   - Forma válida final: ^\d{4}[A-Z0-9]{2,7}$ (sem hífens).
   - Pode estar junto ou separado por ESPAÇOS/QUEBRAS; NÃO atravessa hífen.
   - HARD STOP: assim que fica válido (>=2 no sufixo), só aceita tokens de 1 char; se vier token >1, pára.
   - Corrige confusões O/I/L nos 4 dígitos.
   ========================= */
function normalizeDigitLike(c){ const map={ 'O':'0','Q':'0','D':'0','I':'1','L':'1','B':'8','S':'5','Z':'2' }; return map[c]||c; }
function sanitizeForScan(raw){ return String(raw||'').toUpperCase().replace(/\u00A0/g,' '); }

/** Divide preservando separadores para sabermos se há hífen entre tokens */
function splitWithSeps(txt){
  const parts = [];
  const re = /[A-Z0-9]+|[^A-Z0-9]+/g;
  let m;
  while ((m = re.exec(txt)) !== null) parts.push(m[0]);
  // construir array de {tok, sepAfter}
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

function extractEurocodeCandidates(rawText){
  const txt = sanitizeForScan(rawText);
  const seq = splitWithSeps(txt);           // mantém info do separador após cada token
  const found = new Set();

  for (let i=0;i<seq.length;i++){
    const cur = seq[i];
    let m = cur.tok.match(/^(\d{4})([A-Z0-9]{2,7})$/);
    if (m){ push(m[1]+m[2]); continue; }

    m = cur.tok.match(/^(\d{4})([A-Z0-9]{0,7})$/);
    if (m){
      const prefix = m[1];
      let suffix = m[2]||'';
      let j = i;

      // junta tokens respeitando separadores (NÃO atravessa hífen)
      while (suffix.length < 7) {
        // se já consumimos o token atual, avançar
        if (suffix.length === (m[2]||'').length) {
          // se separador a seguir ao token atual contém hífen, PARAR
          if (seq[j].sepAfter && seq[j].sepAfter.includes('-')) break;
        }

        // escolher próximo token
        const nxt = seq[j+1];
        if (!nxt) break;

        // se o separador entre cur e nxt tem hífen, PARAR
        if (seq[j].sepAfter && seq[j].sepAfter.includes('-')) break;

        const tk = nxt.tok;
        if (!/^[A-Z0-9]+$/.test(tk)) break;

        if (suffix.length < 2){
          const take = Math.min(tk.length, 7 - suffix.length);
          suffix += tk.slice(0,take);
        } else {
          if (tk.length === 1) suffix += tk;
          else break; // HARD STOP
        }

        j++;
      }
      if (suffix.length >= 2) push(prefix + suffix.slice(0,7));
      continue;
    }

    // dígitos repartidos em tokens (respeitando separadores sem '-')
    if (/^\d+$/.test(cur.tok)){
      let num = cur.tok, k = i;
      while (num.length < 4 && seq[k].sepAfter && !seq[k].sepAfter.includes('-') && seq[k+1] && /^\d+$/.test(seq[k+1].tok)) {
        num += seq[++k].tok;
      }
      if (num.length === 4){
        let suffix = '';
        while (suffix.length < 7){
          const sep = seq[k].sepAfter || '';
          if (sep.includes('-')) break; // NÃO atravessa hífen
          const nxt = seq[k+1]; if (!nxt) break;
          const tk = nxt.tok; if (!/^[A-Z0-9]+$/.test(tk)) break;

          if (suffix.length < 2){
            const take = Math.min(tk.length, 7 - suffix.length);
            suffix += tk.slice(0,take);
          } else {
            if (tk.length === 1) suffix += tk;
            else break; // HARD STOP
          }
          k++;
        }
        if (suffix.length >= 2) push(num + suffix.slice(0,7));
      }
    }
  }

  function push(code){
    const head = code.slice(0,4).replace(/[A-Z]/g, normalizeDigitLike);
    const tail = code.slice(4);
    const fixed = head + tail;
    if (/^\d{4}[A-Z0-9]{2,7}$/.test(fixed)) found.add(fixed);
  }
  return Array.from(found);
}

function getBestEurocode(rawText){
  const list = extractEurocodeCandidates(rawText);
  if (list.length === 0) return null;
  // preferência por sufixo 4–5 (tipicamente AGNV/AGNY)
  const score = s => { const t = s.length-4; if (t===4||t===5) return 2; if (t===3||t===6) return 1; return 0; };
  return list.sort((a,b)=>score(b)-score(a))[0];
}

/* =========================
   OCR
   ========================= */
async function doOCR(fileOrBlob){
  if (DEMO_MODE){ await wait(600); return "3999-AGNV\nPBL HONDA CIVIC HYBRID\nPB1-U44"; } // nota: hífen NÃO será aceite
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
  if (DEMO_MODE) return [{id:1, eurocode:'3999AGNV', created_at:new Date().toISOString(), desc:'DEMO'}];
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
        showSuccess('EUROCODE encontrado', euro, 'Sem aceitar hífens.');
        await saveCapture({ type:'EUROCODE', eurocode:euro, raw: ocrText });
        refreshList();
      } else {
        showError('Não encontrei um EUROCODE válido (4 dígitos + 2–7 A/Z/0–9, **sem hífen**).');
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