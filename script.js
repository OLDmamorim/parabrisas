// Toggle do switch e modal de ajuda
const switchBtn = document.getElementById('switchBtn');
const helpBtn   = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelp = document.getElementById('closeHelp');

switchBtn?.addEventListener('click', () => switchBtn.classList.toggle('on'));
helpBtn?.addEventListener('click', () => helpModal.showModal());
closeHelp?.addEventListener('click', () => helpModal.close());

// Placeholder da câmara (liga aqui a tua captura/OCR quando quiseres)
document.getElementById('cameraBtn')?.addEventListener('click', () => {
  console.log('Capturar…');
});