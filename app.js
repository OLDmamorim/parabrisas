/* =========================
   CONFIG & ELEMENTS
   ========================= */
const OCR_ENDPOINT = '/.netlify/functions/ocr-proxy';
const LIST_URL     = '/.netlify/functions/list-ocr';
const SAVE_URL     = '/.netlify/functions/save-ocr';
const UPDATE_URL   = '/.netlify/functions/update-ocr';
const DELETE_URL   = '/.netlify/functions/delete-ocr';

// Mobile elements
const btnCamera      = document.getElementById('btnCamera');
const cameraInput    = document.getElementById('cameraInput');
const btnUpload      = document.getElementById('btnUpload');
const fileInput      = document.getElementById('fileInput');
const mobileProgress = document.getElementById('mobileProgress');
const mobileStatus   = document.getElementById('mobileStatus');
const mobileHistory  = document.getElementById('mobileHistoryList');

// Desktop elements
const btnCamera_d    = document.getElementById('btnCamera_d');
const cameraInput_d  = document.getElementById('cameraInput_d');
const btnUpload_d    = document.getElementById('btnUpload_d');
const fileInput_d    = document.getElementById('fileInput_d');
const resultsBody    = document.getElementById('resultsBody');
const desktopStatus  = document.getElementById('desktopStatus');
const btnExport      = document.getElementById('btnExport');
const btnClear       = document.getElementById('btnClear');

const viewBadge      = document.getElementById('viewBadge');

const isMobile = matchMedia('(max-width: 768px)').matches;

/* =========================
   STARTUP
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  viewBadge.textContent = isMobile ? 'Mobile' : 'Desktop';
  attachEvents();
  fetchList().catch(console.error);
});

/* =========================
   EVENTS
   ========================= */
function attachEvents(){
  // MOBILE
  btnCamera?.addEventListener('click', () => cameraInput.click());
  cameraInput?.addEventListener('change', async (e) => {
    if (e.target.files?.[0]) await handleImage(e.target.files[0], { fromCamera:true });
    e.target.value = '';
  });
  btnUpload?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async (e) => {
    if (e.target.files?.[0]) await handleImage(e.target.files[0]);
    e.target.value = '';
  });

  // DESKTOP
  btnCamera_d?.addEventListener('click', () => cameraInput_d.click());
  cameraInput_d?.addEventListener('change', async (e) => {
    if (e.target.files?.[0]) await handleImage(e.target.files[0], { fromCamera:true });
    e.target.value = '';
  });
  btnUpload_d?.addEventListener('click', () => fileInput_d.click());
  fileInput_d?.addEventListener('change', async (e) => {
    if (e.target.files?.[0]) await handleImage(e.target.files[0]);
    e.target.value = '';
  });

  btnExport?.addEventListener('click', exportCSV);
  btnClear?.addEventListener('click', () => {
    if (resultsBody) resultsBody.innerHTML = '';
    if (mobileHistory) mobileHistory.innerHTML = '';
    setStatus('', 'Lista limpa localmente.');
  });

  // Actions table
  resultsBody?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button.action-btn');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.dataset?.id;
    if (!id) return;

    if (btn.classList.contains('edit')) {
      await editRow(tr, id);
    } else if (btn.classList.contains('delete')) {
      await deleteRow(tr, id);
    }
  });
}

/* =========================
   OCR → PARSE → SAVE
   ========================= */
async function handleImage(file, { fromCamera=false } = {}){
  try {
    loading(isMobile ? 'A processar…' : 'A processar imagem…');
    toggleMobileLoader(true);

    const { text, uploadedUrl } = await ocrProxy(file);
    if (!text || !text.trim()) throw new Error('OCR sem texto');

    const ocrText = text;
    const eurocode = detectEurocodeFromText(ocrText) || null;
    const brand    = detectBrandFromText(ocrText) || null;

    if (!eurocode) warn('Não encontrei Eurocode nesta imagem.');
    if (!brand)    warn('Não encontrei Marca.');

    const loja = null;   // ajusta se tiveres contexto
    const user_id = null;

    const payload = {
      image_url: uploadedUrl || null,
      eurocode,
      brand,
      loja,
      user_id,
      raw_text: ocrText
    };

    const saved = await saveRecord(payload);
    if (isMobile) {
      prependMobileItem(saved);
    } else {
      prependRow(saved);
    }
    ok('Registo guardado.');
  } catch (err) {
    error('Falha a processar a imagem: ' + (err?.message || err));
    console.error(err);
  } finally {
    toggleMobileLoader(false);
    loading('');
  }
}

function toggleMobileLoader(show){
  if (!mobileProgress) return;
  mobileProgress.classList.toggle('hidden', !show);
}

async function ocrProxy(file){
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(OCR_ENDPOINT, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('OCR endpoint falhou ('+res.status+')');
  const j = await res.json();
  const text = j.text || j.ocrText || j.data || '';
  const uploadedUrl = j.uploadedUrl || j.url || j.image_url || null;
  return { text, uploadedUrl };
}

async function saveRecord(data){
  const res = await fetch(SAVE_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('save-ocr falhou ('+res.status+')');
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || 'save-ocr não OK');
  return j.item;
}

/* =========================
   LIST / RENDER
   ========================= */
async function fetchList(){
  try{
    loading('A carregar registos…');
    const res = await fetch(LIST_URL);
    if (!res.ok) throw new Error('list-ocr falhou ('+res.status+')');
    const j = await res.json();
    const rows = j.items || j.rows || [];

    if (isMobile) {
      mobileHistory.innerHTML = '';
      for (const row of rows.slice(0,50)) appendMobileItem(row);
    } else {
      resultsBody.innerHTML = '';
      for (const row of rows) appendRow(row);
    }
    ok('Lista carregada.');
  } catch(err){
    error('Erro a carregar lista: ' + (err?.message || err));
    console.error(err);
  } finally {
    loading('');
  }
}

/* ===== Desktop table render ===== */
function appendRow(row){ resultsBody.appendChild(buildRow(row)); }
function prependRow(row){ resultsBody.insertBefore(buildRow(row), resultsBody.firstChild); }

function buildRow(row){
  const tr = document.createElement('tr');
  tr.dataset.id = row.id;

  const tdDate = document.createElement('td');
  tdDate.className = 'col-date';
  tdDate.textContent = formatDate(row.created_at);
  tr.appendChild(tdDate);

  const tdEuro = document.createElement('td');
  tdEuro.className = 'col-eurocode';
  tdEuro.textContent = row.eurocode || '—';
  tr.appendChild(tdEuro);

  const tdBrand = document.createElement('td');
  tdBrand.className = 'col-brand';
  tdBrand.textContent = row.brand || '—';
  tr.appendChild(tdBrand);

  const tdLoja = document.createElement('td');
  tdLoja.className = 'col-loja';
  tdLoja.textContent = row.loja || '—';
  tr.appendChild(tdLoja);

  const tdActions = document.createElement('td');
  tdActions.className = 'actions-col';
  tdActions.innerHTML = `
    <div style="display:flex; justify-content:flex-end;">
      <button class="action-btn edit" title="Editar" aria-label="Editar">✎</button>
      <button class="action-btn delete" title="Eliminar" aria-label="Eliminar">🗑️</button>
    </div>
  `;
  tr.appendChild(tdActions);

  return tr;
}

/* ===== Mobile history render ===== */
function appendMobileItem(row){
  const li = buildMobileItem(row);
  mobileHistory.appendChild(li);
}
function prependMobileItem(row){
  const li = buildMobileItem(row);
  mobileHistory.insertBefore(li, mobileHistory.firstChild);
}
function buildMobileItem(row){
  const li = document.createElement('li');
  const left = document.createElement('div');
  const right = document.createElement('div');

  left.innerHTML = `
    <div class="code">${row.eurocode || '—'}</div>
    <div class="brand">${row.brand ? `Marca: ${row.brand}` : 'Marca: —'}</div>
  `;
  right.textContent = '✔️';
  li.appendChild(left);
  li.appendChild(right);
  return li;
}

/* =========================
   EDIT / DELETE (desktop)
   ========================= */
async function editRow(tr, id){
  try{
    const curEuro = tr.querySelector('.col-eurocode')?.textContent || '';
    const curBrand = tr.querySelector('.col-brand')?.textContent || '';

    const eurocode = window.prompt('Editar Eurocode:', curEuro) ?? curEuro;
    const brand    = window.prompt('Editar Marca:', curBrand) ?? curBrand;

    const res = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id, eurocode: eurocode || null, brand: brand || null })
    });
    if (!res.ok) throw new Error('update-ocr falhou ('+res.status+')');
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'update-ocr não OK');

    const row = j.item || {};
    tr.replaceWith(buildRow(row));
    ok('Registo atualizado.');
  } catch(err){
    error('Erro ao atualizar: ' + (err?.message || err));
  }
}

async function deleteRow(tr, id){
  try{
    if (!confirm('Eliminar este registo?')) return;
    const res = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id })
    });
    if (!res.ok) throw new Error('delete-ocr falhou ('+res.status+')');
    const j = await res.json();
    if (j.ok === false) throw new Error(j.error || 'delete-ocr não OK');
    tr.remove();
    ok('Registo eliminado.');
  } catch(err){
    error('Erro ao eliminar: ' + (err?.message || err));
  }
}

/* =========================
   EUROCODE DETECTION
   (4 dígitos + 2 a 9 chars)
   ========================= */
function detectEurocodeFromText(raw){
  if (!raw) return null;
  const text = String(raw).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const rx = /\b(\d{4}[A-Z0-9]{2,9})\b/g;
  let match, best = null;
  while ((match = rx.exec(text)) !== null){
    const token = match[1];
    if (/^\d{4}[A-Z0-9]{2,9}$/.test(token)){
      best = token; break;
    }
  }
  return best;
}

/* =========================
   BRAND DETECTION
   ========================= */
function normBrandText(s){
  return String(s || "")
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .replace(/O/g,'0')
    .replace(/I/g,'1')
    .trim();
}

const BRAND_PATTERNS = [
  { canon: "AGC",                  rx: /\bA[GC]C\b|\bAG0\b|\bASAHI\b/ },
  { canon: "Pilkington",           rx: /\bPILK[1I]NGT[0O]N\b|\bPILKINGTON\b/ },
  { canon: "Saint-Gobain Sekurit", rx: /\bSEKURIT\b|\bSAINT\s*G[0O]BA[1I]N\b/ },
  { canon: "Guardian",             rx: /\bGUARD[1I]AN\b/ },
  { canon: "Fuyao (FYG/FUYAO)",    rx: /\bFUYAO\b|\bFYG\b/ },
  { canon: "XYG",                  rx: /\bXYG\b/ },
  { canon: "NordGlass",            rx: /\bN[0O]RDGLASS\b|\bNORDGLASS\b/ },
  { canon: "Splintex",             rx: /\bSPL[1I]NTEX\b|\bSPLINTEX\b/ },
  { canon: "Sicursiv",             rx: /\bSICURSIV\b/ },
  { canon: "Carlite",              rx: /\bCARL[1I]TE\b/ },
  { canon: "PPG",                  rx: /\bPPG\b/ },
  { canon: "Mopar",                rx: /\bMOPAR\b/ },
  { canon: "Shatterprufe",         rx: /\bSHATTERPRUFE\b/ },
  { canon: "Protec",               rx: /\bPROTEC\b/ },
  { canon: "Lamilex",              rx: /\bLAMI[1I]LEX\b/ },
  { canon: "Vitro",                rx: /\bVITR[0O]\b|\bVITRO\b/ },
  { canon: "Toyota (OEM)",         rx: /\bTOYOTA\b|\bTOY0TA\b/ },
  { canon: "Ford (Carlite)",       rx: /\bFORD\b/ },
  { canon: "GM",                   rx: /\bGENERAL\s*MOTORS\b|\bGM\b/ },
  { canon: "VW (OEM)",             rx: /\bVOLKSWAGEN\b|\bVW\b/ },
  { canon: "Hyundai (OEM)",        rx: /\bHYUNDAI\b/ },
  { canon: "Kia (OEM)",            rx: /\bKIA\b/ },
];

function detectBrandFromText(rawText){
  const text = normBrandText(rawText);
  for (const {canon, rx} of BRAND_PATTERNS){
    if (rx.test(text)) return canon;
  }
  // fallback leve
  const candidates = Array.from(new Set(text.split(' '))).filter(w => w.length>=4 && w.length<=12);
  const targets = ["PILKINGTON","SEKURIT","AGC","ASAHI","FUYAO","FYG","GUARDIAN","NORDGLASS","SPLINTEX","XYG","SICURSIV","CARLITE","MOPAR","VITRO","PPG","PROTEC","LAMILEX","VOLKSWAGEN","TOYOTA","HYUNDAI","KIA","FORD","GENERAL","MOTORS","VW","GM"];
  let best = {canon:null, dist:3};
  for (const w of candidates){
    for (const t of targets){
      const d = editDistance(w, t);
      if (d < best.dist){
        best = {canon:guessCanonFromToken(t), dist:d};
      }
    }
  }
  return best.canon;
}

function editDistance(a,b){
  a=String(a); b=String(b);
  const dp = Array(a.length+1).fill(null).map(()=>Array(b.length+1).fill(0));
  for (let i=0;i<=a.length;i++) dp[i][0]=i;
  for (let j=0;j<=b.length;j++) dp[0][j]=j;
  for (let i=1;i<=a.length;i++){
    for (let j=1;j<=b.length;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[a.length][b.length];
}

function guessCanonFromToken(t){
  t = String(t).toUpperCase();
  if (t.includes('PILK')) return "Pilkington";
  if (t.includes('SEKURIT') || t.includes('SAINT')) return "Saint-Gobain Sekurit";
  if (t.includes('AGC') || t.includes('ASAHI')) return "AGC";
  if (t.includes('FUYAO') || t.includes('FYG')) return "Fuyao (FYG/FUYAO)";
  if (t.includes('GUARD')) return "Guardian";
  if (t.includes('NORD')) return "NordGlass";
  if (t.includes('SPLINTEX')) return "Splintex";
  if (t.includes('XYG')) return "XYG";
  if (t.includes('SICURSIV')) return "Sicursiv";
  if (t.includes('CARLITE')) return "Carlite";
  if (t.includes('MOPAR')) return "Mopar";
  if (t.includes('VITRO')) return "Vitro";
  if (t === 'VW' || t.includes('VOLKSWAGEN')) return "VW (OEM)";
  if (t === 'GM' || t.includes('GENERAL') || t.includes('MOTORS')) return "GM";
  if (t.includes('TOYOTA')) return "Toyota (OEM)";
  if (t.includes('HYUNDAI')) return "Hyundai (OEM)";
  if (t.includes('KIA')) return "Kia (OEM)";
  if (t.includes('FORD')) return "Ford (Carlite)";
  return null;
}

/* =========================
   FEEDBACK UI
   ========================= */
function loading(msg){ setStatus(msg, ''); }
function ok(msg){ setStatus('', msg); }
function warn(msg){ setStatus('', '⚠️ ' + msg); }
function error(msg){ setStatus('', '❌ ' + msg); }
function setStatus(loadingMsg='', infoMsg=''){
  if (isMobile) {
    if (loadingMsg) { mobileStatus.textContent = loadingMsg; }
    else if (infoMsg) { mobileStatus.textContent = infoMsg; }
  } else {
    desktopStatus.textContent = loadingMsg || infoMsg || '';
  }
}

/* =========================
   EXPORT CSV (desktop)
   ========================= */
function exportCSV(){
  const rows = Array.from(resultsBody.querySelectorAll('tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return [
      tds[0]?.textContent?.trim() || '',
      tds[1]?.textContent?.trim() || '',
      tds[2]?.textContent?.trim() || '',
      tds[3]?.textContent?.trim() || ''
    ];
  });
  const header = ['Data','Eurocode','Marca','Loja'];
  const csv = [header, ...rows].map(r => r.map(v => `"${(v||'').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ocr_results.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   HELPERS
   ========================= */
function formatDate(s){
  if (!s) return '—';
  try {
    const d = new Date(s);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  } catch { return '—'; }
}