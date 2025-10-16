// ===== MODAL DE SAÍDA DE STOCK =====

let saidaRecordId = null;
let saidaEurocode = null;

// Abrir modal de saída
function openSaidaModal(recordId, eurocode) {
  console.log('Abrir modal de saída:', recordId, eurocode);
  
  saidaRecordId = recordId;
  saidaEurocode = eurocode;
  
  // Atualizar eurocode no modal
  const eurocodeElement = document.getElementById('saidaEurocode');
  if (eurocodeElement) {
    eurocodeElement.textContent = eurocode || '—';
  }
  
  // Limpar campos
  document.getElementById('saidaMotivo').value = '';
  document.getElementById('saidaObservacoes').value = '';
  
  // Mostrar modal
  const modal = document.getElementById('saidaModal');
  if (modal) {
    modal.classList.add('show');
  }
}

// Fechar modal de saída
function closeSaidaModal() {
  const modal = document.getElementById('saidaModal');
  if (modal) {
    modal.classList.remove('show');
  }
  
  // Limpar variáveis
  saidaRecordId = null;
  saidaEurocode = null;
}

// Confirmar saída
async function confirmarSaida() {
  const motivo = document.getElementById('saidaMotivo').value;
  const observacoes = document.getElementById('saidaObservacoes').value;
  
  // Validar motivo
  if (!motivo) {
    alert('Por favor, seleciona um motivo para a saída.');
    return;
  }
  
  // Confirmar ação
  const confirmMsg = `Tens a certeza que queres dar saída a este vidro?\n\nEurocode: ${saidaEurocode}\nMotivo: ${motivo}\n\n⚠️ Esta ação é PERMANENTE e não pode ser revertida!`;
  
  if (!confirm(confirmMsg)) {
    return;
  }
  
  try {
    // Desabilitar botão
    const btnConfirm = document.querySelector('.saida-btn-confirm');
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.textContent = '⏳ A processar...';
    }
    
    // Apagar da base de dados usando Netlify Function
    const DELETE_URL = '/.netlify/functions/delete-ocr';
    const response = await fetch(DELETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: saidaRecordId })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Erro ao dar saída');
    }
    
    // Sucesso!
    console.log('Saída registada com sucesso!');
    
    // Fechar modal
    closeSaidaModal();
    
    // Mostrar mensagem de sucesso
    if (typeof showToast === 'function') {
      showToast('✅ Saída registada com sucesso!', 'success');
    }
    
    // Recarregar dados
    if (typeof loadResults === 'function') {
      await loadResults();
    } else if (typeof loadData === 'function') {
      await loadData();
    }
    
  } catch (error) {
    console.error('Erro ao dar saída:', error);
    alert('Erro ao dar saída: ' + error.message);
    
    // Reabilitar botão
    const btnConfirm = document.querySelector('.saida-btn-confirm');
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = '📤 Confirmar Saída';
    }
  }
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(event) {
  const modal = document.getElementById('saidaModal');
  if (modal && event.target === modal) {
    closeSaidaModal();
  }
});

// Fechar modal com ESC
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('saidaModal');
    if (modal && modal.classList.contains('show')) {
      closeSaidaModal();
    }
  }
});

console.log('Modal de saída carregado');

