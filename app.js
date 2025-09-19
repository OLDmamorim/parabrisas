// =========================
// APP.JS – sessão por cookie, sem localStorage
// Colunas: # | Data/Hora | Tipo | Veículo | Eurocode | Marca | Matrícula | SM/LOJA | OBS | Ações
// =========================

// Endpoints
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// Seletores base
const resultsBody   = document.getElementById('resultsBody');
const desktopStatus = document.getElementById('desktopStatus');
const toast         = document.getElementById('toast');

const fileInput  = document.getElementById('fileInput');
const btnUpload  = document.getElementById('btnUpload');
const btnExport  = document.getElementById('btnExport');
const btnClear   = document.getElementById('btnClear');
const cameraInput= document.getElementById('cameraInput');
const btnCamera  = document.getElementById('btnCamera');

let RESULTS = [];
let FILTERED_RESULTS = [];

// -------------------------
// Helpers de marca / veículo
function detectBrandFromText(raw){
  if(!raw) return '';
  const t = String(raw).toUpperCase();
  const BRANDS = [
    'PILKINGTON','SAINT','SEKURIT','GUARDIAN','FUYAO','XYG','NORDGLASS','SPLINTEX',
    'VITRO','MOPAR','TOYOTA','FORD','GM','VW','VOLVO','SCANIA','MAN','DAF'
  ];
  for(const b of BRANDS) if(t.includes(b)) return b;
  return '';
}
function detectVehicleAndModelFromText(_){ return { brand:'', model:'', full:'' }; }

// Tipologia de vidro a partir da 1.ª letra do eurocode
function detectGlassType(eurocode){
  if(!eurocode) return '—';
  const m = String(eurocode).toUpperCase().match(/[A-Z]/);
  if(!m) return '—';
  switch(m[0]){
    case 'A': return 'Parabrisas';
    case 'B': return 'Óculo';
    case 'L':
    case 'R': return 'Lateral';
    case 'T': return 'Teto';
    default:  return '—';
  }
}

// -------------------------
// UI
function showToast(msg,type=''){ if(!toast) return; toast.textContent=msg; toast.className='toast show '+type; setTimeout(()=>toast.className='toast',2000); }
function setStatus(el,txt,mode=''){ if(!el)return; el.textContent=txt||''; el.classList.remove('error','success'); if(mode) el.classList.add(mode); }

// Campo de pesquisa (por eurocode)
function createSearchField(){
  const toolbar = document.querySelector('.toolbar');
  if(!toolbar || document.getElementById('searchField')) return;
  toolbar.insertAdjacentHTML('beforeend', `
    <span style="color: rgba(255,255,255,0.8); font-size: 14px; margin-left: 20px;">🔍</span>
    <input id="searchField" type="text" placeholder="Procurar Eurocode..."
      style="margin-left:8px;padding:6px 10px;border:1px solid rgba(255,255,255,0.3);
             border-radius:4px;font-size:14px;background:rgba(255,255,255,0.1);color:#fff;width:180px;">
    <button id="clearSearch" style="margin-left:6px;padding:6px 8px;background:none;color:rgba(255,255,255,0.8);
             border:1px solid rgba(255,255,255,0.3);border-radius:4px;cursor:pointer;">✕</button>
  `);
  const searchField = document.getElementById('searchField');
  const clearBtn    = document.getElementById('clearSearch');
  searchField.addEventListener('input', e => filterResults(e.target.value));
  clearBtn.addEventListener('click', () => { searchField.value=''; filterResults(''); });
}
function filterResults(term){
  term = (term||'').trim().toLowerCase();
  FILTERED_RESULTS = term ? RESULTS.filter(r => (r.eurocode||'').toLowerCase().includes(term)) : [...RESULTS];
  renderTable();
}

// -------------------------
// Normalização (inclui loja/observacoes)
function normalizeRow(r){
  let ts = r.timestamp || r.created_at || r.updated_at || r.ts || new Date().toLocaleString('pt-PT');
  if (typeof ts==='number') ts = new Date(ts).toLocaleString('pt-PT');
  if (typeof ts==='string' && ts.includes('T')) { try{ ts = new Date(ts).toLocaleString('pt-PT'); }catch{} }
  const text = r.text || '';
  let brand  = r.brand || '';
  if(!brand && text) brand = detectBrandFromText(text) || '';
  return {
    id: r.id,
    timestamp: ts,
    text,
    eurocode: r.eurocode || '',
    filename: r.filename || '',
    source: r.source || '',
    brand,
    vehicle: r.vehicle || '',
    matricula: r.matricula || '',
    loja: r.loja || 'LOJA',
    observacoes: r.observacoes || ''
  };
}

// -------------------------
// Carregar resultados (cookie HTTP-only via credentials:'include')
async function loadResults(){
  try{
    setStatus(desktopStatus,'A carregar...');
    const res = await fetch(LIST_URL, { credentials:'include' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    RESULTS = (data.rows||[]).map(normalizeRow);
    FILTERED_RESULTS = [...RESULTS];
    renderTable();
    setStatus(desktopStatus, `${RESULTS.length} registos`, 'success');
  }catch(e){
    console.error('loadResults', e);
    setStatus(desktopStatus, 'Erro a carregar', 'error');
    if(resultsBody) resultsBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Sem acesso. Inicia sessão e atualiza.</td></tr>`;
  }
}

// -------------------------
// Render – alinha com o cabeçalho da tua tabela
function renderTable(){
  if(!resultsBody) return;
  const data = FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS;
  if(data.length===0){
    resultsBody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:16px;">Nenhum registo</td></tr>`;
    return;
  }

  resultsBody.innerHTML = data.map((row, idx) => {
    const glassType = detectGlassType(row.eurocode);
    return `
      <tr>
        <td>${idx+1}</td>
        <td>${row.timestamp}</td>
        <td style="font-weight:600;color:#16a34a;">${glassType}</td>
        <td>${row.vehicle || '—'}</td>
        <td style="font-weight:bold;color:#007acc;">${row.eurocode || ''}</td>
        <td>${row.brand || '—'}</td>
        <td>
          <input type="text" value="${row.matricula||''}" placeholder="XX-XX-XX" maxlength="8"
                 style="width:110px;padding:4px;border:1px solid #ddd;border-radius:4px;text-transform:uppercase;text-align:center;"
                 onblur="updateMatricula(${row.id}, this.value)" onkeypress="if(event.key==='Enter') this.blur()">
        </td>
        <td>
          <select onchange="updateLoja(${row.id}, this.value)"
                  style="width:85px;padding:4px;border:1px solid #ddd;border-radius:4px;font-weight:600;">
            <option value="LOJA" ${(row.loja||'LOJA')==='LOJA'?'selected':''}>LOJA</option>
            <option value="SM" ${row.loja==='SM'?'selected':''}>SM</option>
          </select>
        </td>
        <td>
          <input type="text" value="${row.observacoes||''}" placeholder="Observações..."
                 style="width:200px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                 onblur="updateObservacoes(${row.id}, this.value)" onkeypress="if(event.key==='Enter') this.blur()">
        </td>
        <td>
          <button title="Eliminar" onclick="deleteRow(${row.id})"
                  style="padding:4px 8px;background:none;color:#dc3545;border:none;cursor:pointer;border-radius:4px;"
                  onmouseover="this.style.background='rgba(220,53,69,0.1)'" onmouseout="this.style.background='none'">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// -------------------------
// Updates inline (BD, via cookie)
async function updateLoja(id, loja){
  await fetch(UPDATE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, loja }) });
}
async function updateObservacoes(id, observacoes){
  await fetch(UPDATE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, observacoes }) });
}
async function updateMatricula(id, matricula){
  await fetch(UPDATE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, matricula }) });
}
window.updateLoja = updateLoja;
window.updateObservacoes = updateObservacoes;
window.updateMatricula = updateMatricula;

// -------------------------
// Export CSV (botão Exportar Excel)
function exportCSV(){
  const rows = (FILTERED_RESULTS.length?FILTERED_RESULTS:RESULTS);
  if(!rows.length){ showToast('Sem dados para exportar','error'); return; }
  const headers = ['#','Data/Hora','Tipo','Veículo','Eurocode','Marca','Matrícula','SM/LOJA','OBS'];
  const lines = rows.map((r,i)=>[
    i+1,
    `"${r.timestamp}"`,
    `"${detectGlassType(r.eurocode)}"`,
    `"${(r.vehicle||'').replace(/"/g,'""')}"`,
    `"${r.eurocode||''}"`,
    `"${r.brand||''}"`,
    `"${r.matricula||''}"`,
    `"${r.loja||''}"`,
    `"${(r.observacoes||'').replace(/"/g,'""')}"`
  ].join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expressglass_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
window.exportCSV = exportCSV;

// -------------------------
// Limpar tabela
async function clearTable(){
  if(!confirm('Limpar todos os dados?')) return;
  await fetch('/.netlify/functions/clear-ocr', { method:'POST', credentials:'include' });
  await loadResults();
}
window.clearTable = clearTable;

// -------------------------
// OCR (não precisa de sessão)
async function runOCR(imageBase64){
  const r = await fetch(OCR_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ imageBase64 }) });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json(); return d.text || '';
}
async function processImage(file){
  if(!file) return;
  const base64 = await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result.split(',')[1]); fr.onerror=rej; fr.readAsDataURL(file); });
  const text = await runOCR(base64);
  if(!text){ showToast('Nenhum texto na imagem','error'); return; }
  // guarda já (sem modal) – podes trocar para modal se quiseres
  const brand    = detectBrandFromText(text) || '';
  const vehicle  = detectVehicleAndModelFromText(text).full || '';
  await fetch(SAVE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ text, eurocode:'', filename:file.name, source:'upload', brand, vehicle })
  });
  await loadResults();
}

// -------------------------
// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  loadResults();
  createSearchField();

  if(btnUpload) btnUpload.addEventListener('click', () => fileInput?.click());
  if(fileInput) fileInput.addEventListener('change', e => { const f=e.target.files?.[0]; if(f) processImage(f); });
  if(btnCamera) btnCamera.addEventListener('click', () => cameraInput?.click());
  if(cameraInput) cameraInput.addEventListener('change', e => { const f=e.target.files?.[0]; if(f) processImage(f); });
  if(btnExport) btnExport.addEventListener('click', exportCSV);
  if(btnClear)  btnClear.addEventListener('click', clearTable);
});
