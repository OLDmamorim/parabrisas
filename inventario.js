// ===== INVENTÁRIO JS =====
// Sistema de inventário separado do registo diário

let currentInventarioId = null;
let inventarioAtual = null;
let modoInventario = false;

// Inicializar sistema de inventário
function initInventario() {
  console.log('📊 Inicializando sistema de inventário...');
  
  // Event listeners
  document.getElementById('btnNovoInventario')?.addEventListener('click', criarNovoInventario);
  document.getElementById('btnVoltarLista')?.addEventListener('click', voltarParaLista);
  document.getElementById('btnFecharInventario')?.addEventListener('click', fecharInventario);
  
  // Carregar inventários
  carregarInventarios();
}

// Criar novo inventário
async function criarNovoInventario() {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const response = await fetch('/.netlify/functions/create-inventario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        loja: user.loja || 'Desconhecida'
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      showToast('✅ Inventário criado com sucesso!', 'success');
      currentInventarioId = data.inventario.id;
      inventarioAtual = data.inventario;
      modoInventario = true;
      
      // Mostrar vista detalhada
      mostrarInventarioDetalhes(data.inventario);
      
      // Esconder menu mobile se estiver visível
      document.getElementById('mobileMenuInicial')?.classList.remove('active');
      
      // Mostrar interface OCR
      document.getElementById('app')?.classList.remove('hidden');
    } else {
      showToast('❌ Erro ao criar inventário: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Erro ao criar inventário:', error);
    showToast('❌ Erro ao criar inventário', 'error');
  }
}

// Carregar lista de inventários
async function carregarInventarios() {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('/.netlify/functions/list-inventarios', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      renderizarListaInventarios(data.inventarios);
    } else {
      console.error('Erro ao carregar inventários:', data.error);
    }
  } catch (error) {
    console.error('Erro ao carregar inventários:', error);
  }
}

// Renderizar lista de inventários
function renderizarListaInventarios(inventarios) {
  const lista = document.getElementById('inventariosLista');
  if (!lista) return;
  
  if (inventarios.length === 0) {
    lista.innerHTML = `
      <div class="inventario-vazio">
        <div class="inventario-vazio-icon">📊</div>
        <h3>Nenhum inventário criado</h3>
        <p>Clique em "Novo Inventário" para começar</p>
      </div>
    `;
    return;
  }
  
  lista.innerHTML = inventarios.map(inv => {
    const data = new Date(inv.data_inventario);
    const dataFormatada = data.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <div class="inventario-card" onclick="abrirInventario(${inv.id})">
        <div class="inventario-card-header">
          <div class="inventario-card-title">
            📊 Inventário ${dataFormatada}
          </div>
          <div class="inventario-card-status ${inv.status}">
            ${inv.status}
          </div>
        </div>
        <div class="inventario-card-info">
          <span>📦 ${inv.total_items || 0} items</span>
          <span>🏪 ${inv.loja || 'N/A'}</span>
          <span>👤 ${inv.user_email || 'N/A'}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Abrir inventário específico
async function abrirInventario(inventarioId) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/.netlify/functions/get-inventario?id=${inventarioId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      currentInventarioId = inventarioId;
      inventarioAtual = data.inventario;
      modoInventario = true;
      mostrarInventarioDetalhes(data.inventario);
    } else {
      showToast('❌ Erro ao abrir inventário', 'error');
    }
  } catch (error) {
    console.error('Erro ao abrir inventário:', error);
    showToast('❌ Erro ao abrir inventário', 'error');
  }
}

// Mostrar detalhes do inventário
function mostrarInventarioDetalhes(inventario) {
  // Esconder lista
  document.getElementById('inventarioView')?.classList.remove('active');
  
  // Mostrar detalhes
  const detalhes = document.getElementById('inventarioDetalhes');
  if (detalhes) {
    detalhes.classList.add('active');
    
    // Atualizar header
    const data = new Date(inventario.data_inventario);
    const dataFormatada = data.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    document.getElementById('inventarioTitulo').textContent = `Inventário ${dataFormatada}`;
    document.getElementById('inventarioStatus').textContent = inventario.status;
    document.getElementById('inventarioStatus').className = `inventario-card-status ${inventario.status}`;
    document.getElementById('inventarioTotalItems').textContent = `📦 ${inventario.total_items || 0} items`;
    document.getElementById('inventarioLoja').textContent = `🏪 ${inventario.loja || 'N/A'}`;
    
    // Desabilitar botões se fechado
    const isFechado = inventario.status === 'fechado';
    document.getElementById('btnAdicionarItem').disabled = isFechado;
    document.getElementById('btnFecharInventario').disabled = isFechado;
    
    // Carregar items
    carregarInventarioItems(inventario.id);
  }
  
  // Mostrar app (OCR)
  document.getElementById('app')?.classList.remove('hidden');
}

// Carregar items do inventário
async function carregarInventarioItems(inventarioId) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/.netlify/functions/get-inventario-items?inventario_id=${inventarioId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      renderizarInventarioItems(data.items);
    }
  } catch (error) {
    console.error('Erro ao carregar items:', error);
  }
}

// Renderizar items do inventário
function renderizarInventarioItems(items) {
  const tbody = document.querySelector('#inventarioItemsTable tbody');
  if (!tbody) return;
  
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #a0aec0;">
          Nenhum item registado neste inventário
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = items.map(item => `
    <tr>
      <td>${item.hora || ''}</td>
      <td>${item.tipo || ''}</td>
      <td>${item.veiculo || ''}</td>
      <td>${item.eurocode || ''}</td>
      <td>${item.marca || ''}</td>
      <td>${item.matricula || ''}</td>
      <td>${item.sm_loja || ''}</td>
      <td>${item.obs || ''}</td>
    </tr>
  `).join('');
}

// Voltar para lista
function voltarParaLista() {
  // Esconder detalhes
  document.getElementById('inventarioDetalhes')?.classList.remove('active');
  
  // Mostrar lista
  document.getElementById('inventarioView')?.classList.add('active');
  
  // Esconder app
  document.getElementById('app')?.classList.add('hidden');
  
  // Reset modo
  modoInventario = false;
  currentInventarioId = null;
  inventarioAtual = null;
  
  // Recarregar lista
  carregarInventarios();
}

// Fechar inventário
async function fecharInventario() {
  if (!currentInventarioId) return;
  
  if (!confirm('Tem a certeza que deseja fechar este inventário? Não poderá adicionar mais items.')) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('/.netlify/functions/close-inventario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        inventario_id: currentInventarioId
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      showToast('✅ Inventário fechado com sucesso!', 'success');
      voltarParaLista();
    } else {
      showToast('❌ Erro ao fechar inventário', 'error');
    }
  } catch (error) {
    console.error('Erro ao fechar inventário:', error);
    showToast('❌ Erro ao fechar inventário', 'error');
  }
}

// Adicionar item ao inventário (chamado após OCR ou entrada manual)
async function adicionarItemInventario(itemData) {
  if (!currentInventarioId || !modoInventario) {
    console.error('Não está em modo inventário');
    return false;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('/.netlify/functions/add-inventario-item', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        inventario_id: currentInventarioId,
        ...itemData
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      // Recarregar items
      carregarInventarioItems(currentInventarioId);
      
      // Atualizar contador
      if (inventarioAtual) {
        inventarioAtual.total_items = (inventarioAtual.total_items || 0) + 1;
        document.getElementById('inventarioTotalItems').textContent = `📦 ${inventarioAtual.total_items} items`;
      }
      
      return true;
    } else {
      console.error('Erro ao adicionar item:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    return false;
  }
}

// Mostrar vista de inventários
function mostrarVistaInventarios() {
  // Esconder app principal
  document.getElementById('app')?.classList.add('hidden');
  
  // Esconder detalhes
  document.getElementById('inventarioDetalhes')?.classList.remove('active');
  
  // Mostrar lista
  document.getElementById('inventarioView')?.classList.add('active');
  
  // Carregar inventários
  carregarInventarios();
}

// Mostrar vista diária (normal)
function mostrarVistaDiaria() {
  // Mostrar app principal
  document.getElementById('app')?.classList.remove('hidden');
  
  // Esconder inventários
  document.getElementById('inventarioView')?.classList.remove('active');
  document.getElementById('inventarioDetalhes')?.classList.remove('active');
  
  // Reset modo
  modoInventario = false;
  currentInventarioId = null;
  inventarioAtual = null;
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInventario);
} else {
  initInventario();
}

