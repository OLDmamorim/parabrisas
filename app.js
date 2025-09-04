/* =========================
 * CONFIG
 * ========================= */
const OCR_ENDPOINT = "/api/ocr-proxy"; // TODO: confirma
const USE_BACKEND  = false;            // mete true quando ligares API

/* =========================
 * DOM
 * ========================= */
const els = {
  camInput:   document.getElementById('cameraInput'),
  btnUpload:  document.getElementById('btnUpload'),
  fileInput:  document.getElementById('fileInput'),
  btnExport:  document.getElementById('btnExport'),
  btnClear:   document.getElementById('btnClear'),
  tbody:      document.getElementById('resultsBody'),
  toast:      document.getElementById('toast'),
  mobileList: document.getElementById('mobileHistoryList'),
  helpBtn:    document.getElementById('helpBtn'),
  helpBtn2:   document.getElementById('helpBtnDesktop'),
  helpModal:  document.getElementById('helpModal'),
  helpClose:  document.getElementById('helpClose'),
};

/* =========================
 * STORAGE (fallback local)
 * ========================= */
const LS_KEY = 'eg_capturas_v1';

function loadRows(){
  if (USE_BACKEND) return []; // será preenchido via API list
  try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ return []; }
}
function saveRows(rows){
  if (USE_BACKEND) return; // API save já trata
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

/* =========================
 * EUROCODE PARSER (único)
 * Regra: 4 dígitos + 2 letras + 0–5 alfanuméricos,
 * e o sufixo final precisa ter pelo menos 1 letra.
 * Funciona mesmo com quebras de linha e separadores.
 * ========================= */
function parseEurocode(raw){
  const text = String(raw||'').toUpperCase();
  const tokens = text.split(/[^A-Z0-9]+/).filter(Boolean);
  const VALID = /^\d{4}[A-Z]{2}[A-Z0-9]{0,5}$/;
  const hasLetterInTail = code => /[A-Z]/.test(code.slice(6));

  // A) match contíguo dentro do token (1º válido)
  for (const t of tokens){
    const m = t.match(/\d{4}[A-Z]{2}[A-Z0-9]{0,5}/);
    if (m && VALID.test(m[0]) && hasLetterInTail(m[0])) return m[0];
  }
  // B) reconstrução entre tokens consecutivos (4 dígitos + 2 letras)
  for (let i=0;i<tokens.length-1;i++){
    const a = tokens[i], b = tokens[i+1];
    if (/^\d{4}$/.test(a) && /^[A-Z]{2}/.test(b)){
      const code = (a+b).slice(0,11);
      if (VALID.test(code) && hasLetterInTail(code)) return code;
    }
  }
  return null;
}

/* =========================
 * OCR
 * ========================= */
async function doOCR(file){
  // TODO: liga ao teu endpoint; este é um exemplo típico
  const fd = new FormData();
  fd.append('file', file, 'etiqueta.jpg');
  const res = await fetch(OCR_ENDPOINT, { method:'POST', body: fd });
  if(!res.ok) throw new Error(`OCR falhou (${res.status})`);
  const data = await res.json();
  return data?.text || data?.fullText || data?.ocr || '';
}

/* =========================
 * BACKEND (mocks)
 * ========================= */
async function apiList(){
  if (USE_BACKEND){
    // TODO: GET /api/list-ocr
    return [];
  }
  return loadRows();
}
async function apiSave(row){
  if (USE_BACKEND){
    // TODO: POST /api/save-ocr
    return { ok:true, id: Date.now() };
  }
  const rows = loadRows();
  rows.unshift(row);
  saveRows(rows);
  return { ok:true, id: row.id };
}
async function apiDelete(id){
  if (USE_BACKEND){
    // TODO: POST /api/delete-ocr
    return { ok:true };
  }
  const rows = loadRows().filter(r=>r.id!==id);
  saveRows(rows);
  return { ok:true };
}
async function apiUpdate(id, patch){
  if (USE_BACKEND){
    // TODO: POST /api/update-ocr
    return { ok:true };
  }
  const rows = loadRows().map(r=> r.id===id ? {...r, ...patch} : r );
  saveRows(rows);
  return { ok:true };
}

/* =========================
 * RENDER
 * ========================= */
function fmtDate(ts){
  try{
    return new Date(ts).toLocaleString('pt-PT');
  }catch{ return ts; }
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function renderTable(rows){
  if(!els.tbody) return;
  if(!rows.length){
    els.tbody.innerHTML = '';
    return;
  }
  els.tbody.innerHTML = rows.map((r,idx)=>`
    <tr>
      <td>${rows.length-idx}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td class="ocr-cell"><pre>${escapeHtml(r.ocr_text)}</pre></td>
      <td class="euro-cell">
        <span class="eurocode">${r.eurocode?escapeHtml(r.eurocode):'—'}</span>
      </td>
      <td>
        <button class="mini" data-edit="${r.id}">✏️</button>
        <button class="mini danger" data-del="${r.id}">🗑️</button>
      </td>
    </tr>
  `).join('');
}
function renderMobile(rows){
  if(!els.mobileList) return;
  if(!rows.length){
    els.mobileList.innerHTML = `<p class="history-empty">Ainda não há capturas realizadas.</p>`;
    return;
  }
  els.mobileList.innerHTML = rows.slice(0,20).map(r=>`
    <div class="cap-row">
      <div class="cap-time">${fmtDate(r.created_at)}</div>
      <div class="cap-euro">${r.eurocode?`<strong>${escapeHtml(r.eurocode)}</strong>`:'—'}</div>
      <div class="cap-text">${escapeHtml((r.ocr_text||'').slice(0,160))}${(r.ocr_text||'').length>160?'…':''}</div>
    </div>
  `).join('');
}

/* =========================
 * TOAST / HELP
 * ========================= */
let toastTimer;
function toast(msg, kind='ok'){
  if(!els.toast) return;
  els.toast.className = `toast ${kind}`;
  els.toast.textContent = msg;
  els.toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> els.toast.style.opacity='0', 2600);
}
function wireHelp(){
  const open = ()=>{ els.helpModal?.setAttribute('aria-hidden','false'); els.helpModal?.classList.add('open'); };
  const close= ()=>{ els.helpModal?.setAttribute('aria-hidden','true');  els.helpModal?.classList.remove('open'); };
  els.helpBtn?.addEventListener('click', open);
  els.helpBtn2?.addEventListener('click', open);
  els.helpClose?.addEventListener('click', close);
  els.helpModal?.addEventListener('click', e=>{ if(e.target===els.helpModal) close(); });
}

/* =========================
 * EXPORT CSV
 * ========================= */
function toCSV(rows){
  const header = ['#','Data/Hora','Texto OCR','Eurocode'];
  const lines = [header.join(';')];
  const total = rows.length;
  rows.forEach((r,idx)=>{
    const num = total-idx;
    const cols = [
      num,
      fmtDate(r.created_at).replaceAll(';',','),
      (r.ocr_text||'').replaceAll('\n',' ').replaceAll(';',','),
      r.eurocode||''
    ];
    lines.push(cols.join(';'));
  });
  return lines.join('\n');
}
function download(filename, text){
  const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
}

/* =========================
 * EVENTS
 * ========================= */
async function refresh(){
  const rows = await apiList();
  renderTable(rows);
  renderMobile(rows);
  wireRowActions();
}
function wireRowActions(){
  // delete
  document.querySelectorAll('[data-del]').forEach(btn=>{
    btn.onclick = async ()=> {
      const id = Number(btn.dataset.del);
      await apiDelete(id);
      toast('Registo apagado.');
      refresh();
    };
  });
  // edit eurocode
  document.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.onclick = async ()=> {
      const id = Number(btn.dataset.edit);
      const rows = await apiList();
      const row = rows.find(r=>r.id===id);
      const cur = row?.eurocode || '';
      const val = prompt('Editar Eurocode:', cur);
      if (val===null) return;
      await apiUpdate(id, { eurocode: (val||'').toUpperCase().replace(/[^A-Z0-9]/g,'') });
      toast('Eurocode atualizado.');
      refresh();
    };
  });
}

async function handleFiles(files){
  const file = files?.[0];
  if (!file) return;

  try{
    toast('A ler etiqueta…');
    const text = await doOCR(file);
    const euro = parseEurocode(text);

    const row = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      ocr_text: text,
      eurocode: euro
    };
    await apiSave(row);
    toast(euro?`EUROCODE: ${euro}`:'Texto lido. Eurocode não detetado.');
    refresh();
  }catch(e){
    console.error(e);
    toast('Falha no OCR. Tenta de novo.', 'err');
  }
}

/* =========================
 * INIT
 * ========================= */
function init(){
  // inputs
  els.camInput?.addEventListener('change', e=>{ handleFiles(e.target.files); e.target.value=''; });
  els.btnUpload?.addEventListener('click', ()=> els.fileInput?.click());
  els.fileInput?.addEventListener('change', e=>{ handleFiles(e.target.files); e.target.value=''; });

  // export / clear
  els.btnExport?.addEventListener('click', async ()=>{
    const rows = await apiList();
    if (!rows.length) return toast('Sem dados para exportar.');
    download(`capturas_${new Date().toISOString().slice(0,10)}.csv`, toCSV(rows));
  });
  els.btnClear?.addEventListener('click', async ()=>{
    if (!confirm('Limpar todos os registos?')) return;
    if (USE_BACKEND){
      // TODO: endpoint para limpar tudo
    } else {
      saveRows([]);
    }
    toast('Tabela limpa.');
    refresh();
  });

  wireHelp();
  refresh();
}
document.addEventListener('DOMContentLoaded', init);