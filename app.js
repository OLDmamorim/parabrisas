// =========================
// Histórico Mobile — Eurocodes da BD
// =========================
function renderMobileEuroList(){
  if (!mobileHistoryList) return;
  if (!RESULTS.length){
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há Eurocodes guardados.</p>';
    return;
  }

  const codes = RESULTS
    .map(r => (r.eurocode || '').toString().trim())
    .filter(Boolean);

  if (!codes.length){
    mobileHistoryList.innerHTML = '<p class="history-empty">Ainda não há Eurocodes guardados.</p>';
    return;
  }

  // pega só nas últimas 5 capturas (mais recentes primeiro)
  const last5 = codes.slice(-5).reverse();

  const frag = document.createDocumentFragment();
  last5.forEach(c => {
    const div = document.createElement('div');
    div.className = 'history-item-text';
    div.textContent = c.split(/\s+/)[0]; // só o código
    frag.appendChild(div);
  });

  mobileHistoryList.innerHTML = '';
  mobileHistoryList.appendChild(frag);
}