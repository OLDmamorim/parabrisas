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
    
        // Gestor e Admin têm acesso ao seletor de utilizadores e upload de eurocodes
    if (currentUserRole === 'gestor' || currentUserRole === 'Admin') {
      // Mostrar seletor de utilizadores
      document.getElementById('gestorUserSelector').style.display = 'block';
      
      // Mostrar botão de upload de eurocodes
      const uploadBtn = document.getElementById('uploadEurocodesBtn');
      if (uploadBtn) {
        uploadBtn.style.display = 'inline-block';
      }
      
      // Carregar lista de utilizadores
      await loadUsersList();
    }
    
    // Apenas Admin tem acesso ao botão ADMIN (gestão de utilizadores)
    // Nota: O botão ADMIN é gerido por outro sistema/página loadUsersList();
      
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

// Carregar dados de um utilizador específico (como gestor/administrador)
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
  return (currentUserRole === 'gestor' || currentUserRole === 'Admin') && selectedUserId !== null;
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




// ===== FUNCIONALIDADE DE UPLOAD DE EUROCODES =====

let parsedEurocodes = [];

// Abrir modal de upload
function openUploadEurocodesModal() {
  const modal = document.getElementById('uploadEurocodesModal');
  if (modal) {
    modal.style.display = 'flex';
    // Reset
    parsedEurocodes = [];
    document.getElementById('uploadResult').textContent = 'Nenhum ficheiro selecionado';
    document.getElementById('uploadFileInfo').style.display = 'none';
    document.getElementById('uploadEurocodesConfirm').disabled = true;
  }
}

// Fechar modal de upload
function closeUploadEurocodesModal() {
  const modal = document.getElementById('uploadEurocodesModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Processar ficheiro Excel
async function handleEurocodesFile(file) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    if (typeof showToast === 'function') {
      showToast('Por favor, selecione um ficheiro Excel (.xlsx ou .xls)', 'error');
    }
    return;
  }
  
  document.getElementById('uploadFileName').textContent = `📄 ${file.name}`;
  document.getElementById('uploadFileDetails').textContent = `Tamanho: ${(file.size / 1024).toFixed(2)} KB`;
  document.getElementById('uploadFileInfo').style.display = 'block';
  
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    parsedEurocodes = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0) continue;
      
      const prefix = String(row[0] || '').trim();
      const marca = String(row[1] || '').trim();
      const modelo = String(row[2] || '').trim();
      
      // Validar prefixo (4 dígitos)
      if (!/^\d{4}$/.test(prefix)) continue;
      
      // Ignorar se não tiver marca
      if (!marca) continue;
      
      parsedEurocodes.push({
        prefix,
        marca,
        modelo: modelo || null
      });
    }
    
    document.getElementById('uploadFileDetails').textContent = `${parsedEurocodes.length} eurocodes encontrados`;
    document.getElementById('uploadResult').textContent = `✅ ${parsedEurocodes.length} eurocodes válidos encontrados`;
    document.getElementById('uploadEurocodesConfirm').disabled = parsedEurocodes.length === 0;
    
    if (parsedEurocodes.length === 0) {
      if (typeof showToast === 'function') {
        showToast('Nenhum eurocode válido encontrado no ficheiro', 'error');
      }
    }
    
  } catch (error) {
    console.error('Erro ao ler Excel:', error);
    if (typeof showToast === 'function') {
      showToast('Erro ao ler ficheiro Excel: ' + error.message, 'error');
    }
  }
}

// Upload para servidor
async function uploadEurocodesToServer() {
  if (parsedEurocodes.length === 0) return;
  
  const confirmBtn = document.getElementById('uploadEurocodesConfirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '⏳ A processar...';
  
  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('Não autenticado. Por favor, faça login primeiro.');
    }
    
    const response = await fetch('/.netlify/functions/upload-eurocodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ eurocodes: parsedEurocodes })
    });
    
    const data = await response.json();
    
    if (response.ok && data.ok) {
      document.getElementById('uploadResult').innerHTML = `
        <div style="color: #166534;">
          <strong>✅ ${data.message}</strong><br>
          <div style="margin-top: 10px; font-size: 13px;">
            📊 Recebidos: ${data.total_received} | 
            ✨ Adicionados: ${data.added} | 
            ⏭️ Já existiam: ${data.already_exists} | 
            📈 Total na BD: ${data.total_prefixes}
          </div>
        </div>
      `;
      
      if (typeof showToast === 'function') {
        showToast(`✅ ${data.added} eurocodes adicionados com sucesso!`, 'success');
      }
      
      // Fechar modal após 3 segundos
      setTimeout(() => {
        closeUploadEurocodesModal();
      }, 3000);
      
    } else {
      throw new Error(data.error || 'Erro desconhecido');
    }
    
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    document.getElementById('uploadResult').innerHTML = `
      <div style="color: #991b1b;">
        <strong>❌ Erro ao atualizar eurocodes</strong><br>
        <span style="font-size: 13px;">${error.message}</span>
      </div>
    `;
    
    if (typeof showToast === 'function') {
      showToast('Erro: ' + error.message, 'error');
    }
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = '🚀 Processar e Atualizar';
  }
}

// Event listeners para modal de upload
window.addEventListener('load', () => {
  // Fechar modal
  const closeBtn = document.getElementById('uploadEurocodesClose');
  const cancelBtn = document.getElementById('uploadEurocodesCancel');
  const confirmBtn = document.getElementById('uploadEurocodesConfirm');
  
  if (closeBtn) closeBtn.addEventListener('click', closeUploadEurocodesModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeUploadEurocodesModal);
  if (confirmBtn) confirmBtn.addEventListener('click', uploadEurocodesToServer);
  
  // Upload area
  const uploadArea = document.getElementById('uploadAreaModal');
  const fileInput = document.getElementById('eurocodesFileInput');
  
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#3b82f6';
      uploadArea.style.background = '#eff6ff';
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '#cbd5e1';
      uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#cbd5e1';
      uploadArea.style.background = 'transparent';
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleEurocodesFile(files[0]);
      }
    });
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleEurocodesFile(e.target.files[0]);
      }
    });
  }
  
  // Fechar modal ao clicar fora
  const modal = document.getElementById('uploadEurocodesModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeUploadEurocodesModal();
      }
    });
  }
});

// Expor funções globalmente
window.openUploadEurocodesModal = openUploadEurocodesModal;
window.closeUploadEurocodesModal = closeUploadEurocodesModal;

console.log('✅ Módulo de upload de eurocodes carregado');

