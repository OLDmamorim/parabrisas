// =========================
// APP.JS - versão corrigida 20/09/2025
// =========================

// ---- Endpoints ----
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// ===== Auth token helper =====
const TOKEN_KEY = 'eg_auth_token';
function getSavedToken(){ try { return localStorage.getItem(TOKEN_KEY) || ''; } catch{ return ''; } }
function saveToken(t){ try { localStorage.setItem(TOKEN_KEY,t||''); } catch{} }
async function promptForToken(msg='Cola aqui o token'){ 
  let t = window.prompt(msg,getSavedToken()||''); 
  if(t && t.trim()){ if(!t.startsWith('Bearer ')) t='Bearer '+t.trim(); saveToken(t); return t; } 
  return null; 
}
async function authorizedFetch(url,options={}){ 
  const opts={...options,headers:{...(options.headers||{})}}; 
  let token=getSavedToken(); 
  if(token){ opts.headers['Authorization']=token; opts.headers['x-api-key']=token; }
  let res=await fetch(url,opts); 
  if(res.status===401||res.status===403){ 
    token=await promptForToken(); 
    if(token){ opts.headers['Authorization']=token; opts.headers['x-api-key']=token; res=await fetch(url,opts); } 
  } 
  return res; 
}

// ---- Helpers para brand/vehicle ----
function detectBrandFromText(raw){
  if(!raw) return '';
  const t=String(raw).toUpperCase();
  const BRANDS=['PILKINGTON','GUARDIAN','SEKURIT','SAINT','FUYAO','XYG','NORDGLASS','SPLINTEX','VITRO','MOPAR','TOYOTA','FORD','GM','VW','VOLVO','SCANIA','MAN','DAF'];
  for(const b of BRANDS) if(t.includes(b)) return b;
  return '';
}
function detectVehicleAndModelFromText(txt){ return {brand:'',model:'',full:''}; }

// ---- Seletores ----
const resultsBody=document.getElementById('resultsBody');
const desktopStatus=document.getElementById('desktopStatus');
const toast=document.getElementById('toast');
const fileInput=document.getElementById('fileInput');
const btnUpload=document.getElementById('btnUpload');
const btnClear=document.getElementById('btnClear');
const cameraInput=document.getElementById('cameraInput');
const btnCamera=document.getElementById('btnCamera');

let RESULTS=[],FILTERED_RESULTS=[];

// ---- UI helpers ----
function showToast(msg,type=''){ if(toast){ toast.textContent=msg; toast.className='toast show '+type; setTimeout(()=>toast.className='toast',2000);} }
function setStatus(el,text,mode=''){ if(!el)return; el.textContent=text; el.classList.remove('error','success'); if(mode) el.classList.add(mode); }

// ---- Normalização ----
function normalizeRow(r){
  let ts=r.timestamp||r.created_at||r.updated_at||r.ts||new Date().toLocaleString('pt-PT');
  if(typeof ts==='string'&&ts.includes('T')){ try{ts=new Date(ts).toLocaleString('pt-PT');}catch{} }
  return {
    id:r.id, timestamp:ts, text:r.text||'', 
    eurocode:r.eurocode||'', filename:r.filename||'', source:r.source||'',
    brand:r.brand||detectBrandFromText(r.text||''),
    vehicle:r.vehicle||'', matricula:r.matricula||'',
    loja:r.loja||'LOJA', observacoes:r.observacoes||''
  };
}

// ---- Carregar resultados ----
async function loadResults(){
  try{
    setStatus(desktopStatus,'A carregar...');
    const res=await authorizedFetch(LIST_URL);
    if(!res.ok) throw new Error(res.status);
    const data=await res.json();
    RESULTS=(data.rows||[]).map(normalizeRow);
    FILTERED_RESULTS=[...RESULTS];
    renderTable();
    setStatus(desktopStatus,`${RESULTS.length} registos`,'success');
  }catch(e){ console.error(e); setStatus(desktopStatus,'Erro a carregar','error'); }
}

// ---- Render ----
function renderTable(){
  const rows=FILTERED_RESULTS.length?FILTERED_RESULTS:RESULTS;
  if(rows.length===0){ resultsBody.innerHTML='<tr><td colspan="9">Nenhum registo</td></tr>'; return; }
  resultsBody.innerHTML=rows.map((row,i)=>`
    <tr>
      <td>${i+1}</td><td>${row.timestamp}</td>
      <td>${row.vehicle||'—'}</td><td>${row.eurocode}</td><td>${row.brand||'—'}</td>
      <td><input value="${row.matricula||''}" onblur="updateMatricula(${row.id},this.value)"></td>
      <td><select onchange="updateLoja(${row.id},this.value)">
          <option value="LOJA" ${(row.loja==='LOJA')?'selected':''}>LOJA</option>
          <option value="SM" ${(row.loja==='SM')?'selected':''}>SM</option></select></td>
      <td><input value="${row.observacoes||''}" onblur="updateObservacoes(${row.id},this.value)"></td>
      <td><button onclick="deleteRow(${row.id})">🗑️</button></td>
    </tr>`).join('');
}

// ---- Updates ----
async function updateLoja(id,loja){ await authorizedFetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,loja})}); }
async function updateObservacoes(id,obs){ await authorizedFetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,observacoes:obs})}); }
async function updateMatricula(id,mat){ await authorizedFetch(UPDATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,matricula:mat})}); }
window.updateLoja=updateLoja; window.updateObservacoes=updateObservacoes; window.updateMatricula=updateMatricula;

// ---- Delete ----
async function deleteRow(id){ if(!confirm('Eliminar?'))return; await authorizedFetch(DELETE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); await loadResults(); }
window.deleteRow=deleteRow;

// ---- Clear ----
async function clearTable(){ if(!confirm('Limpar tudo?'))return; await authorizedFetch('/.netlify/functions/clear-ocr',{method:'POST'}); await loadResults(); }
window.clearTable=clearTable;

// ---- OCR ----
async function runOCR(b64){ const r=await fetch(OCR_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:b64})}); return (await r.json()).text||''; }

// ---- Init ----
document.addEventListener('DOMContentLoaded',()=>{ loadResults(); if(btnUpload)btnUpload.onclick=()=>fileInput.click(); if(fileInput)fileInput.onchange=e=>{const f=e.target.files[0]; if(f)processImage(f);}; if(btnCamera)btnCamera.onclick=()=>cameraInput.click(); if(cameraInput)cameraInput.onchange=e=>{const f=e.target.files[0]; if(f)processImage(f);}; if(btnClear)btnClear.onclick=clearTable; });
