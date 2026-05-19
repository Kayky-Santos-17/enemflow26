// =========================================================================
// ENEMFLOW AI — Dynamic, Collapsible & Persistent Sidebar v3.0
// Premium sidebar: ⚡ bolt icon only when collapsed, smooth animations,
// Sora font, gradient brand, Lucide-style icons via Feather, no emojis.
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Check authentication first
  if (!localStorage.getItem('token') && !sessionStorage.getItem('token') && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('reset-password.html')) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Identify the active page
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'dashboard.html';

  // 3. Retrieve collapsed state
  let isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';

  // 4. Remove any old sidebar/header elements to prevent duplication
  ['sidebar', 'dynamic-sidebar', 'ef-sidebar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('.mobile-top-actions, .sidebar').forEach(el => el.remove());
  const oldOverlay = document.getElementById('mobileOverlay');
  if (oldOverlay) oldOverlay.remove();
  const oldOverlay2 = document.getElementById('ef-overlay');
  if (oldOverlay2) oldOverlay2.remove();
  const oldMobile = document.getElementById('ef-mobile-header');
  if (oldMobile) oldMobile.remove();

  // 5. Inject sidebar styles
  if (!document.getElementById('sidebar-styles-v3')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'sidebar-styles-v3';
    styleEl.textContent = `
      :root {
        --sb-width: 260px;
        --sb-collapsed: 68px;
      }
      #ef-sidebar {
        width: var(--sb-width);
        transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #ef-sidebar.collapsed {
        width: var(--sb-collapsed) !important;
      }
      /* When collapsed: hide all text, labels, user info */
      #ef-sidebar.collapsed .sb-text,
      #ef-sidebar.collapsed .sb-label,
      #ef-sidebar.collapsed .sb-user-info,
      #ef-sidebar.collapsed .sb-collapse-btn-text,
      #ef-sidebar.collapsed .sb-header-brand,
      #ef-sidebar.collapsed .sb-toggle-area-text {
        opacity: 0;
        width: 0;
        overflow: hidden;
        white-space: nowrap;
        pointer-events: none;
        transition: opacity 0.2s ease, width 0.2s ease;
      }
      #ef-sidebar:not(.collapsed) .sb-text,
      #ef-sidebar:not(.collapsed) .sb-label,
      #ef-sidebar:not(.collapsed) .sb-user-info,
      #ef-sidebar:not(.collapsed) .sb-header-brand {
        opacity: 1;
        width: auto;
        transition: opacity 0.3s ease 0.15s, width 0.3s ease;
      }
      /* Show only the bolt icon when collapsed */
      #ef-sidebar.collapsed .sb-logo-full { display: none !important; }
      #ef-sidebar.collapsed .sb-logo-bolt { display: flex !important; }
      #ef-sidebar .sb-logo-bolt { display: none; }
      /* Center nav items when collapsed */
      #ef-sidebar.collapsed .sb-nav-item {
        justify-content: center !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      #ef-sidebar.collapsed .sb-nav-item svg {
        margin: 0 auto;
      }
      /* Footer adjustments */
      #ef-sidebar.collapsed .sb-footer-user {
        flex-direction: column;
        align-items: center;
        padding: 0.5rem !important;
      }
      #ef-sidebar.collapsed .sb-logout-btn span { display: none !important; }
      #ef-sidebar.collapsed .sb-logout-btn {
        justify-content: center !important;
        padding: 0.625rem !important;
      }
      #ef-sidebar.collapsed .sb-toggle-area {
        justify-content: center !important;
      }
      /* Main content offset */
      @media (min-width: 1024px) {
        body:has(#ef-sidebar) main {
          margin-left: var(--sb-width);
          transition: margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        body:has(#ef-sidebar.collapsed) main {
          margin-left: var(--sb-collapsed);
        }
      }
      @media (max-width: 1023px) {
        #ef-sidebar {
          transform: translateX(-100%);
          position: fixed;
          z-index: 50;
        }
        #ef-sidebar.mobile-open {
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 6. Build sidebar HTML
  const sidebar = document.createElement('aside');
  sidebar.id = 'ef-sidebar';
  sidebar.className = `fixed top-0 left-0 h-screen flex flex-col border-r z-50 ${isCollapsed ? 'collapsed' : ''}`;
  sidebar.style.cssText = `background: rgba(10,8,20,0.95); backdrop-filter: blur(30px) saturate(1.4); -webkit-backdrop-filter: blur(30px) saturate(1.4); border-color: rgba(124,92,252,0.08);`;

  // Menu items — NO emojis, only feather icons
  const menuItems = [
    { title: 'Dashboard', icon: 'home', url: 'dashboard.html', cat: 'Menu Principal' },
    { title: 'Matérias', icon: 'book-open', url: 'materias.html', cat: 'Menu Principal' },
    { title: 'Tutor IA', icon: 'cpu', url: 'chat.html', cat: 'Menu Principal' },
    { title: 'Plano de Estudos', icon: 'calendar', url: 'plan.html', cat: 'Menu Principal' },
    { title: 'Simulados', icon: 'check-square', url: 'exercises.html', cat: 'Menu Principal' },
    { title: 'Histórico', icon: 'clock', url: 'history.html', cat: 'Sua Conta' },
    { title: 'Perfil', icon: 'user', url: 'perfil.html', cat: 'Sua Conta' },
    { title: 'Configurações', icon: 'settings', url: 'settings.html', cat: 'Sua Conta' },
  ];

  let menuHtml = '';
  let lastCat = '';
  menuItems.forEach(item => {
    if (item.cat !== lastCat) {
      lastCat = item.cat;
      menuHtml += `<p class="sb-label px-4 text-[10px] font-bold uppercase tracking-widest mb-2 mt-5" style="color: rgba(167,139,250,0.35); font-family:'Sora',sans-serif;">${item.cat}</p>`;
    }
    const isActive = page === item.url;
    menuHtml += `
      <a href="${item.url}" class="sb-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm mx-2 mb-0.5 ${
        isActive ? 'text-white' : 'hover:bg-white/5'
      }" style="${isActive 
        ? 'background: rgba(124,92,252,0.15); color: #c4b5fd; border-left: 3px solid #7c5cfc; box-shadow: 0 0 20px rgba(124,92,252,0.08);' 
        : 'color: rgba(196,188,220,0.6);'}; font-family:'Inter',sans-serif;">
        <i data-feather="${item.icon}" class="w-[18px] h-[18px] shrink-0" ${isActive ? 'style="color:#a78bfa;"' : ''}></i>
        <span class="sb-text">${item.title}</span>
      </a>
    `;
  });

  // Bolt SVG for collapsed state (inline, no emoji)
  const boltSVG = `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="url(#boltGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <defs><linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#a78bfa"/><stop offset="100%" style="stop-color:#f472b6"/></linearGradient></defs>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>`;

  sidebar.innerHTML = `
    <!-- Header -->
    <div class="px-5 py-5 flex items-center justify-between" style="border-bottom: 1px solid rgba(124,92,252,0.08);">
      <a href="dashboard.html" class="sb-logo-full flex items-center gap-2.5" style="text-decoration:none;">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style="background: linear-gradient(135deg, #7c5cfc, #a855f7); box-shadow: 0 0 15px rgba(124,92,252,0.3);">
          <i data-feather="zap" class="w-[18px] h-[18px]"></i>
        </div>
        <span class="sb-header-brand text-lg font-bold tracking-tight" style="color:#e4dff0; font-family:'Sora',sans-serif;">EnemFlow <span style="background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">AI</span></span>
      </a>
      <a href="dashboard.html" class="sb-logo-bolt w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, #7c5cfc, #a855f7); text-decoration:none; box-shadow: 0 0 20px rgba(124,92,252,0.3);">
        ${boltSVG}
      </a>
    </div>

    <!-- Toggle -->
    <div class="sb-toggle-area hidden lg:flex px-4 py-2 justify-end">
      <button id="sb-toggle-btn" class="p-1.5 rounded-lg transition-all duration-300" style="background:rgba(124,92,252,0.06); color:rgba(167,139,250,0.5);" title="Expandir/Recolher">
        <i data-feather="${isCollapsed ? 'chevrons-right' : 'chevrons-left'}" class="w-4 h-4"></i>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-2" style="scrollbar-width:thin;">
      ${menuHtml}
      <div id="sb-admin-section"></div>
    </nav>

    <!-- Footer -->
    <div class="px-3 py-4" style="border-top: 1px solid rgba(124,92,252,0.08);">
      <div class="sb-footer-user flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors mb-3 hover:bg-white/5" style="color:rgba(196,188,220,0.7);" onclick="window.location.href='perfil.html'">
        <div id="sb-avatar" class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-cover bg-center" style="background-color:rgba(124,92,252,0.2);color:#a78bfa;font-family:'Sora',sans-serif;">?</div>
        <div class="sb-user-info overflow-hidden">
          <p id="sb-username" class="text-sm font-semibold truncate" style="color:#e4dff0;font-family:'Sora',sans-serif;">Carregando...</p>
          <div class="flex items-center gap-1.5">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" style="color:#a78bfa;">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <p class="text-[11px] font-bold" style="color:#a78bfa;font-family:'Sora',sans-serif;"><span id="sb-xp">0</span> XP</p>
          </div>
        </div>
      </div>
      <button onclick="App.logout()" class="sb-logout-btn w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors" style="color:#f87171; border:1px solid rgba(248,113,113,0.12); background:rgba(248,113,113,0.04); font-family:'Inter',sans-serif;">
        <i data-feather="log-out" class="w-4 h-4 shrink-0"></i>
        <span>Sair</span>
      </button>
    </div>
  `;

  // 7. Mobile header
  const mobileHeader = document.createElement('div');
  mobileHeader.id = 'ef-mobile-header';
  mobileHeader.className = 'lg:hidden fixed top-0 w-full z-40 px-4 py-3 flex items-center justify-between';
  mobileHeader.style.cssText = 'background:rgba(7,6,14,0.9); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-bottom:1px solid rgba(124,92,252,0.08);';
  mobileHeader.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:linear-gradient(135deg,#7c5cfc,#a855f7);">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      </div>
      <span class="font-bold" style="color:#e4dff0;font-family:'Sora',sans-serif;">EnemFlow <span style="background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">AI</span></span>
    </div>
    <button id="ef-mobile-menu-btn" class="p-2 rounded-lg" style="background:rgba(124,92,252,0.08); color:rgba(167,139,250,0.6);">
      <i data-feather="menu" class="w-5 h-5"></i>
    </button>
  `;

  // 8. Mobile overlay
  const overlay = document.createElement('div');
  overlay.id = 'ef-overlay';
  overlay.className = 'fixed inset-0 z-40 hidden lg:hidden';
  overlay.style.cssText = 'background:rgba(7,6,14,0.7); backdrop-filter:blur(6px);';

  // 9. Inject into DOM
  document.body.insertBefore(overlay, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);
  document.body.insertBefore(mobileHeader, document.body.firstChild);

  // 10. Adjust main content
  const main = document.querySelector('main');
  if (main) {
    main.classList.add('pt-16', 'lg:pt-0');
    if (window.innerWidth >= 1024) {
      main.style.marginLeft = isCollapsed ? 'var(--sb-collapsed)' : 'var(--sb-width)';
      main.style.transition = 'margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  }

  // 11. Toggle collapse
  const toggleBtn = document.getElementById('sb-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      localStorage.setItem('sidebar_collapsed', isCollapsed);
      sidebar.classList.toggle('collapsed', isCollapsed);
      toggleBtn.innerHTML = `<i data-feather="${isCollapsed ? 'chevrons-right' : 'chevrons-left'}" class="w-4 h-4"></i>`;
      if (main && window.innerWidth >= 1024) {
        main.style.marginLeft = isCollapsed ? 'var(--sb-collapsed)' : 'var(--sb-width)';
      }
      if (typeof feather !== 'undefined') feather.replace();
    });
  }

  // 12. Mobile menu
  const mobileBtn = document.getElementById('ef-mobile-menu-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      overlay.classList.remove('hidden');
    });
  }
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.add('hidden');
  });

  // 13. Window resize handler
  window.addEventListener('resize', () => {
    if (main) {
      if (window.innerWidth >= 1024) {
        main.style.marginLeft = isCollapsed ? 'var(--sb-collapsed)' : 'var(--sb-width)';
        sidebar.classList.remove('mobile-open');
        overlay.classList.add('hidden');
      } else {
        main.style.marginLeft = '0';
      }
    }
  });

  // 14. Load user profile and check admin
  async function loadSidebarProfile() {
    try {
      const user = await App.api('/auth/me');

      document.getElementById('sb-username').innerText = user.nome;
      document.getElementById('sb-xp').innerText = user.xp || 0;

      const avatarEl = document.getElementById('sb-avatar');
      if (user.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
        avatarEl.innerText = '';
      } else {
        avatarEl.innerText = user.nome.charAt(0).toUpperCase();
      }

      // Admin section
      if (user.role === 'admin') {
        const adminSection = document.getElementById('sb-admin-section');
        if (adminSection && !adminSection.querySelector('a')) {
          const isAdminActive = page === 'admin.html';
          adminSection.innerHTML = `
            <p class="sb-label px-4 text-[10px] font-bold uppercase tracking-widest mb-2 mt-5" style="color: rgba(251,191,36,0.4); font-family:'Sora',sans-serif;">Admin</p>
            <a href="admin.html" class="sb-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm mx-2 mb-0.5 ${
              isAdminActive ? '' : 'hover:bg-yellow-500/5'
            }" style="${isAdminActive ? 'background:rgba(251,191,36,0.12); color:#fbbf24; border-left:3px solid #f59e0b;' : 'color:rgba(251,191,36,0.5); border:1px solid rgba(251,191,36,0.1);'}; font-family:'Inter',sans-serif;">
              <i data-feather="shield" class="w-[18px] h-[18px] shrink-0" style="color:#fbbf24;"></i>
              <span class="sb-text">Painel Admin</span>
            </a>
          `;
          if (typeof feather !== 'undefined') feather.replace();
        }
      }
    } catch (err) {
      console.error('Sidebar profile error:', err.message);
      if (err.message && (err.message.includes('Sessão') || err.message.includes('Token') || err.message.includes('expirad'))) {
        App.logout();
      }
    }
  }

  loadSidebarProfile();
  if (typeof feather !== 'undefined') feather.replace();
});
