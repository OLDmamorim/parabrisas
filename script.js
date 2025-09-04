// Elementos principais
const btnMain = document.querySelector('.btn-main');
const fabExport = document.querySelector('.fab-export');
const cardsCaptures = document.getElementById('cardsCaptures');
const emptyState = document.getElementById('emptyState');

// Estado da app
let captures = []; // Exemplo [{dateTime, imgSrc, ocrText}]

// Simulação de captura (substituir pelo real)
btnMain.addEventListener('click', async () => {
  // Aqui faria upload/captura. Simulação para teste visual.
  const now = new Date();
  const data = {
    dateTime: now.toLocaleString(),
    imgSrc: 'https://via.placeholder.com/70x70?text=ETQ', // Ou preview real
    ocrText: 'Texto exemplo de código e descrição'
  };
  captures.unshift(data); // Mais recente primeiro
  renderCaptures();
});

// Renderização dos cards de captura
function renderCaptures() {
  if (captures.length === 0) {
    emptyState.style.display = '';
    cardsCaptures.innerHTML = '';
    return;
  }
  emptyState.style.display = 'none';
  cardsCaptures.innerHTML = captures.map((cap, i) => `
    <div class="card capture">
      <span class="date-time">${cap.dateTime}</span>
      <img src="${cap.imgSrc}" class="capture-img" alt="Etiqueta capturada">
      <p class="ocr-text">Texto lido: ${cap.ocrText}</p>
      <div class="actions">
        <button class="btn-edit" title="Editar"><span class="icon-edit"></span></button>
        <button class="btn-delete" title="Eliminar" onclick="deleteCapture(${i})"><span class="icon-delete"></span></button>
      </div>
    </div>
  `).join('');
}

// Eliminação de captura
function deleteCapture(idx) {
  captures.splice(idx, 1);
  renderCaptures();
}

// Exportação CSV (simples para mobile)
fabExport.addEventListener('click', () => {
  if (captures.length === 0) return alert('Nenhuma captura disponível para exportar...');
  const csv = captures.map(c => `"${c.dateTime}","${c.ocrText}"`).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'capturas.csv';
  a.click();
});

// Inicialização visual
renderCaptures();
