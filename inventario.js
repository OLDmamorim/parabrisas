// Inventário com câmera + OCR
(async function() {
  console.log('📦 Inventário carregado');

  // Verificar autenticação
  if (!window.authManager || !authManager.isAuthenticated()) {
    window.location.href = 'index.html';
    return;
  }

  // Elementos
  const cameraInput = document.getElementById('cameraInput');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const itemsList = document.getElementById('itemsList');
  const itemsCount = document.getElementById('itemsCount');

  // Abrir câmera
  window.abrirCamera = function() {
    cameraInput.click();
  };

  // Processar foto
  cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Mostrar loading
      alert('📸 A processar imagem...');

      // Ler imagem como base64
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

          if (!response.ok) {
            throw new Error('Erro ao processar imagem');
          }

          const data = await response.json();
          
          // Extrair dados
          const eurocode = data.structured?.eurocode || '';
          const vehicle = data.structured?.veiculo_marca || '';
          const brand = data.structured?.veiculo_modelo || '';

          if (eurocode) {
            // Adicionar ao inventário
            await adicionarItem({
              eurocode,
              vehicle,
              brand,
              localizacao: 'LOJA',
              quantidade: 1
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

    // Limpar input
    cameraInput.value = '';
  });

  // Adicionar item ao inventário
  async function adicionarItem(item) {
    try {
      const response = await fetch('/.netlify/functions/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authManager.getToken()}`
        },
        body: JSON.stringify({
          action: 'insert',
          table: 'inventario',
          data: {
            eurocode: item.eurocode,
            vehicle: item.vehicle || '',
            brand: item.brand || '',
            localizacao: item.localizacao || 'LOJA',
            quantidade: item.quantidade || 1,
            created_at: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao adicionar item');
      }

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

      // Buscar dados da tabela principal (receção)
      const response = await fetch('/.netlify/functions/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authManager.getToken()}`
        },
        body: JSON.stringify({
          action: 'select',
          table: 'ocr_results',
          orderBy: 'created_at',
          orderDirection: 'desc'
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }

      const data = await response.json();
      const items = data.data || [];

      loadingState.style.display = 'none';

      if (items.length === 0) {
        emptyState.style.display = 'block';
        return;
      }

      // Agrupar por Eurocode
      const grouped = {};
      items.forEach(item => {
        const eurocode = item.eurocode;
        if (!eurocode || eurocode === '—') return;

        if (!grouped[eurocode]) {
          grouped[eurocode] = {
            eurocode,
            vehicle: item.vehicle || '',
            brand: item.brand || '',
            quantidade: 0,
            localizacoes: new Set()
          };
        }

        grouped[eurocode].quantidade++;
        if (item.sm_loja) {
          grouped[eurocode].localizacoes.add(item.sm_loja);
        }
      });

      // Converter para array
      const groupedArray = Object.values(grouped);

      // Atualizar estatísticas
      const totalVidros = groupedArray.reduce((sum, item) => sum + item.quantidade, 0);
      const totalEurocodes = groupedArray.length;
      const allLocalizacoes = new Set();
      const allMarcas = new Set();

      groupedArray.forEach(item => {
        item.localizacoes.forEach(loc => allLocalizacoes.add(loc));
        if (item.brand) allMarcas.add(item.brand);
      });

      document.getElementById('totalVidros').textContent = totalVidros;
      document.getElementById('totalEurocodes').textContent = totalEurocodes;
      document.getElementById('totalLocalizacoes').textContent = allLocalizacoes.size;
      document.getElementById('totalMarcas').textContent = allMarcas.size;
      itemsCount.textContent = `${groupedArray.length} itens`;

      // Renderizar lista
      itemsList.innerHTML = groupedArray.map(item => `
        <div class="item-card">
          <div class="item-eurocode">🔢 ${item.eurocode}</div>
          ${item.vehicle ? `<div class="item-vehicle">🚗 ${item.vehicle}</div>` : ''}
          <div class="item-details">
            <span class="item-quantity">📦 ${item.quantidade}x</span>
            ${item.brand ? `<span>🏭 ${item.brand}</span>` : ''}
            ${item.localizacoes.size > 0 ? `<span>📍 ${Array.from(item.localizacoes).join(', ')}</span>` : ''}
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Erro ao carregar:', error);
      loadingState.style.display = 'none';
      emptyState.style.display = 'block';
    }
  }

  // Exportar para Excel
  window.exportarInventario = async function() {
    try {
      // Buscar dados
      const response = await fetch('/.netlify/functions/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authManager.getToken()}`
        },
        body: JSON.stringify({
          action: 'select',
          table: 'ocr_results',
          orderBy: 'created_at',
          orderDirection: 'desc'
        })
      });

      const data = await response.json();
      const items = data.data || [];

      // Agrupar
      const grouped = {};
      items.forEach(item => {
        const eurocode = item.eurocode;
        if (!eurocode || eurocode === '—') return;

        if (!grouped[eurocode]) {
          grouped[eurocode] = {
            Eurocode: eurocode,
            Veículo: item.vehicle || '',
            Marca: item.brand || '',
            Quantidade: 0,
            Localizações: new Set()
          };
        }

        grouped[eurocode].Quantidade++;
        if (item.sm_loja) {
          grouped[eurocode].Localizações.add(item.sm_loja);
        }
      });

      // Converter para array
      const exportData = Object.values(grouped).map(item => ({
        ...item,
        Localizações: Array.from(item.Localizações).join(', ')
      }));

      // Criar Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Inventário');

      // Download
      const filename = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      alert('✅ Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('❌ Erro ao exportar Excel');
    }
  };

  // Carregar ao iniciar
  await carregarInventario();
})();

