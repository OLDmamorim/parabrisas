// =========================
// ADICIONAR ESTA FUNÇÃO NOVA ANTES DA saveToDatabase
// =========================

// Dar saída de vidro (remover do stock)
async function darSaidaVidro(text, eurocode, filename, source, vehicle) {
  try {
    // Adicionar # ao eurocode se for COMPLEMENTAR
    let finalEurocode = eurocode;
    if (window.tipoVidroSelecionado === 'complementar' && eurocode && !eurocode.startsWith('#')) {
      finalEurocode = '#' + eurocode;
    }
    
    setStatus(desktopStatus, 'A procurar vidro para dar saída...');
    setStatus(mobileStatus,  'A procurar vidro para dar saída...');
    
    // Procurar o registo com este eurocode
    const registoParaRemover = RESULTS.find(r => r.eurocode === finalEurocode);
    
    if (!registoParaRemover) {
      showToast(`❌ Eurocode ${finalEurocode} não encontrado no stock!`, 'error');
      setStatus(desktopStatus, 'Eurocode não encontrado!', 'error');
      setStatus(mobileStatus,  'Eurocode não encontrado!', 'error');
      return;
    }
    
    // Remover da base de dados
    const response = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: registoParaRemover.id })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao dar saída');
    }
    
    showToast(`✅ Saída registada: ${finalEurocode}`, 'success');
    setStatus(desktopStatus, 'Saída registada com sucesso!', 'success');
    setStatus(mobileStatus,  'Saída registada com sucesso!', 'success');
    await loadResults();
    
  } catch (error) {
    console.error('Erro ao dar saída:', error);
    showToast('Erro ao dar saída: ' + error.message, 'error');
    setStatus(desktopStatus, 'Erro ao dar saída', 'error');
    setStatus(mobileStatus,  'Erro ao dar saída', 'error');
  }
}

// =========================
// MODIFICAR A FUNÇÃO showEurocodeValidationModal
// Trocar a linha 246 de:
//   saveToDatabase(ocrText, selectedCode, filename, source, vehicle);
// Para:
//   const isModoSaida = document.body.classList.contains('modo-saida');
//   if (isModoSaida) {
//     darSaidaVidro(ocrText, selectedCode, filename, source, vehicle);
//   } else {
//     saveToDatabase(ocrText, selectedCode, filename, source, vehicle);
//   }
// =========================

// =========================
// MODIFICAR A FUNÇÃO saveManualEntry
// Adicionar verificação de modo saída no início:
//   const isModoSaida = document.body.classList.contains('modo-saida');
//   if (isModoSaida) {
//     // Chamar darSaidaVidro em vez de SAVE_URL
//   }
// =========================

