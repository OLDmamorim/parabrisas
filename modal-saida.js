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

// Confirmar saída com motivo
async function confirmarSaidaComMotivo(motivo) {
  console.log('📦 ===== CONFIRMAR SAÍDA =====');
  console.log('📦 Motivo:', motivo);
  console.log('📦 ID do registo:', saidaRecordId);
  console.log('📦 Eurocode:', saidaEurocode);
  
  if (!saidaRecordId) {
    console.error('❌ ID do registo não definido!');
    alert('Erro: ID do registo não encontrado');
    return;
  }
  
  try {
    // Atualizar OBS na base de dados usando Netlify Function
    const UPDATE_URL = '/.netlify/functions/update-ocr';
    console.log('📦 A enviar pedido UPDATE para:', UPDATE_URL);
    
    const token = localStorage.getItem('authToken');
    console.log('📦 Token existe?', !!token);
    
    const requestBody = { 
      id: saidaRecordId,
      observacoes: motivo
    };
    console.log('📦 Request body:', requestBody);
    
    const response = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📦 Resposta UPDATE:', response.status, response.statusText);
    console.log('📦 Response OK?', response.ok);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Erro na resposta UPDATE:', errorData);
      throw new Error(errorData.error || `Erro HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📦 Resultado UPDATE:', result);
    console.log('📦 Registo atualizado:', result.row);
    
    // Sucesso!
    console.log('✅ Saída registada com sucesso!');
    console.log('✅ OBS atualizado para:', motivo);
    
    // Fechar modal
    closeSaidaModal();
    
    // Mostrar mensagem de sucesso
    if (typeof showToast === 'function') {
      showToast(`✅ Saída registada: ${motivo}`, 'success');
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

