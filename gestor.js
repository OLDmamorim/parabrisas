// ===== FUNCIONALIDADE DE GESTOR =====

let currentUserRole = null;
let selectedUserId = null;
let allUsers = [];

// Verificar se o utilizador atual é gestor
async function checkIfGestor() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return false;

    // Decodificar token JWT para obter informações do utilizador
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUserRole = payload.role || 'user';
    
    console.log('👤 Role do utilizador:', currentUserRole);
    
    if (currentUserRole === 'gestor') {
      // Mostrar seletor de utilizadores
      document.getElementById('gestorUserSelector').style.display = 'block';
      
      // Carregar lista de utilizadores
      await loadUsersList();
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar role:', error);
    return false;
  }
}

// Carregar lista de utilizadores (apenas para gestores)
async function loadUsersList() {
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('/.netlify/functions/list-users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.ok && Array.isArray(data.users)) {
      allUsers = data.users;
      
      // Preencher select
      const select = document.getElementById('gestorUserSelect');
      select.innerHTML = '<option value="">Selecione um utilizador...</option>';
      
      data.users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.email} ${user.role === 'gestor' ? '👑' : ''}`;
        select.appendChild(option);
      });
      
      console.log(`✅ ${data.users.length} utilizadores carregados`);
    }
  } catch (error) {
    console.error('Erro ao carregar utilizadores:', error);
    if (typeof showToast === 'function') {
      showToast('Erro ao carregar utilizadores: ' + error.message, 'error');
    }
  }
}

// Carregar dados de um utilizador específico (como gestor)
async function loadUserDataAsGestor(userId) {
  if (!userId) {
    // Se não selecionou ninguém, carregar dados próprios
    selectedUserId = null;
    if (typeof loadResults === 'function') {
      await loadResults();
    }
    return;
  }
  
  try {
    selectedUserId = userId;
    
    const selectedUser = allUsers.find(u => u.id == userId);
    const userEmail = selectedUser ? selectedUser.email : 'utilizador';
    
    if (typeof showToast === 'function') {
      showToast(`📋 A carregar dados de ${userEmail}...`, 'info');
    }
    
    const token = localStorage.getItem('authToken');
    const tipo = 'recepcao'; // ou obter do estado atual
    
    const response = await fetch(`/.netlify/functions/list-ocr-gestor?user_id=${userId}&tipo=${tipo}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.ok && Array.isArray(data.rows)) {
      // Atualizar dados globais
      if (typeof RESULTS !== 'undefined') {
        RESULTS = data.rows.map(normalizeRow);
        FILTERED_RESULTS = [...RESULTS];
        renderTable();
      }
      
      if (typeof showToast === 'function') {
        showToast(`✅ ${data.rows.length} registos de ${userEmail} carregados`, 'success');
      }
      
      console.log(`✅ Dados de ${userEmail} carregados:`, data.rows.length, 'registos');
    }
  } catch (error) {
    console.error('Erro ao carregar dados do utilizador:', error);
    if (typeof showToast === 'function') {
      showToast('Erro ao carregar dados: ' + error.message, 'error');
    }
  }
}

// Verificar se está em modo gestor
function isGestorMode() {
  return currentUserRole === 'gestor' && selectedUserId !== null;
}

// Inicializar funcionalidade de gestor quando a página carregar
window.addEventListener('load', async () => {
  await checkIfGestor();
});

// Expor funções globalmente
window.checkIfGestor = checkIfGestor;
window.loadUserDataAsGestor = loadUserDataAsGestor;
window.isGestorMode = isGestorMode;

console.log('✅ Módulo de gestor carregado');

