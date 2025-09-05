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

// ====== Estado em memória (sessão) ======
let EUROCODE_HISTORY = []; // só strings (e.g. "1234ABCDEF")

// ====== Utilidades ======
function showToast(msg, type = 'info') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('show', 'success', 'error');
  if (type === 'success') toastEl.classList.add('success');
  if (type === 'error') toastEl.classList.add('error');
  // força reflow para reiniciar a animação
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show', 'success', 'error'), 2200);
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
// Regra que combinámos: 4 dígitos + 2 a 9 caracteres alfanuméricos
const EUROCODE_REGEX = /\b\d{4}[A-Za-z0-9]{2,9}\b/g;

function extractEurocode(text) {
  if (!text) return null;
  const matches = text.match(EUROCODE_REGEX);
  return (matches && matches[0]) || null; // devolve o primeiro válido
}

// ====== Chamada ao teu endpoint de OCR ======
async function runOCRFromFile(file) {
  // Converte para base64 data URL
  const buf = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const mime = file.type || 'image/png';
  const imageBase64 = `data:${mime};base64,${base64}`;

  // Ajusta o endpoint conforme o teu backend
  const endpoint = '/.netlify/functions/ocr-proxy';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  // Espera-se algo como { text: "....", ... }
  const data = await res.json();
  // Tenta ler `text`, `fullText` ou `raw` de forma resiliente
  const fullText = data.text || data.fullText || data.raw || '';
  return fullText;
}

// ====== Fluxo Mobile: botão de câmara ======
if (btnCamera && cameraInput) {
  btnCamera.addEventListener('click', () => {
    cameraInput.click();
  });

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

      // Guarda na lista (sem duplicados consecutivos para ficar limpo)
      if (EUROCODE_HISTORY[0] !== euro) {
        EUROCODE_HISTORY.unshift(euro);
      }
      // Limite opcional às últimas 50
      if (EUROCODE_HISTORY.length > 50) EUROCODE_HISTORY = EUROCODE_HISTORY.slice(0, 50);

      renderEurocodeHistory();
      setStatus(mobileStatus, `✅ Guardado: ${euro}`, 'success');
      showToast(`Eurocode guardado: ${euro}`, 'success');

      // Se no futuro quiseres persistir em Neon, aqui é o ponto para fazer o fetch POST.

    } catch (err) {
      console.error(err);
      setStatus(mobileStatus, '❌ Erro a processar a imagem.', 'error');
      showToast('Erro no OCR.', 'error');
    } finally {
      // limpa o input para permitir tirar a mesma foto outra vez se precisares
      cameraInput.value = '';
    }
  });
}

// ====== Desktop (opcional): permitir upload e processar igual ======
if (btnUpload && fileInput) {
  btnUpload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setStatus(document.getElementById('desktopStatus'), '⏳ A processar…');
      const text = await runOCRFromFile(f);
      const euro = extractEurocode(text);
      if (!euro) {
        setStatus(document.getElementById('desktopStatus'), '⚠️ Sem Eurocode válido. Não foi guardado.', 'error');
        showToast('Sem Eurocode — nada guardado.', 'error');
        return;
      }
      if (EUROCODE_HISTORY[0] !== euro) EUROCODE_HISTORY.unshift(euro);
      if (EUROCODE_HISTORY.length > 50) EUROCODE_HISTORY = EUROCODE_HISTORY.slice(0, 50);
      renderEurocodeHistory();
      setStatus(document.getElementById('desktopStatus'), `✅ Guardado: ${euro}`, 'success');
      showToast(`Eurocode guardado: ${euro}`, 'success');
    } catch (err) {
      console.error(err);
      setStatus(document.getElementById('desktopStatus'), '❌ Erro no OCR.', 'error');
      showToast('Erro no OCR.', 'error');
    } finally {
      fileInput.value = '';
    }
  });
}

// Render inicial
renderEurocodeHistory();