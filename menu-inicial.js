// ===== MENU INICIAL MOBILE =====

(function() {
  'use strict';

  console.log('🔧 Menu Inicial: Script carregado');

  // Detectar se é mobile
  function isMobile() {
    return window.innerWidth < 900;
  }

  // Esconder interface principal
  function hideMainInterface() {
    const header = document.querySelector('.header');
    const desktopView = document.getElementById('desktopView');
    const modernMobile = document.querySelector('.modern-mobile');
    
    if (header) header.style.display = 'none';
    if (desktopView) desktopView.style.display = 'none';
    if (modernMobile) modernMobile.style.display = 'none';
  }

  // Mostrar interface principal
  function showMainInterface() {
    const header = document.querySelector('.header');
    const desktopView = document.getElementById('desktopView');
    const modernMobile = document.querySelector('.modern-mobile');
    
    if (header) header.style.display = 'flex';
    if (desktopView) desktopView.style.display = 'block';
    if (modernMobile && isMobile()) modernMobile.style.display = 'flex';
  }

  // Navegar para ação escolhida
  function navigateTo(action) {
    console.log('📦 MENU INICIAL - Navegando para:', action);
    console.log('📦 Tipo de ação:', typeof action, '| Valor:', action);
    
    const menuInicial = document.getElementById('mobileMenuInicial');
    
    switch(action) {
      case 'entrada':
        // Mostrar interface de entrada (atual)
        if (menuInicial) menuInicial.classList.remove('show');
        showMainInterface();
        // Atualizar título
        updateTitle('ENTRADA DE STOCK');
        // Adicionar estado ao histórico para controlar botão voltar
        if (isMobile()) {
          history.pushState({ page: 'entrada' }, '', '#entrada');
        }
        break;
        
      case 'saida':
        // Mostrar interface de saída (mesma página, modo diferente)
        if (menuInicial) menuInicial.classList.remove('show');
        showMainInterface();
        // Ativar modo saída
        activateSaidaMode();
        updateTitle('SAÍDA DE STOCK');
        // Adicionar estado ao histórico para controlar botão voltar
        if (isMobile()) {
          history.pushState({ page: 'saida' }, '', '#saida');
        }
        break;
        

      default:
        console.error('❌ Ação desconhecida:', action);
    }
  }

  // Atualizar título do header
  function updateTitle(newTitle) {
    const titleElement = document.querySelector('.header h2');
    if (titleElement) {
      titleElement.textContent = newTitle;
    }
  }

  // Ativar modo saída
  function activateSaidaMode() {
    // Adicionar classe ao body para identificar modo
    document.body.classList.add('modo-saida');
    document.body.classList.remove('modo-entrada');
    
    // Esconder botões de entrada
    const btnCarregar = document.getElementById('btnUpload');
    if (btnCarregar) btnCarregar.style.display = 'none';
    
    // Mostrar apenas a tabela com botões de saída
    console.log('Modo saída ativado');
  }

  // Registar event listeners
  function setupEventListeners() {
    const menuOptions = document.querySelectorAll('.menu-option');
    console.log('🔧 Menu Inicial: Encontrados', menuOptions.length, 'botões');
    
    if (menuOptions.length === 0) {
      console.error('❌ Nenhum botão .menu-option encontrado!');
      return;
    }
    
    menuOptions.forEach((option, index) => {
      const action = option.getAttribute('data-action');
      console.log(`🔧 Botão ${index + 1}:`, action);
      
      // Remover listeners antigos se existirem
      option.replaceWith(option.cloneNode(true));
    });
    
    // Re-selecionar após clonar
    const freshMenuOptions = document.querySelectorAll('.menu-option');
    freshMenuOptions.forEach(option => {
      option.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const action = this.getAttribute('data-action');
        console.log('🔧 Botão clicado:', action);
        navigateTo(action);
      });
    });
    
    console.log('✅ Event listeners registados com sucesso');
  }

  // Mostrar menu inicial apenas em mobile ao carregar
  function initMenuInicial() {
    console.log('🔧 Inicializando menu inicial...');
    console.log('🔧 É mobile?', isMobile());
    
    const menuInicial = document.getElementById('mobileMenuInicial');
    
    if (!menuInicial) {
      console.error('❌ Elemento #mobileMenuInicial não encontrado!');
      return;
    }
    
    if (isMobile()) {
      menuInicial.classList.add('show');
      // Esconder o resto da interface
      hideMainInterface();
      console.log('✅ Menu inicial mostrado');
    }
    
    // Registar event listeners
    setupEventListeners();
  }

  // Botão voltar (adicionar ao header depois)
  window.voltarMenuInicial = function() {
    if (isMobile()) {
      const menuInicial = document.getElementById('mobileMenuInicial');
      hideMainInterface();
      if (menuInicial) menuInicial.classList.add('show');
      // Remover modo saída e restaurar modo entrada
      document.body.classList.remove('modo-saida');
      document.body.classList.add('modo-entrada');
      // Mostrar botão de carregar novamente
      const btnCarregar = document.getElementById('btnUpload');
      if (btnCarregar) btnCarregar.style.display = '';
      // Atualizar histórico
      history.replaceState({ page: 'menu' }, '', '#menu');
    }
  };

  // Inicializar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    console.log('🔧 DOM ainda carregando, aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initMenuInicial);
  } else {
    console.log('🔧 DOM já carregado, inicializando imediatamente...');
    initMenuInicial();
  }

  // Interceptar botão voltar do navegador
  window.addEventListener('popstate', function(event) {
    if (isMobile()) {
      // Se estiver em entrada ou saída, voltar ao menu inicial
      if (event.state && (event.state.page === 'entrada' || event.state.page === 'saida')) {
        window.voltarMenuInicial();
      } else {
        // Se já estiver no menu inicial, voltar ao menu inicial novamente (não faz logout)
        window.voltarMenuInicial();
      }
    }
  });
  
  // Adicionar estado inicial ao histórico
  if (isMobile()) {
    history.replaceState({ page: 'menu' }, '', '#menu');
  }

  // Reinicializar ao redimensionar (mobile <-> desktop)
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (!isMobile()) {
        // Desktop: esconder menu inicial e mostrar tudo
        const menuInicial = document.getElementById('mobileMenuInicial');
        if (menuInicial) menuInicial.classList.remove('show');
        showMainInterface();
      }
    }, 250);
  });

})();

