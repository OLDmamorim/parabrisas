// ===== MENU INICIAL MOBILE =====

(function() {
  'use strict';

  const menuInicial = document.getElementById('mobileMenuInicial');
  const menuOptions = document.querySelectorAll('.menu-option');
  
  // Detectar se é mobile
  function isMobile() {
    return window.innerWidth < 900;
  }

  // Mostrar menu inicial apenas em mobile ao carregar
  function initMenuInicial() {
    if (isMobile()) {
      menuInicial.classList.add('show');
      // Esconder o resto da interface
      hideMainInterface();
    }
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
    console.log('Navegando para:', action);
    
    switch(action) {
      case 'entrada':
        // Mostrar interface de entrada (atual)
        menuInicial.classList.remove('show');
        showMainInterface();
        // Atualizar título
        updateTitle('ENTRADA DE STOCK');
        break;
        
      case 'saida':
        // Mostrar interface de saída (mesma página, modo diferente)
        menuInicial.classList.remove('show');
        showMainInterface();
        // Ativar modo saída
        activateSaidaMode();
        updateTitle('SAÍDA DE STOCK');
        break;
        
      case 'inventario':
        // Redirecionar para página de inventário
        window.location.href = 'inventario.html';
        break;
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

  // Event listeners para os botões
  menuOptions.forEach(option => {
    option.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      navigateTo(action);
    });
  });

  // Botão voltar (adicionar ao header depois)
  window.voltarMenuInicial = function() {
    if (isMobile()) {
      hideMainInterface();
      menuInicial.classList.add('show');
      // Remover modo saída
      document.body.classList.remove('modo-saida');
      document.body.classList.add('modo-entrada');
    }
  };

  // Inicializar ao carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenuInicial);
  } else {
    initMenuInicial();
  }

  // Reinicializar ao redimensionar (mobile <-> desktop)
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      if (!isMobile()) {
        // Desktop: esconder menu inicial e mostrar tudo
        menuInicial.classList.remove('show');
        showMainInterface();
      }
    }, 250);
  });

})();

