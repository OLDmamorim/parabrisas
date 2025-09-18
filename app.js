// APP.JS (BD + Export Excel com modal, presets, memória e nome do ficheiro com datas)
// ——————————————————————————————————————————————————————————————————————

// ---- Endpoints ----
const BASE = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const OCR_ENDPOINT = `${BASE}/.netlify/functions/ocr-proxy`;
const LIST_URL     = `${BASE}/.netlify/functions/list-ocr`;
const SAVE_URL     = `${BASE}/.netlify/functions/save-ocr`;
const UPDATE_URL   = `${BASE}/.netlify/functions/update-ocr`;
const DELETE_URL   = `${BASE}/.netlify/functions/delete-ocr`;

// ===== Auth token helper (auto) =====
const TOKEN_KEY = 'eg_auth_token';
function getSavedToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch(_) { return ''; } }
function saveToken(token) { try { localStorage.setItem(TOKEN_KEY, token || ''); } catch(_){} }
async function promptForToken(message='Cola aqui o token de autenticação') {
  const t = window.prompt(message, getSavedToken() || '');
  if (t && t.trim()) { saveToken(t.trim()); return t.trim(); }
  return null;
}
async function authorizedFetch(url, options={}) {
  const opts = Object.assign({ headers: {} }, options);
  opts.headers = Object.assign({}, opts.headers);
  let token = getSavedToken();
  if (token) {
    opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    opts.headers['x-api-key'] = token;
  }
  let res = await fetch(url, opts);
  if (res.status === 401 || res.status === 403) {
    token = await promptForToken('Token necessário. Cola aqui o token (ex.: Bearer xxxxx ou só o token)');
    if (token) {
      opts.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      opts.headers['x-api-key'] = token;
      res = await fetch(url, opts);
    }
  }
  return res;
}
// Atalho via consola: setAuthToken('...')
window.setAuthToken = function(t){ if (!t) return; saveToken(t); alert('Token guardado.'); };

// ---- Estado ----
let RESULTS = [];
let FILTERED_RESULTS = [];

// ---- Util ----
function setStatus(el, msg, type='info'){ if (!el) return; el.textContent = msg; el.style.color = (type==='error' ? '#f87171' : type==='success' ? '#34d399' : '#a3aed0'); }

// ===== Helpers: datas utilitárias =====
function fmtYMD(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function firstDayOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }

// ===== Memória de seleção do export =====
const EXPORT_MEMO_START = 'export_start_ymd';
const EXPORT_MEMO_END   = 'export_end_ymd';
const EXPORT_MEMO_USEF  = 'export_use_search';
function saveExportPrefs(s, e, useF){ try{ localStorage.setItem(EXPORT_MEMO_START, s || ''); localStorage.setItem(EXPORT_MEMO_END, e || ''); localStorage.setItem(EXPORT_MEMO_USEF, useF ? '1':'0'); }catch(_){}}
function loadExportPrefs(){ try{ return { s: localStorage.getItem(EXPORT_MEMO_START)||'', e: localStorage.getItem(EXPORT_MEMO_END)||'', u:(localStorage.getItem(EXPORT_MEMO_USEF)||'1')==='1' }; }catch(_){ return {s:'',e:'',u:true}; } }

// ===== Filtro por datas =====
function parseAnyDate(ts){ if (!ts) return null; const d=new Date(ts); if(!isNaN(d)) return d; try{ const m=String(ts).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[^\d]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/); if(m){ const dd=+m[1], mm=(+m[2])-1, yy= m[3].length===2? +('20'+m[3]) : +m[3]; const hh=+(m[4]||0), mi=+(m[5]||0), ss=+(m[6]||0); const dt=new Date(yy,mm,dd,hh,mi,ss); if(!isNaN(dt)) return dt; } }catch(_){ } return null; }
function filterByDateRange(rows, startDate, endDate){ if(!startDate && !endDate) return rows; const start = startDate? new Date(startDate+'T00:00:00'):null; const end = endDate? new Date(endDate+'T23:59:59'):null; return rows.filter(r=>{ const dt=parseAnyDate(r.timestamp); if(!dt) return false; if(start && dt<start) return false; if(end && dt>end) return false; return true;}); }

// ===== Excel Export (SheetJS) =====
function exportExcelWithData(dataToExport, opts){
  const list = Array.isArray(dataToExport) ? dataToExport : (FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS);
  const rows = list.map((row, index) => ({
    "#": index + 1,
    "Data/Hora": row.timestamp || "",
    "Tipologia": (typeof detectGlassType === 'function' ? detectGlassType(row.eurocode) : "") || "",
    "Veículo": row.vehicle || "",
    "Eurocode": row.eurocode || "",
    "Marca Vidro": row.brand || "",
    "Matrícula": row.matricula || "",
    "Ficheiro": row.filename || "",
    "Origem": row.source || "",
    "Texto OCR": row.text || ""
  }));
  try {
    let ws;
    if (rows.length === 0) {
      const headers = ["#","Data/Hora","Tipologia","Veículo","Eurocode","Marca Vidro","Matrícula","Ficheiro","Origem","Texto OCR"];
      ws = XLSX.utils.aoa_to_sheet([headers]);
    } else {
      ws = XLSX.utils.json_to_sheet(rows, { cellDates: true });
    }
    ws['!cols'] = [ { wch:4 },{ wch:18 },{ wch:12 },{ wch:20 },{ wch:16 },{ wch:16 },{ wch:12 },{ wch:24 },{ wch:12 },{ wch:80 } ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registos");
    const filename = (opts && opts.filename) ? opts.filename : `expressglass_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    if (typeof showToast === 'function') showToast('Excel exportado com sucesso!', 'success');
  } catch (e) {
    console.error('Erro ao exportar Excel:', e);
    if (typeof showToast === 'function') showToast('Erro ao exportar Excel', 'error');
  }
}
function exportExcel(){ exportExcelWithData(); }

// ===== Modal de exportação (lazy DOM) =====
function openExportModal(){
  const modal = document.getElementById('exportModal');
  if (!modal) { exportExcel(); return; }

  const btnClose   = document.getElementById('exportModalClose');
  const btnCancel  = document.getElementById('exportModalCancel');
  const btnConfirm = document.getElementById('exportModalConfirm');
  const startEl    = document.getElementById('exportStart');
  const endEl      = document.getElementById('exportEnd');
  const useSearch  = document.getElementById('exportUseSearch');

  const memo = loadExportPrefs();
  if (startEl && memo.s) startEl.value = memo.s;
  if (endEl && memo.e) endEl.value = memo.e;
  if (useSearch) useSearch.checked = memo.u;

  const today = new Date();
  const y=today.getFullYear(), m=String(today.getMonth()+1).padStart(2,'0'), d=String(today.getDate()).padStart(2,'0');
  if (endEl && !endEl.value) endEl.value = `${y}-${m}-${d}`;
  if (startEl && !startEl.value){ const dt=new Date(today.getTime()-29*24*3600*1000); const ym=dt.getFullYear(), mm=String(dt.getMonth()+1).padStart(2,'0'), dd=String(dt.getDate()).padStart(2,'0'); startEl.value = `${ym}-${mm}-${dd}`; }

  // Presets
  const pHoje  = document.getElementById('exportPresetHoje');
  const p7     = document.getElementById('exportPreset7');
  const pMes   = document.getElementById('exportPresetMes');
  const pTodos = document.getElementById('exportPresetTodos');
  function setDates(s,e){ if(startEl) startEl.value = s||''; if(endEl) endEl.value = e||''; }
  if (pHoje)  pHoje.onclick  = () => { const t=new Date(); const ymd=fmtYMD(t); setDates(ymd, ymd); };
  if (p7)     p7.onclick     = () => { const t=new Date(); const s=new Date(t.getTime()-6*24*3600*1000); setDates(fmtYMD(s), fmtYMD(t)); };
  if (pMes)   pMes.onclick   = () => { const t=new Date(); setDates(fmtYMD(firstDayOfMonth(t)), fmtYMD(t)); };
  if (pTodos) pTodos.onclick = () => { setDates('', ''); };

  modal.classList.add('show');
  modal.style.display = 'flex';

  const close = () => { modal.classList.remove('show'); modal.style.display='none'; };
  if (btnClose)  btnClose.addEventListener('click', close, { once:true });
  if (btnCancel) btnCancel.addEventListener('click', close, { once:true });
  if (btnConfirm) btnConfirm.addEventListener('click', () => {
    const sVal = startEl?.value || '';
    const eVal = endEl?.value || '';
    const useF = !!(useSearch && useSearch.checked);
    saveExportPrefs(sVal, eVal, useF);
    const base = useF ? (FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS) : RESULTS;
    const ranged = filterByDateRange(base, sVal, eVal);
    const fname = 'expressglass_' + (sVal||'todos') + '_a_' + (eVal||'todos') + '.xlsx';
    exportExcelWithData(ranged, { filename: fname });
    close();
  }, { once:true });
}
// torna global para o onclick do HTML
window.openExportModal = openExportModal;
// Compat: chamadas antigas a exportCSV
window.exportCSV = function(){ if (typeof openExportModal==='function') openExportModal(); else if (typeof exportExcel==='function') exportExcel(); };

// ===== Carregar dados =====
const desktopStatus = document.getElementById('desktopStatus');
async function loadResults(){
  try {
    setStatus(desktopStatus, 'A carregar dados...');
    const res = await authorizedFetch(LIST_URL, { method: 'GET', headers: { 'accept': 'application/json' } });
    const raw = await res.text();
    if (!res.ok) { console.error('LIST_URL falhou', res.status, raw); setStatus(desktopStatus, `Erro a carregar dados (HTTP ${res.status})`, 'error'); return; }
    let data; try { data = JSON.parse(raw); } catch(e){ console.error('JSON inválido em LIST_URL:', raw); setStatus(desktopStatus, 'Resposta inválida do servidor', 'error'); return; }
    if (data.ok && Array.isArray(data.rows)) { RESULTS = data.rows.map(normalizeRow); FILTERED_RESULTS = [...RESULTS]; renderTable(); setStatus(desktopStatus, `${RESULTS.length} registos carregados`, 'success'); }
    else { console.error('Formato inesperado:', data); setStatus(desktopStatus, 'Formato de resposta inválido', 'error'); }
  } catch (err) { console.error('loadResults error:', err); setStatus(desktopStatus, 'Falha ao carregar dados', 'error'); }
}

function normalizeRow(r){
  return {
    timestamp: r.timestamp || r.data || r.date || '',
    eurocode: r.eurocode || r.Eurocode || r.codigo || '',
    brand:    r.brand || r.marca || '',
    vehicle:  r.vehicle || r.veiculo || '',
    matricula:r.matricula || r.plate || '',
    filename: r.filename || r.file || '',
    source:   r.source || '',
    text:     r.text || r.ocr || '',
  };
}

function renderTable(){ /* … aqui fica o teu render atual … */ }

document.addEventListener('DOMContentLoaded', () => {
  const btnExport = document.getElementById('btnExport');
  if (btnExport) btnExport.addEventListener('click', openExportModal);
  // força label do botão
  if (btnExport) btnExport.innerHTML = '📊 Exportar Excel';
  // carrega dados
  loadResults();
});

// Global error surface
window.addEventListener('error', (e) => { try { setStatus && setStatus(desktopStatus, 'Erro de JavaScript: ' + (e.message||''), 'error'); } catch(_){} console.error('JS Error:', e); });