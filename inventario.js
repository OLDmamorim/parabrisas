// ===== INVENTÁRIO =====

// Variáveis globais
let inventarioData = [];
let authManager = null;

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Inventário carregado');
  
  // Verificar autenticação
  if (typeof AuthManager !== 'undefined') {
    authManager = new AuthManager();
    const isAuth = await authManager.checkAuth();
    if (!isAuth) return;
    authManager.showUserInfo();
  }
  
  // Carregar dados
  await loadInventario();
});

// Carregar inventário
async function loadInventario() {
  try {
    showLoading();
    
    // Buscar dados da API
    const response = await fetch('/.netlify/functions/get-records');
    
    if (!response.ok) {
      throw new Error('Erro ao carregar dados');
    }
    
    const data = await response.json();
    console.log('Dados recebidos:', data);
    
    // Processar dados
    processarInventario(data);
    
  } catch (error) {
    console.error('Erro ao carregar inventário:', error);
    showError('Erro ao carregar inventário: ' + error.message);
  }
}

// Processar inventário (agrupar por Eurocode)
function processarInventario(records) {
  if (!records || records.length === 0) {
    showEmpty();
    return;
  }
  
  // Agrupar por Eurocode
  const grupos = {};
  
  records.forEach(record => {
    const eurocode = record.eurocode || 'SEM_EUROCODE';
    
    if (!grupos[eurocode]) {
      grupos[eurocode] = {
        eurocode: eurocode,
        vehicle: record.vehicle || '—',
        brand: record.brand || '—',
        quantidade: 0,
        localizacoes: new Set(),
        registos: []
      };
    }
    
    grupos[eurocode].quantidade++;
    if (record.sm_loja) {
      grupos[eurocode].localizacoes.add(record.sm_loja);
    }
    grupos[eurocode].registos.push(record);
  });
  
  // Converter para array
  inventarioData = Object.values(grupos).map(grupo => ({
    ...grupo,
    localizacoes: Array.from(grupo.localizacoes).join(', ') || '—'
  }));
  
  // Ordenar por quantidade (decrescente)
  inventarioData.sort((a, b) => b.quantidade - a.quantidade);
  
  console.log('Inventário processado:', inventarioData);
  
  // Atualizar estatísticas
  updateStats(records, inventarioData);
  
  // Renderizar tabela
  renderTable();
}

// Atualizar estatísticas
function updateStats(records, inventario) {
  // Total de vidros
  document.getElementById('totalVidros').textContent = records.length;
  
  // Eurocodes únicos
  document.getElementById('totalEurocodes').textContent = inventario.length;
  
  // Localizações únicas
  const localizacoes = new Set();
  records.forEach(r => {
    if (r.sm_loja) localizacoes.add(r.sm_loja);
  });
  document.getElementById('totalLocalizacoes').textContent = localizacoes.size || '—';
}

// Renderizar tabela
function renderTable() {
  const tbody = document.getElementById('inventarioTableBody');
  const table = document.getElementById('inventarioTable');
  const loading = document.getElementById('loadingState');
  
  if (!inventarioData || inventarioData.length === 0) {
    showEmpty();
    return;
  }
  
  // Esconder loading
  loading.style.display = 'none';
  table.style.display = 'table';
  
  // Gerar HTML
  tbody.innerHTML = inventarioData.map(item => `
    <tr>
      <td class="eurocode-cell">${item.eurocode}</td>
      <td>${item.vehicle}</td>
      <td>${item.brand}</td>
      <td class="quantidade-cell">${item.quantidade}</td>
      <td>${item.localizacoes}</td>
    </tr>
  `).join('');
}

// Mostrar loading
function showLoading() {
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('inventarioTable').style.display = 'none';
}

// Mostrar vazio
function showEmpty() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('inventarioTable').style.display = 'none';
  
  // Zerar stats
  document.getElementById('totalVidros').textContent = '0';
  document.getElementById('totalEurocodes').textContent = '0';
  document.getElementById('totalLocalizacoes').textContent = '0';
}

// Mostrar erro
function showError(message) {
  const loading = document.getElementById('loadingState');
  loading.innerHTML = `
    <div style="color: #ef4444;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Erro</div>
      <div style="font-size: 16px;">${message}</div>
      <button onclick="loadInventario()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
        🔄 Tentar novamente
      </button>
    </div>
  `;
}

// Exportar para Excel
function exportarInventario() {
  if (!inventarioData || inventarioData.length === 0) {
    alert('Não há dados para exportar');
    return;
  }
  
  try {
    // Preparar dados para Excel
    const excelData = inventarioData.map(item => ({
      'Eurocode': item.eurocode,
      'Veículo': item.vehicle,
      'Marca': item.brand,
      'Quantidade': item.quantidade,
      'Localizações': item.localizacoes
    }));
    
    // Criar workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Adicionar worksheet
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
    
    // Gerar nome do ficheiro
    const now = new Date();
    const filename = `inventario_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, filename);
    
    console.log('Excel exportado:', filename);
    
  } catch (error) {
    console.error('Erro ao exportar:', error);
    alert('Erro ao exportar: ' + error.message);
  }
}

console.log('inventario.js carregado');

