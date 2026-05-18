const protocol = window.location.protocol;
const host = window.location.hostname;
const isLocal = protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');

const App = {
  apiUrl: isLocal ? `http://${host || 'localhost'}:3000` : '',
  getToken: () => sessionStorage.getItem('token'),
  setToken: (token) => sessionStorage.setItem('token', token),
  logout: () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('enemflow_last_access');
    window.location.href = 'login.html';
  },

  // Toggle Dark/Light Mode
  toggleTheme: () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  },

  initTheme: () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  api: async (endpoint, options = {}) => {
    const token = App.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Se for FormData (Upload), removemos o Content-Type para o browser setar o multipart/form-data com o boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${App.apiUrl}${endpoint}`, {
        ...options,
        headers,
      });
      
      const contentType = response.headers.get("content-type");
      let data;
      
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        throw new Error('Erro no servidor (não retornou JSON).');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro na requisição.');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  showToast: (msg, isError = false) => {
    const oldToast = document.getElementById('premium-toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.id = 'premium-toast';
    toast.className = `fixed bottom-4 right-4 md:bottom-10 md:right-10 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl z-[9999] transform translate-y-20 opacity-0 transition-all duration-500 backdrop-blur-xl border ${
      isError 
        ? 'bg-red-500/10 border-red-500/20 text-red-500' 
        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
    }`;
    
    const icon = isError 
      ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
      : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    
    toast.innerHTML = `
      ${icon}
      <p class="font-medium text-sm text-slate-200">${msg}</p>
    `;
    
    document.body.appendChild(toast);
    
    // Animate In
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-20', 'opacity-0');
    });
    
    if(window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  },

  showLoading: (containerId, text = 'Processando com IA...') => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 animate-fade-in">
        <div class="relative w-16 h-16 mb-4">
          <div class="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
          <div class="absolute inset-2 rounded-full border-t-2 border-pink-500 animate-spin-reverse"></div>
          <div class="absolute inset-4 rounded-full border-t-2 border-purple-500 animate-spin"></div>
        </div>
        <p class="text-sm font-medium text-slate-400 animate-pulse">${text}</p>
      </div>
    `;
  }
};

// Inicializações PWA e Globais
document.addEventListener('DOMContentLoaded', () => {
  App.initTheme();

  // Registrar Service Worker para PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(err => {
        console.warn('PWA Service Worker falhou:', err);
      });
    });
  }

  // Trava de Sessão 12h
  const lastAccess = sessionStorage.getItem('enemflow_last_access');
  const now = Date.now();
  if (lastAccess && (now - parseInt(lastAccess)) > 12 * 60 * 60 * 1000) {
    if (!window.location.href.includes('login.html')) {
      App.logout();
    }
  } else if (App.getToken()) {
    sessionStorage.setItem('enemflow_last_access', now.toString());
  }

  // Setup Mobile Nav Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
    });
  }
});
