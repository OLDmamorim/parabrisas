// =========================
// APP.JS - sessão por cookie, sem localStorage
// =========================

// Endpoints
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

const resultsBody  = document.getElementById('resultsBody');
const desktopStatus= document.getElementById('desktopStatus');
const toast        = document.getElementById('toast');

let RESULTS = [];
let FILTERED_RESULTS = [];

// ---- Helpers para brand/vehicle (simples e suficientes)
function detectBrandFromText(raw){
  if(!raw) return '';
  const t = String(raw).toUpperCase();
  const BRANDS = ['PILKINGTON','SAINT','SEKURIT','GUARDIAN','FUYAO','XYG','NORDGLASS','SPLINTEX','VITRO','MOPAR','TOYOTA','FORD','GM','VW','VOLVO','SCANIA','MAN','DAF'];
  for(const b of BRANDS) if(t.includes(b)) return b;
  return '';
}
function detectVehicleAndModelFromText(_){ return { brand:'', model:'', full:'' }; }

// ---- UI
function showToast(msg,type=''){ if(!toast) return; toast.textContent=msg; toast.className='toast show '+type; setTimeout(()=>toast.className='toast',2000); }
function setStatus(el,txt,mode=''){ if(!el)return; el.textContent=txt||''; el.classList.remove('error','success'); if(mode) el.classList.add(mode); }

// ---- Normalização (inclui loja/observacoes)
function normalizeRow(r){
  let ts = r.timestamp || r.created_at || r.updated_at || r.ts || new Date().toLocaleString('pt-PT');
  if (typeof ts==='string' && ts.includes('T')) { try{ ts = new Date(ts).toLocaleString('pt-PT'); }catch{} }
  return {
    id:        r.id,
    timestamp: ts,
    text:      r.text || '',
    eurocode:  r.eurocode || '',
    filename:  r.filename || '',
    source:    r.source || '',
    brand:     r.brand || detectBrandFromText(r.text || ''),
    vehicle:   r.vehicle || '',
    matricula: r.matricula || '',
    loja:      r.loja || 'LOJA',
    observacoes: r.observacoes || ''
  };
}

// ---- Carregar resultados (cookie HTTP-Only via credentials:'include')
async function loadResults(){
  try{
    setStatus(desktopStatus,'A carregar...');
    const res = await fetch(LIST_URL, { credentials: 'include' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    RESULTS = (data.rows || []).map(normalizeRow);
    FILTERED_RESULTS = [...RESULTS];
    renderTable();
    setStatus(desktopStatus, `${RESULTS.length} registos`, 'success');
  }catch(e){
    console.error('loadResults', e);
    setStatus(desktopStatus, 'Erro a carregar', 'error');
    resultsBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Sem acesso. Faz login e atualiza.</td></tr>`;
  }
}

// ---- Render
function renderTable(){
  const rows = FILTERED_RESULTS.length ? FILTERED_RESULTS : RESULTS;
  if (rows.length === 0) {
    resultsBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Nenhum registo</td></tr>`;
    return;
  }
  resultsBody.innerHTML = rows.map((row,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${row.timestamp}</td>
      <td>${row.vehicle || '—'}</td>
      <td>${row.eurocode}</td>
      <td>${row.brand || '—'}</td>
      <td><input value="${row.matricula||''}" placeholder="XX-XX-XX"
                 onblur="updateMatricula(${row.id},this.value)"></td>
      <td>
        <select onchange="updateLoja(${row.id},this.value)">
          <option value="LOJA" ${(row.loja==='LOJA')?'selected':''}>LOJA</option>
          <option value="SM" ${(row.loja==='SM')?'selected':''}>SM</option>
        </select>
      </td>
      <td><input value="${row.observacoes||''}" placeholder="Observações..."
                 onblur="updateObservacoes(${row.id},this.value)"></td>
      <td><button onclick="deleteRow(${row.id})">🗑️</button></td>
    </tr>`).join('');
}

// ---- Updates (todos via cookie, sem headers de token)
async function updateLoja(id,loja){
  await fetch(UPDATE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, loja }) });
}
async function updateObservacoes(id,observacoes){
  await fetch(UPDATE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, observacoes }) });
}
async function updateMatricula(id,matricula){
  await fetch(UPDATE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, matricula }) });
}
window.updateLoja=updateLoja; window.updateObservacoes=updateObservacoes; window.updateMatricula=updateMatricula;

// ---- Delete
async function deleteRow(id){
  if (!confirm('Eliminar este registo?')) return;
  await fetch(DELETE_URL, { method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }) });
  await loadResults();
}
window.deleteRow=deleteRow;

// ---- OCR (não precisa de sessão)
async function runOCR(imageBase64){
  const r = await fetch(OCR_ENDPOINT,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ imageBase64 }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json(); return d.text || '';
}

// ---- Inicialização
document.addEventListener('DOMContentLoaded', () => { loadResults(); });
