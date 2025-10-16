// inventario-novo.js
(async function() {
  console.log('📦 Inventário carregado');

  // Verificar autenticação
  if (!window.authManager || !authManager.isAuthenticated()) {
    console.log('❌ Não autenticado, redirecionando para login...');
    window.location.href = 'login.html';
    return;
  }
  console.log('✅ Autenticado com sucesso');

  // Variável global para tipo de vidro
  window.tipoVidroSelecionado = 'rede';

  // Elementos
  const cameraInput = document.getElementById('cameraInput');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const itemsList = document.getElementById('itemsList');
  const itemsCount = document.getElementById('itemsCount');
  const modal = document.getElementById('tipoVidroModal');

  let inventarioData = [];

  // Abrir câmera - mostrar modal primeiro
  window.abrirCamera = function() {
    modal.classList.add('show');
  };

  // Event listeners para botões do modal
  document.getElementById('btnTipoRede').addEventListener('click', () => {
    window.tipoVidroSelecionado = 'rede';
    modal.classList.remove('show');
    cameraInput.click();
  });

  document.getElementById('btnTipoComplementar').addEventListener('click', () => {
    window.tipoVidroSelecionado = 'complementar';
    modal.classList.remove('show');
    cameraInput.click();
  });

  document.getElementById('btnTipoOEM').addEventListener('click', () => {
    window.tipoVidroSelecionado = 'oem';
    modal.classList.remove('show');
    cameraInput.click();
  });

  // Processar foto
  cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      alert('📸 A processar imagem...');

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result;

        try {
          // Chamar OCR
          const response = await fetch('/.netlify/functions/ocr-claude', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authManager.getToken()}`
            },
            body: JSON.stringify({
              image: base64Image,
              filename: file.name
            })
          });

          if (!response.ok) throw new Error('Erro ao processar imagem');

          const data = await response.json();
          
          // Extrair dados
          let eurocode = data.structured?.eurocode || '';
          const vehicle = data.structured?.veiculo_marca || '';
          const brand = data.structured?.veiculo_modelo || '';

          // Adicionar prefixo conforme tipo
          if (eurocode) {
            if (window.tipoVidroSelecionado === 'complementar' && !eurocode.startsWith('#')) {
              eurocode = '#' + eurocode;
            } else if (window.tipoVidroSelecionado === 'oem' && !eurocode.startsWith('*')) {
              eurocode = '*' + eurocode;
            }

            // Adicionar ao inventário
            await adicionarItem({
              text: data.text || '',
              eurocode,
              vehicle,
              brand,
              filename: file.name,
              source: 'camera',
              loja: 'LOJA',
              observacoes: ''
            });

            alert(`✅ Item adicionado!\n\n🔢 ${eurocode}\n🚗 ${vehicle || 'N/A'}`);
            
            // Recarregar
            await carregarInventario();
          } else {
            alert('❌ Não foi possível identificar o Eurocode');
          }
        } catch (error) {
          console.error('Erro OCR:', error);
          alert('❌ Erro ao processar imagem');
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro ao processar foto');
    }

    cameraInput.value = '';
  });

  // Adicionar item ao inventário
  async function adicionarItem(item) {
    try {
      const response = await fetch('/.netlify/functions/save-inventario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authManager.getToken()}`
        },
        body: JSON.stringify(item)
      });

      if (!response.ok) throw new Error('Erro ao adicionar item');
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
      throw error;
    }
  }

  // Carregar inventário
  async function carregarInventario() {
    try {
      loadingState.style.display = 'block';
      emptyState.style.display = 'none';
      itemsList.innerHTML = '';

      const response = await fetch('/.netlify/functions/list-inventario', {
        headers: {
          'Authorization': `Bearer ${authManager.getToken()}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar inventário');

      const data = await response.json();
      inventarioData = data.rows || [];

      loadingState.style.display = 'none';

      if (inventarioData.length === 0) {
        emptyState.style.display = 'block';
        itemsCount.textContent = '0 itens';
      } else {
        renderInventario();
        atualizarTotalizadores();
      }
    } catch (error) {
      console.error('Erro ao carregar:', error);
      loadingState.style.display = 'none';
      alert('❌ Erro ao carregar inventário');
    }
  }

  // Render inventário
  function renderInventario() {
    itemsList.innerHTML = '';
    itemsCount.textContent = `${inventarioData.length} ${inventarioData.length === 1 ? 'item' : 'itens'}`;

    inventarioData.forEach(item => {
      const div = document.createElement('div');
      div.className = 'item-card';
      div.innerHTML = `
        <div class="item-header">
          <span class="item-eurocode">${item.eurocode || '—'}</span>
          <button class="item-delete" onclick="deletarItem(${item.id})">🗑️</button>
        </div>
        <div class="item-details">
          <div class="item-detail">
            <span class="item-label">🏭 Marca:</span>
            <span class="item-value">${item.brand || '—'}</span>
          </div>
          <div class="item-detail">
            <span class="item-label">🚗 Veículo:</span>
            <span class="item-value">${item.vehicle || '—'}</span>
          </div>
          <div class="item-detail">
            <span class="item-label">📍 Loja:</span>
            <span class="item-value">${item.loja || '—'}</span>
          </div>
          <div class="item-detail">
            <span class="item-label">📅 Data:</span>
            <span class="item-value">${new Date(item.created_at).toLocaleDateString('pt-PT')}</span>
          </div>
        </div>
      `;
      itemsList.appendChild(div);
    });
  }

  // Atualizar totalizadores
  function atualizarTotalizadores() {
    const total = inventarioData.length;
    const rede = inventarioData.filter(item => {
      const ec = item.eurocode || '';
      return !ec.startsWith('#') && !ec.startsWith('*');
    }).length;
    const complementar = inventarioData.filter(item => (item.eurocode || '').startsWith('#')).length;
    const oem = inventarioData.filter(item => (item.eurocode || '').startsWith('*')).length;

    document.getElementById('totalVidros').textContent = total;
    document.getElementById('totalRede').textContent = rede;
    document.getElementById('totalComplementar').textContent = complementar;
    document.getElementById('totalOEM').textContent = oem;
  }

  // Deletar item
  window.deletarItem = async function(id) {
    if (!confirm('Tem a certeza que deseja eliminar este item?')) return;

    try {
      const response = await fetch('/.netlify/functions/delete-inventario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authManager.getToken()}`
        },
        body: JSON.stringify({ id })
      });

      if (!response.ok) throw new Error('Erro ao deletar');

      alert('✅ Item eliminado!');
      await carregarInventario();
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro ao eliminar item');
    }
  };

  // Exportar inventário
  window.exportarInventario = function() {
    if (inventarioData.length === 0) {
      alert('❌ Não há dados para exportar');
      return;
    }

    const ws_data = [
      ['Eurocode', 'Marca Vidro', 'Veículo', 'Loja', 'Data']
    ];

    inventarioData.forEach(item => {
      ws_data.push([
        item.eurocode || '',
        item.brand || '',
        item.vehicle || '',
        item.loja || '',
        new Date(item.created_at).toLocaleDateString('pt-PT')
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
    XLSX.writeFile(wb, `Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Carregar ao iniciar
  await carregarInventario();
})();

