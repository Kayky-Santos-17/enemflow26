const protocol = window.location.protocol;
const host = window.location.hostname;
const isLocal = protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');

const App = {
  apiUrl: isLocal ? `http://${host || 'localhost'}:3000` : '',
  getToken: () => localStorage.getItem('token'),
  setToken: (token) => localStorage.setItem('token', token),
  logout: async () => {
    const token = App.getToken();
    if (token) {
      try {
        await fetch(`${App.apiUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.warn('Falha ao invalidar sessao no servidor:', error.message);
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('enemflow_last_access');
    window.location.href = 'login.html';
  },

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
    if (localStorage.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  },

  api: async (endpoint, options = {}) => {
    const token = App.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const timeoutMs = options.timeoutMs || 65000;
    const retries = Math.max(0, Math.min(options.retries ?? 1, 2));
    const fetchOptions = { ...options, headers };
    delete fetchOptions.timeoutMs;
    delete fetchOptions.retries;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${App.apiUrl}${endpoint}`, {
          ...fetchOptions,
          signal: controller.signal,
        });

        let text = '';
        try {
          text = await response.text();
        } catch (err) {
          console.error('Falha ao ler o corpo da resposta do servidor:', err);
          throw new Error('Servidor temporariamente indisponivel.');
        }

        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (err) {
          console.error('Resposta do servidor nao JSON:', text);
          throw new Error('Servidor temporariamente indisponivel. Tente novamente mais tarde.');
        }

        if (!response.ok || data.success === false) {
          const detailText = data.details && data.details.expected
            ? ` (${data.details.received || 0}/${data.details.expected} questoes recebidas)`
            : '';
          const apiError = new Error(`${data.error || 'Erro na requisicao.'}${detailText}`);
          apiError.status = response.status;
          apiError.details = data.details;
          apiError.payload = data;
          throw apiError;
        }

        return data;
      } catch (error) {
        const retryable = error.name === 'AbortError' || [409, 425, 429, 500, 502, 503, 504].includes(error.status);
        if (attempt < retries && retryable) {
          await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }

        console.error('API Error:', error);
        if (error.name === 'AbortError') {
          throw new Error('A requisicao demorou mais que o esperado. Tente novamente.');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  },

  showToast: (msg, isError = false) => {
    const oldToast = document.getElementById('premium-toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.id = 'premium-toast';
    toast.className = `fixed bottom-4 right-4 md:bottom-10 md:right-10 flex items-center gap-3.5 px-6 py-4 rounded-2xl shadow-2xl z-[9999] transform translate-y-20 opacity-0 transition-all duration-500 backdrop-blur-xl border ${
      isError
        ? 'bg-red-950/60 border-red-500/30 text-red-400 shadow-[0_8px_32px_0_rgba(239,68,68,0.15)]'
        : 'bg-indigo-950/60 border-indigo-500/30 text-indigo-400 shadow-[0_8px_32px_0_rgba(99,102,241,0.15)]'
    }`;

    const icon = isError
      ? '<svg class="w-5 h-5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
      : '<svg class="w-5 h-5 shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

    toast.innerHTML = `${icon}<p class="font-bold text-sm text-slate-100 dark:text-slate-100"></p>`;
    toast.querySelector('p').textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-20', 'opacity-0');
    });

    if (window.toastTimer) clearTimeout(window.toastTimer);
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
        <p class="text-sm font-medium text-slate-400 animate-pulse"></p>
      </div>
    `;
    container.querySelector('p').textContent = text;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.initTheme();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) registration.unregister();
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }
  }

  const now = Date.now();
  if (App.getToken()) {
    localStorage.setItem('enemflow_last_access', now.toString());
  }

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
    });
  }
});
