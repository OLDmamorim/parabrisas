// ===== SISTEMA DE INVENTÁRIO =====
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
    
    const response = await fetch('/.netlify/functions/inventario-api', {
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
      
      // Ativar modo inventário globalmente
      window.modoInventario = true;
      window.currentInventarioId = data.inventario.id;
      
      // Mostrar vista detalhada
      mostrarInventarioDetalhes(data.inventario);
      
      // Esconder menu mobile se estiver visível
      document.getElementById('mobileMenuInicial')?.classList.remove('active');
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
    
    const response = await fetch('/.netlify/functions/inventario-api', {
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
    lista.innerHTML = '<p class="inventario-vazio">Nenhum inventário criado ainda.</p>';
    return;
  }
  
  lista.innerHTML = inventarios.map(inv => `
    <div class="inventario-card" onclick="abrirInventario(${inv.id})">
      <div class="inventario-card-header">
        <h3>📊 Inventário ${new Date(inv.data_inventario).toLocaleDateString('pt-PT')}</h3>
        <span class="inventario-card-status ${inv.status}">${inv.status}</span>
      </div>
      <div class="inventario-card-info">
        <span>📦 ${inv.total_items} items</span>
        <span>🏪 ${inv.loja}</span>
        <span>👤 ${inv.user_email}</span>
      </div>
      <div class="inventario-card-data">
        ${new Date(inv.data_inventario).toLocaleString('pt-PT')}
      </div>
    </div>
  `).join('');
}

// Abrir inventário
async function abrirInventario(inventarioId) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/.netlify/functions/inventario-api/${inventarioId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      currentInventarioId = inventarioId;
      inventarioAtual = data.inventario;
      modoInventario = data.inventario.status === 'aberto';
      
      // Ativar modo inventário globalmente se estiver aberto
      window.modoInventario = modoInventario;
      window.currentInventarioId = inventarioId;
      
      mostrarInventarioDetalhes(data.inventario);
    } else {
      showToast('❌ Erro ao carregar inventário', 'error');
    }
  } catch (error) {
    console.error('Erro ao abrir inventário:', error);
    showToast('❌ Erro ao abrir inventário', 'error');
  }
}

// Mostrar vista detalhada do inventário
function mostrarInventarioDetalhes(inventario) {
  // Esconder lista
  document.getElementById('inventarioView').style.display = 'none';
  
  // Mostrar detalhes
  const detalhes = document.getElementById('inventarioDetalhes');
  detalhes.style.display = 'block';
  
  // Atualizar header
  document.getElementById('inventarioTitulo').textContent = 
    `Inventário ${new Date(inventario.data_inventario).toLocaleDateString('pt-PT')}`;
  document.getElementById('inventarioStatus').textContent = inventario.status;
  document.getElementById('inventarioStatus').className = `inventario-card-status ${inventario.status}`;
  document.getElementById('inventarioTotalItems').textContent = `📦 ${inventario.total_items} items`;
  document.getElementById('inventarioLoja').textContent = `🏪 ${inventario.loja}`;
  
  // Desabilitar botões se fechado
  const btnAdicionar = document.getElementById('btnAdicionarItem');
  const btnFechar = document.getElementById('btnFecharInventario');
  
  if (inventario.status === 'fechado') {
    btnAdicionar.disabled = true;
    btnAdicionar.textContent = '🔒 Inventário Fechado';
    btnFechar.disabled = true;
  } else {
    btnAdicionar.disabled = false;
    btnAdicionar.textContent = '📷 Adicionar Item (OCR)';
    btnFechar.disabled = false;
  }
  
  // Carregar items
  carregarInventarioItems(inventario.id);
}

// Carregar items do inventário
async function carregarInventarioItems(inventarioId) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/.netlify/functions/inventario-api/${inventarioId}/items`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      renderizarTabelaItems(data.items);
    } else {
      console.error('Erro ao carregar items:', data.error);
    }
  } catch (error) {
    console.error('Erro ao carregar items:', error);
  }
}

// Renderizar tabela de items
function renderizarTabelaItems(items) {
  const tbody = document.querySelector('#inventarioItemsTable tbody');
  if (!tbody) return;
  
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Nenhum item registado</td></tr>';
    return;
  }
  
  tbody.innerHTML = items.map(item => `
    <tr>
      <td>${item.hora}</td>
      <td>${item.tipo}</td>
      <td>${item.veiculo}</td>
      <td>${item.eurocode}</td>
      <td>${item.marca}</td>
      <td>${item.matricula}</td>
      <td>${item.sm_loja}</td>
      <td>${item.obs}</td>
    </tr>
  `).join('');
}

// Adicionar item ao inventário
async function adicionarItemInventario(itemData) {
  if (!currentInventarioId) {
    console.error('Nenhum inventário ativo');
    return false;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/.netlify/functions/inventario-api/${currentInventarioId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(itemData)
    });
    
    const data = await response.json();
    
    if (data.ok) {
      // Recarregar items
      carregarInventarioItems(currentInventarioId);
      // Atualizar contador
      if (inventarioAtual) {
        inventarioAtual.total_items++;
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

// Fechar inventário
async function fecharInventario() {
  if (!currentInventarioId) return;
  
  if (!confirm('Tem a certeza que deseja fechar este inventário? Não poderá adicionar mais items.')) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/.netlify/functions/inventario-api/${currentInventarioId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      showToast('✅ Inventário fechado com sucesso!', 'success');
      modoInventario = false;
      window.modoInventario = false;
      
      // Atualizar vista
      inventarioAtual = data.inventario;
      mostrarInventarioDetalhes(data.inventario);
    } else {
      showToast('❌ Erro ao fechar inventário: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Erro ao fechar inventário:', error);
    showToast('❌ Erro ao fechar inventário', 'error');
  }
}

// Voltar para lista
function voltarParaLista() {
  // Esconder detalhes
  document.getElementById('inventarioDetalhes').style.display = 'none';
  
  // Mostrar lista
  document.getElementById('inventarioView').style.display = 'block';
  
  // Desativar modo inventário
  modoInventario = false;
  window.modoInventario = false;
  currentInventarioId = null;
  inventarioAtual = null;
  
  // Recarregar lista
  carregarInventarios();
}

// Mostrar vista de inventários
function mostrarVistaInventarios() {
  // Esconder outras vistas
  document.getElementById('desktopView')?.style.display = 'none';
  document.querySelector('.modern-mobile')?.style.display = 'none';
  document.getElementById('inventarioDetalhes')?.style.display = 'none';
  
  // Mostrar vista de inventários
  const inventarioView = document.getElementById('inventarioView');
  if (inventarioView) {
    inventarioView.style.display = 'block';
    carregarInventarios();
  }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInventario);
} else {
  initInventario();
}

// Expor funções globalmente
window.mostrarVistaInventarios = mostrarVistaInventarios;
window.abrirInventario = abrirInventario;
window.adicionarItemInventario = adicionarItemInventario;

