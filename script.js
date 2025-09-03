// Toggle do switch e modal de ajuda (sem dependências)
const switchBtn = document.getElementById('switchBtn');
const helpBtn   = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelp = document.getElementById('closeHelp');

switchBtn?.addEventListener('click', () => {
  switchBtn.classList.toggle('on');
});

helpBtn?.addEventListener('click', () => helpModal.showModal());
closeHelp?.addEventListener('click', () => helpModal.close());

// Opcional: ação do botão da câmara (placeholder)
document.getElementById('cameraBtn')?.addEventListener('click', () => {
  // aqui integras a tua lógica de captura/OCR quando quiseres
  console.log('Capturar…');
});