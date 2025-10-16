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
  
  // Se for SERVIÇO, pedir matrícula
  if (motivo === 'SERVIÇO') {
    console.log('🚗 Motivo é SERVIÇO, pedindo matrícula...');
    pedirMatriculaParaServico(saidaRecordId, motivo);
    return; // Não continua aqui, a função pedirMatriculaParaServico vai processar
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

// Função para pedir matrícula quando motivo é SERVIÇO
function pedirMatriculaParaServico(recordId, motivo) {
  console.log('🚗 Pedindo matrícula para serviço...');
  
  // Fechar modal de saída
  closeSaidaModal();
  
  // Criar modal de matrícula
  const modalHTML = `
    <div id="matriculaModal" class="modal show" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
      <div class="modal-content" style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="font-size: 48px; margin-bottom: 15px;">🚗</div>
          <h2 style="margin: 0; color: #1e293b; font-size: 24px;">Matrícula do Serviço</h2>
          <p style="color: #64748b; margin-top: 10px; font-size: 14px;">Insira a matrícula do veículo</p>
        </div>
        
        <div style="margin-bottom: 25px;">
          <input 
            type="text" 
            id="matriculaInput" 
            placeholder="XX-XX-XX" 
            maxlength="10"
            style="width: 100%; padding: 15px; font-size: 20px; font-family: 'Courier New', monospace; font-weight: bold; text-align: center; border: 3px solid #3b82f6; border-radius: 10px; text-transform: uppercase;"
            autocomplete="off"
          />
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button 
            onclick="cancelarMatricula()" 
            style="flex: 1; padding: 15px; background: #e2e8f0; color: #475569; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer;"
          >
            Cancelar
          </button>
          <button 
            onclick="confirmarMatricula(${recordId}, '${motivo}')" 
            style="flex: 1; padding: 15px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Adicionar modal ao body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Focar no input
  setTimeout(() => {
    const input = document.getElementById('matriculaInput');
    if (input) {
      input.focus();
      
      // Formatar matrícula enquanto digita
      input.addEventListener('input', function(e) {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Formato XX-XX-XX
        if (value.length > 2 && value.length <= 4) {
          value = value.slice(0, 2) + '-' + value.slice(2);
        } else if (value.length > 4) {
          value = value.slice(0, 2) + '-' + value.slice(2, 4) + '-' + value.slice(4, 6);
        }
        
        e.target.value = value;
      });
      
      // Enter para confirmar
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          confirmarMatricula(recordId, motivo);
        }
      });
    }
  }, 100);
}

// Cancelar modal de matrícula
function cancelarMatricula() {
  const modal = document.getElementById('matriculaModal');
  if (modal) {
    modal.remove();
  }
}

// Confirmar matrícula e atualizar registo
async function confirmarMatricula(recordId, motivo) {
  const input = document.getElementById('matriculaInput');
  const matricula = input ? input.value.trim() : '';
  
  if (!matricula) {
    alert('Por favor, insira uma matrícula');
    return;
  }
  
  // Validar formato (pelo menos XX-XX)
  if (matricula.length < 5 || !matricula.includes('-')) {
    alert('Formato de matrícula inválido. Use XX-XX-XX');
    return;
  }
  
  console.log('🚗 Matrícula confirmada:', matricula);
  
  try {
    // Atualizar OBS e MATRÍCULA na base de dados
    const UPDATE_URL = '/.netlify/functions/update-ocr';
    const token = localStorage.getItem('authToken');
    
    const requestBody = { 
      id: recordId,
      observacoes: motivo,
      matricula: matricula
    };
    
    console.log('📦 Atualizando com matrícula:', requestBody);
    
    const response = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Registo atualizado com matrícula:', result);
    
    // Fechar modal de matrícula
    cancelarMatricula();
    
    // Mostrar mensagem de sucesso
    if (typeof showToast === 'function') {
      showToast(`✅ Saída registada: ${motivo} - ${matricula}`, 'success');
    }
    
    // Recarregar dados
    if (typeof loadResults === 'function') {
      await loadResults();
    } else if (typeof loadData === 'function') {
      await loadData();
    }
    
  } catch (error) {
    console.error('❌ Erro ao confirmar matrícula:', error);
    alert('Erro ao registar saída: ' + error.message);
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

