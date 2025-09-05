// ====== Seletores comuns ======
const viewBadge = document.getElementById('viewBadge');

// Mobile
const btnCamera    = document.getElementById('btnCamera');
const cameraInput  = document.getElementById('cameraInput');
const mobileStatus = document.getElementById('mobileStatus');
const historyList  = document.getElementById('mobileHistoryList');

// Desktop (existem no HTML mas não são foco desta alteração)
const btnUpload = document.getElementById('btnUpload');
const fileInput = document.getElementById('fileInput');

// Toast
const toastEl = document.getElementById('toast');

// ====== Estado ======
let EUROCODE_HISTORY = []; // só strings (e.g. "1234ABCDEF")

// ====== Utilidades ======
function showToast(msg, type = 'info') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = 'toast'; // reset
  if (type === 'success') toastEl.classList.add('success');
  if (type === 'error') toastEl.classList.add('error');
  // força reflow para reiniciar a animação
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  setTimeout(() => { toastEl.className = 'toast'; }, 2200);
}

function setStatus(el, text, mode = 'normal') {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('error', 'success');
  if (mode === 'error') el.classList.add('error');
  if (mode === 'success') el.classList.add('success');
}

function isMobileView() {
  return window.matchMedia('(max-width: 899px)').matches;
}

function updateViewBadge() {
  if (!viewBadge) return;
  viewBadge.textContent = isMobileView() ? 'Mobile' : 'Desktop';
}
updateViewBadge();
window.addEventListener('resize', updateViewBadge);

// ====== Render da lista de Eurocodes no mobile ======
function renderEurocodeHistory() {
  if (!historyList) return;

  if (!EUROCODE_HISTORY.length) {
    historyList.innerHTML = '<p class="history-empty">Ainda não há Eurocodes guardados.</p>';
    return;
  }

  const ul = document.createElement('ul');
  EUROCODE_HISTORY.forEach(code => {
    const li = document.createElement('li');
    li.textContent = code;
    ul.appendChild(li);
  });

  historyList.innerHTML = '';
  historyList.appendChild(ul);
}

// ====== Extração de Eurocode ======
// 4 dígitos + 2 a 9 caracteres alfanuméricos
const EUROCODE_REGEX = /\b\d{4}[A-Za-z0-9]{2,9}\b/g;

function extractEurocode(text) {
  if (!text) return null;
  const matches = text.match(EUROCODE_REGEX);
  return (matches && matches[0]) || null; // primeiro válido
}

// ====== Fetch robusto ao OCR (tenta /api e depois /.netlify/functions) ======
async function callOCR(payload) {
  const endpoints = ['/api/ocr-proxy', '/.netlify/functions/ocr-proxy'];
  let lastErr;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text(); // lê como texto para conseguir ver erro do backend
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} em ${endpoint}: ${text.slice(0,200)}`);
        continue;
      }
      // tenta parse de JSON; se não der, assume texto simples
      let data;
      try { data = JSON.parse(text); } catch { data = { text }; }
      const fullText = data.text || data.fullText || data.raw || '';
      return fullText;
    } catch (e) {
      lastErr = e;
      // tenta o próximo endpoint
    }
  }
  throw lastErr || new Error('Falha ao contactar o OCR');
}

// Converte ficheiro -> base64 e chama OCR
async function runOCRFromFile(file) {
  const buf = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mime = file.type || 'image/png';
  const imageBase64 = `data:${mime};base64,${base64}`;
  return callOCR({ imageBase64 });
}

// ====== Fluxo Mobile ======
if (btnCamera && cameraInput) {
  btnCamera.addEventListener('click', () => cameraInput.click());

  cameraInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      setStatus(mobileStatus, '⏳ A processar a imagem…');
      const text = await runOCRFromFile(f);

      const euro = extractEurocode(text);
      if (!euro) {
        setStatus(mobileStatus, '⚠️ Sem Eurocode válido. Não foi guardado.', 'error');
        showToast('Sem Eurocode — nada guardado.', 'error');
        return;
      }

      if (EUROCODE_HISTORY[0] !== euro) EUROCODE_HISTORY.unshift(euro);
      if (EUROCODE_HISTORY.length > 50) EUROCODE_HISTORY = EUROCODE_HISTORY.slice(0, 50);

      renderEurocodeHistory();
      setStatus(mobileStatus, `✅ Guardado: ${euro}`, 'success');
      showToast(`Eurocode guardado: ${euro}`, 'success');

      // aqui é o ponto para persistir em Neon, se quiseres
    } catch (err) {
      console.error(err);
      setStatus(mobileStatus, `❌ Erro a processar a imagem. ${err?.message || ''}`, 'error');
      showToast('Erro no OCR.', 'error');
    } finally {
      cameraInput.value = '';
    }
  });
}

// ====== Desktop (opcional) ======
if (btnUpload && fileInput) {
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const el = document.getElementById('desktopStatus');
      setStatus(el, '⏳ A processar…');
      const text = await runOCRFromFile(f);
      const euro = extractEurocode(text);
      if (!euro) {
        setStatus(el, '⚠️ Sem Eurocode válido. Não foi guardado.', 'error');
        showToast('Sem Eurocode — nada guardado.', 'error');
        return;
      }
      if (EUROCODE_HISTORY[0] !== euro) EUROCODE_HISTORY.unshift(euro);
      if (EUROCODE_HISTORY.length > 50) EUROCODE_HISTORY = EUROCODE_HISTORY.slice(0, 50);
      renderEurocodeHistory();
      setStatus(el, `✅ Guardado: ${euro}`, 'success');
      showToast(`Eurocode guardado: ${euro}`, 'success');
    } catch (err) {
      const el = document.getElementById('desktopStatus');
      console.error(err);
      setStatus(el, `❌ Erro no OCR. ${err?.message || ''}`, 'error');
      showToast('Erro no OCR.', 'error');
    } finally {
      fileInput.value = '';
    }
  });
}

// Render inicial
renderEurocodeHistory();