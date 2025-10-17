// Script de autenticação para o frontend
class AuthManager {
  constructor() {
    this.API_BASE = '/.netlify/functions';
    this.token = localStorage.getItem('authToken');
    this.user = this.getStoredUser();
  }

  getStoredUser() {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated() {
    if (!this.token) return false;
    
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  async checkAuth() {
    if (!this.isAuthenticated()) {
      this.redirectToLogin();
      return false;
    }
    return true;
  }

  redirectToLogin() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }

  async makeAuthenticatedRequest(url, options = {}) {
    if (!this.isAuthenticated()) {
      this.redirectToLogin();
      throw new Error('Não autenticado');
    }

    const defaultOptions = {
      headers: this.getAuthHeaders()
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, mergedOptions);
      
      if (response.status === 401) {
        this.redirectToLogin();
        throw new Error('Sessão expirada');
      }
      
      return response;
    } catch (error) {
      if (error.message === 'Sessão expirada' || error.message === 'Não autenticado') {
        throw error;
      }
      throw new Error('Erro de conexão');
    }
  }

  showUserInfo() {
    if (this.user) {
      // Criar elemento de informação do utilizador
      const userInfo = document.createElement('div');
      userInfo.id = 'userInfo';
      userInfo.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255,255,255,0.95);
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        z-index: 1000;
        font-size: 14px;
        color: #333;
        backdrop-filter: blur(10px);
      `;
      
      userInfo.innerHTML = `
        <div id="userName" style="margin-bottom: 8px;">
          <strong>${this.user.name}</strong>
          ${this.user.role === 'admin' ? '<span style="color: #e53e3e; font-size: 12px;">(Admin)</span>' : ''}
        </div>
        <div id="userEmail" style="font-size: 12px; color: #666; margin-bottom: 10px;">
          ${this.user.email}
        </div>
        <button onclick="authManager.logout()" style="
          background: #e53e3e;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
        ">
          Sair
        </button>
        ${this.user.role === 'admin' ? `
          <button onclick="window.open('admin.html', '_blank')" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 5px;
          ">
            Admin
          </button>
        ` : ''}
      `;
      
      document.body.appendChild(userInfo);
    }
  }
}

// Instância global
const authManager = new AuthManager();

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar se estamos numa página que requer autenticação
  const publicPages = ['login.html', 'register.html'];
  const currentPage = window.location.pathname.split('/').pop();
  
  if (!publicPages.includes(currentPage)) {
    const isAuth = await authManager.checkAuth();
    if (isAuth) {
      authManager.showUserInfo();
    }
  }
});

// Interceptar todas as chamadas fetch para adicionar autenticação automaticamente
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  // Se a URL é para uma API que requer autenticação
  if (url.includes('/.netlify/functions/') && 
      !url.includes('auth-login') && 
      !url.includes('auth-register') &&
      !url.includes('health')) {
    
    if (authManager.isAuthenticated()) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${authManager.token}`
      };
    }
  }
  
  return originalFetch.call(this, url, options);
};