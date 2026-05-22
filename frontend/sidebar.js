// =========================================================================
// ENEMFLOW AI — Dynamic, Collapsible & Persistent Sidebar v4.0
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

  // If on admin, owner panel, or chat (immersive tutor), don't show student sidebar navigation
  if (page === 'admin.html' || page === 'owner.html' || page === 'chat.html') {
    // Clean up any old sidebar elements if they exist
    ['sidebar', 'dynamic-sidebar', 'ef-sidebar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.mobile-top-actions, .sidebar, #ef-mobile-header, #ef-overlay').forEach(el => el.remove());
    const main = document.querySelector('main');
    if (main) {
      main.style.marginLeft = '0';
      main.style.paddingTop = '0';
    }
    return;
  }

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
  if (!document.getElementById('sidebar-styles-v4')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'sidebar-styles-v4';
    styleEl.textContent = `
      :root {
        --sb-width: 260px;
        --sb-collapsed: 72px;
      }
      #ef-sidebar {
        width: var(--sb-width);
        transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        overflow-x: hidden;
      }
      #ef-sidebar.collapsed {
        width: var(--sb-collapsed) !important;
        background: transparent !important;
        border-right: none !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        /* IMPORTANT: overflow must be visible so the bolt button is NOT clipped */
        overflow: visible !important;
      }
      /* Hide elements completely when collapsed */
      #ef-sidebar.collapsed .sb-logo-full-wrap,
      #ef-sidebar.collapsed .sb-toggle-area,
      #ef-sidebar.collapsed nav,
      #ef-sidebar.collapsed .sb-footer-container {
        display: none !important;
      }
      /* When collapsed: header is just a centered column holding the bolt */
      #ef-sidebar.collapsed .sb-header-container {
        width: var(--sb-collapsed) !important;
        height: 80px !important;
        border-bottom: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        cursor: pointer;
      }
      #ef-sidebar.collapsed .sb-logo-bolt-wrap {
        display: flex !important;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 14px;
        border: 1px solid rgba(124,92,252,0.25);
        background: rgba(15, 12, 30, 0.85);
        box-shadow: 0 0 24px rgba(124,92,252,0.35), inset 0 1px 0 rgba(255,255,255,0.05);
        animation: sb-bolt-float 3s ease-in-out infinite;
        transition: box-shadow 0.3s ease, transform 0.3s ease;
        /* Prevent the button itself from being clipped by parent overflow */
        position: relative;
        z-index: 10;
      }
      #ef-sidebar.collapsed .sb-logo-bolt-wrap:hover {
        transform: scale(1.1);
        box-shadow: 0 0 36px rgba(124,92,252,0.55), inset 0 1px 0 rgba(255,255,255,0.08);
      }
      #ef-sidebar:not(.collapsed) .sb-logo-bolt-wrap {
        display: none !important;
      }
      
      @keyframes sb-bolt-float {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-4px) scale(1.03); }
      }

      /* Main content offset */
      @media (min-width: 1024px) {
        body:has(#ef-sidebar) main {
          margin-left: var(--sb-width);
          transition: margin-left 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
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
  sidebar.className = `hidden lg:flex fixed top-0 left-0 h-screen flex-col border-r z-50 ${isCollapsed ? 'collapsed' : ''}`;
  sidebar.style.cssText = `background: rgba(10,8,20,0.96); backdrop-filter: blur(35px) saturate(1.5); -webkit-backdrop-filter: blur(35px) saturate(1.5); border-color: rgba(124,92,252,0.08);`;

  // Menu items — NO emojis, only feather icons
  const menuItems = [
    { title: 'Dashboard', icon: 'home', url: 'dashboard.html', cat: 'Menu Principal' },
    { title: 'Matérias', icon: 'book-open', url: 'materias.html', cat: 'Menu Principal' },
    { title: 'Tutor IA', icon: 'cpu', url: 'chat.html', cat: 'Menu Principal' },
    { title: 'Plano de Estudos', icon: 'calendar', url: 'plan.html', cat: 'Menu Principal' },
    { title: 'Simulados', icon: 'check-square', url: 'exercises.html', cat: 'Menu Principal' },
    { title: 'Mapa de Habilidades', icon: 'share-2', url: 'skills.html', cat: 'Menu Principal' },
    { title: 'Progresso', icon: 'bar-chart-2', url: 'progresso.html', cat: 'Sua Conta' },
    { title: 'Histórico', icon: 'clock', url: 'history.html', cat: 'Sua Conta' }
  ];

  let menuHtml = '';
  let lastCat = '';
  menuItems.forEach(item => {
    if (item.cat !== lastCat) {
      lastCat = item.cat;
      menuHtml += `<p class="sb-label px-4 text-[10px] font-bold uppercase tracking-widest mb-2 mt-5" style="color: rgba(167,139,250,0.35); font-family:'Sora',sans-serif;">${item.cat}</p>`;
    }
    const isActive = page === item.url;
    
    const iconHtml = `<i data-feather="${item.icon}" class="w-[18px] h-[18px] shrink-0" ${isActive ? 'style="color:#a78bfa;"' : ''}></i>`;

    menuHtml += `
      <a href="${item.url}" class="sb-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm mx-2 mb-0.5 ${
        isActive ? 'text-white' : 'hover:bg-white/5'
      }" style="${isActive 
        ? 'background: rgba(124,92,252,0.15); color: #c4b5fd; border-left: 3px solid #7c5cfc; box-shadow: 0 0 20px rgba(124,92,252,0.08);' 
        : 'color: rgba(196,188,220,0.6);'}; font-family:'Inter',sans-serif;">
        ${iconHtml}
        <span class="sb-text">${item.title}</span>
      </a>
    `;
  });

  sidebar.innerHTML = `
    <div class="sb-header-container px-5 py-5 flex items-center justify-between transition-all duration-300" style="border-bottom: 1px solid rgba(124,92,252,0.08);">
      <!-- Full Logo (when expanded) -->
      <div class="sb-logo-full-wrap flex items-center gap-2.5" style="padding-left: 2px; padding-top: 2px; padding-bottom: 2px;">
        <!-- O raio agora é o botão para encolher -->
        <div class="cursor-pointer w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(124,92,252,0.4)] border border-violet-500/20 hover:scale-105 transition-transform" style="background: rgba(15,12,30,0.6); margin: 2px;">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="boltGradExpanded" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#7c5cfc" />
                <stop offset="100%" stop-color="#ec4899" />
              </linearGradient>
            </defs>
            <path d="M13 2L5.5 13H11.5L9.5 22L18.5 11H12.5L13 2Z" fill="url(#boltGradExpanded)" />
          </svg>
        </div>
        <a href="dashboard.html" style="text-decoration:none;" class="hover:opacity-80 transition-opacity">
          <span class="sb-logo-text text-2xl font-extrabold tracking-tight logo-text-gradient" style="font-family:'Sora',sans-serif;">EnemFlow</span>
        </a>
      </div>
      
      <!-- Collapsed Logo (floating bolt) -->
      <div class="sb-logo-bolt-wrap cursor-pointer">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="boltGradCollapsed" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#7c5cfc" />
              <stop offset="100%" stop-color="#ec4899" />
            </linearGradient>
          </defs>
          <path d="M13 2L5.5 13H11.5L9.5 22L18.5 11H12.5L13 2Z" fill="url(#boltGradCollapsed)" />
        </svg>
      </div>
    </div>

    <!-- Toggle Button Area (Desktop only) -->
    <div class="sb-toggle-area hidden lg:flex px-4 py-2 justify-end">
      <button id="sb-toggle-btn" class="p-1.5 rounded-lg transition-all duration-300" style="background:rgba(124,92,252,0.06); color:rgba(167,139,250,0.5);" title="Expandir/Recolher">
        <i data-feather="${isCollapsed ? 'chevrons-right' : 'chevrons-left'}" class="w-4 h-4"></i>
      </button>
    </div>

    <!-- Navigation List -->
    <nav class="flex-1 overflow-y-auto py-2" style="scrollbar-width:none;-ms-overflow-style:none;">
      ${menuHtml}
      <div id="sb-admin-section"></div>
    </nav>

    <!-- Footer Container -->
    <div class="sb-footer-container px-3 py-4" style="border-top: 1px solid rgba(124,92,252,0.08);">
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

  // 7. Mobile Top Header (Minimal)
  const mobileHeader = document.createElement('div');
  mobileHeader.id = 'ef-mobile-header';
  mobileHeader.className = 'lg:hidden fixed top-0 w-full z-40 px-4 py-3 flex items-center justify-between';
  mobileHeader.style.cssText = 'background:rgba(7,6,14,0.85); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-bottom:1px solid rgba(124,92,252,0.08);';
  mobileHeader.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(124,92,252,0.3)] border border-violet-500/20" style="background: rgba(15,12,30,0.6);">
        <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="boltGradMobile" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#7c5cfc" />
              <stop offset="100%" stop-color="#ec4899" />
            </linearGradient>
          </defs>
          <path d="M13 2L5.5 13H11.5L9.5 22L18.5 11H12.5L13 2Z" fill="url(#boltGradMobile)" />
        </svg>
      </div>
      <span class="text-xl font-extrabold logo-text-gradient" style="font-family:'Sora',sans-serif;">EnemFlow</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1 bg-violet-500/10 px-2 py-1 rounded-md border border-violet-500/20">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" style="color:#a78bfa;">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span id="sb-mobile-xp" class="text-xs font-bold text-violet-300">0</span>
      </div>
      <a href="perfil.html" class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-cover bg-center border border-white/10" style="background-color:rgba(124,92,252,0.2);color:#a78bfa;" id="sb-mobile-avatar">?</a>
    </div>
  `;

  // 8. Mobile Bottom Navigation
  // The 5th item opens a slim bottom-sheet for secondary nav links
  const bottomNavItems = [
    { title: 'Início', icon: 'home', url: 'dashboard.html' },
    { title: 'Matérias', icon: 'book-open', url: 'materias.html' },
    { title: 'Tutor IA', icon: 'cpu', url: 'chat.html' },
    { title: 'Simulados', icon: 'check-square', url: 'exercises.html' },
    { title: 'Mais', icon: 'more-horizontal', url: 'javascript:void(0)', isMenu: true }
  ];

  let bottomNavHtml = '';
  bottomNavItems.forEach(item => {
    const isActive = page === item.url;
    const color = isActive ? '#c4b5fd' : 'rgba(196,188,220,0.5)';
    const bg = isActive ? 'rgba(124,92,252,0.15)' : 'transparent';
    const clickAttr = item.isMenu ? 'onclick="document.getElementById(\'ef-mobile-sheet\').classList.toggle(\'translate-y-full\')"' : `href="${item.url}"`;
    const tag = item.isMenu ? 'button' : 'a';
    
    bottomNavHtml += `
      <${tag} ${clickAttr} class="flex flex-col items-center justify-center w-full py-2 gap-1 rounded-xl transition-all duration-200" style="color: ${color}; background: ${bg};">
        <i data-feather="${item.icon}" class="w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(124,92,252,0.8)]' : ''}" ${isActive ? 'style="color:#a78bfa;"' : ''}></i>
        <span style="font-size:11px; font-weight:500; font-family:'Inter',sans-serif;">${item.title}</span>
      </${tag}>
    `;
  });

  const bottomNav = document.createElement('nav');
  bottomNav.id = 'ef-bottom-nav';
  bottomNav.className = 'lg:hidden fixed bottom-0 w-full z-50 px-2 pt-2 flex justify-between items-center';
  bottomNav.style.cssText = 'background:rgba(7,6,14,0.92); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-top:1px solid rgba(124,92,252,0.12); padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));';
  bottomNav.innerHTML = bottomNavHtml;

  // 8.5 Mobile Bottom Sheet (secondary nav - slides up from bottom)
  const mobileFullMenu = document.createElement('div');
  mobileFullMenu.id = 'ef-mobile-sheet';
  // Starts hidden off-screen at the bottom
  mobileFullMenu.className = 'lg:hidden fixed inset-x-0 bottom-16 z-[60] rounded-t-3xl transition-transform duration-300 ease-out translate-y-full';
  mobileFullMenu.style.cssText = 'background:rgba(10,8,22,0.98); backdrop-filter:blur(30px); -webkit-backdrop-filter:blur(30px); border-top:1px solid rgba(124,92,252,0.15); box-shadow: 0 -20px 60px rgba(0,0,0,0.5);';
  
  // Secondary links NOT shown in bottom nav
  const secondaryItems = [
    { title: 'Plano de Estudos', icon: 'calendar', url: 'plan.html' },
    { title: 'Progresso', icon: 'bar-chart-2', url: 'progresso.html' },
    { title: 'Histórico', icon: 'clock', url: 'history.html' },
    { title: 'Habilidades', icon: 'share-2', url: 'skills.html' },
    { title: 'Anotações', icon: 'edit', url: 'anotacoes.html' },
    { title: 'Perfil', icon: 'user', url: 'perfil.html' },
    { title: 'Configurações', icon: 'settings', url: 'settings.html' },
  ];

  let sheetHtml = `
    <div class="flex items-center justify-between px-5 pt-5 pb-3">
      <h3 class="font-bold text-base" style="font-family:'Sora',sans-serif; color:#e4dff0;">Mais opções</h3>
      <button onclick="document.getElementById('ef-mobile-sheet').classList.add('translate-y-full')" style="color:rgba(196,188,220,0.4);">
        <i data-feather="x" class="w-5 h-5"></i>
      </button>
    </div>
    <div class="grid grid-cols-4 gap-2 px-4 pb-4">
  `;
  secondaryItems.forEach(item => {
    const isActive = page === item.url;
    sheetHtml += `
      <a href="${item.url}" class="flex flex-col items-center justify-center p-3 rounded-2xl transition-colors gap-2 text-center" style="background:${isActive ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(124,92,252,0.3)' : 'rgba(255,255,255,0.05)'};">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:rgba(124,92,252,0.08); color:${isActive ? '#a78bfa' : 'rgba(196,188,220,0.6)'};">
          <i data-feather="${item.icon}" class="w-4 h-4"></i>
        </div>
        <span style="font-size:10px; font-weight:500; font-family:'Inter',sans-serif; color:${isActive ? '#c4b5fd' : 'rgba(196,188,220,0.65)'}; line-height:1.2;">${item.title}</span>
      </a>
    `;
  });
  sheetHtml += `
    </div>
    <div class="px-4 pb-5">
      <button onclick="App.logout()" class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold" style="color:#f87171; border:1px solid rgba(248,113,113,0.12); background:rgba(248,113,113,0.04); font-family:'Inter',sans-serif;">
        <i data-feather="log-out" class="w-4 h-4 shrink-0"></i>
        <span>Sair da Conta</span>
      </button>
    </div>
  `;
  mobileFullMenu.innerHTML = sheetHtml;

  // Tap backdrop to close sheet
  const sheetBackdrop = document.createElement('div');
  sheetBackdrop.id = 'ef-sheet-backdrop';
  sheetBackdrop.className = 'lg:hidden fixed inset-0 z-[55] hidden';
  sheetBackdrop.style.cssText = 'background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);';
  sheetBackdrop.addEventListener('click', () => {
    document.getElementById('ef-mobile-sheet').classList.add('translate-y-full');
    sheetBackdrop.classList.add('hidden');
  });

  // Toggle backdrop when sheet opens/closes
  const observer = new MutationObserver(() => {
    const isOpen = !mobileFullMenu.classList.contains('translate-y-full');
    sheetBackdrop.classList.toggle('hidden', !isOpen);
  });
  observer.observe(mobileFullMenu, { attributes: true, attributeFilter: ['class'] });

  // 9. Inject into DOM
  document.body.insertBefore(sheetBackdrop, document.body.firstChild);
  document.body.insertBefore(mobileFullMenu, document.body.firstChild);
  document.body.insertBefore(bottomNav, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);
  document.body.insertBefore(mobileHeader, document.body.firstChild);

  // 10. Adjust main content offset
  const main = document.querySelector('main');
  if (main) {
    main.classList.add('pt-16', 'lg:pt-0', 'pb-24', 'lg:pb-0'); // Added pb-24 for bottom nav
    if (window.innerWidth >= 1024) {
      main.style.marginLeft = isCollapsed ? 'var(--sb-collapsed)' : 'var(--sb-width)';
      main.style.transition = 'margin-left 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
    }
  }

  // Helper toggle collapse function
  function toggleSidebar() {
    isCollapsed = !isCollapsed;
    localStorage.setItem('sidebar_collapsed', isCollapsed);
    sidebar.classList.toggle('collapsed', isCollapsed);
    const btn = document.getElementById('sb-toggle-btn');
    if (btn) {
      btn.innerHTML = `<i data-feather="${isCollapsed ? 'chevrons-right' : 'chevrons-left'}" class="w-4 h-4"></i>`;
    }
    if (main && window.innerWidth >= 1024) {
      main.style.marginLeft = isCollapsed ? 'var(--sb-collapsed)' : 'var(--sb-width)';
    }
    if (typeof feather !== 'undefined') feather.replace();
  }

  // Click on toggle button
  const toggleBtn = document.getElementById('sb-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  // Click on collapsed floating bolt logo or full logo to toggle
  const headerContainer = sidebar.querySelector('.sb-header-container');
  if (headerContainer) {
    headerContainer.style.cursor = 'pointer';
    headerContainer.addEventListener('click', (e) => {
      // Don't toggle if they clicked exactly on a link inside it
      if (e.target.closest('a') && !sidebar.classList.contains('collapsed')) return;
      e.preventDefault();
      toggleSidebar();
    });
  }

  // 13. Window resize handler
  window.addEventListener('resize', () => {
    if (main) {
      if (window.innerWidth >= 1024) {
        main.style.marginLeft = isCollapsed ? 'var(--sb-collapsed)' : 'var(--sb-width)';
        document.getElementById('ef-mobile-full-menu')?.classList.add('hidden');
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
      
      const mobileXp = document.getElementById('sb-mobile-xp');
      if (mobileXp) mobileXp.innerText = user.xp || 0;

      const avatarEl = document.getElementById('sb-avatar');
      const mobileAvatarEl = document.getElementById('sb-mobile-avatar');
      
      if (user.avatarUrl) {
        if (avatarEl) {
          avatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
          avatarEl.innerText = '';
        }
        if (mobileAvatarEl) {
          mobileAvatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
          mobileAvatarEl.innerText = '';
        }
      } else {
        const initial = user.nome.charAt(0).toUpperCase();
        if (avatarEl) avatarEl.innerText = initial;
        if (mobileAvatarEl) mobileAvatarEl.innerText = initial;
      }

      // Admin / Owner section
      if (user.role === 'admin' || user.role === 'owner') {
        const adminSection = document.getElementById('sb-admin-section');
        if (adminSection && !adminSection.querySelector('a')) {
          const isAdminActive = page === 'admin.html';
          const isOwnerActive = page === 'owner.html';
          
          let htmlContent = '';
          
          // Se for admin normal
          if (user.role === 'admin') {
            htmlContent = `
              <p class="sb-label px-4 text-[10px] font-bold uppercase tracking-widest mb-2 mt-5" style="color: rgba(251,191,36,0.4); font-family:'Sora',sans-serif;">Admin</p>
              <a href="admin.html" class="sb-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm mx-2 mb-0.5 ${
                isAdminActive ? '' : 'hover:bg-yellow-500/5'
              }" style="${isAdminActive ? 'background:rgba(251,191,36,0.12); color:#fbbf24; border-left:3px solid #f59e0b;' : 'color:rgba(251,191,36,0.5); border:1px solid rgba(251,191,36,0.1);'}; font-family:'Inter',sans-serif;">
                <i data-feather="shield" class="w-[18px] h-[18px] shrink-0" style="color:#fbbf24;"></i>
                <span class="sb-text">Painel Admin</span>
              </a>
            `;
          }
          
          // Se for owner (Administrador principal)
          if (user.role === 'owner') {
            htmlContent = `
              <p class="sb-label px-4 text-[10px] font-bold uppercase tracking-widest mb-2 mt-5" style="color: rgba(236,72,153,0.4); font-family:'Sora',sans-serif;">Administração Principal</p>
              <a href="admin.html" class="sb-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm mx-2 mb-1 ${
                isAdminActive ? '' : 'hover:bg-violet-500/5'
              }" style="${isAdminActive ? 'background:rgba(124,92,252,0.12); color:#c4b5fd; border-left:3px solid #7c5cfc;' : 'color:rgba(196,188,220,0.6); border:1px solid rgba(124,92,252,0.1);'}; font-family:'Inter',sans-serif;">
                <i data-feather="shield" class="w-[18px] h-[18px] shrink-0" style="color:#7c5cfc;"></i>
                <span class="sb-text">Painel Admin</span>
              </a>
              <a href="owner.html" class="sb-nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 text-sm mx-2 mb-0.5 ${
                isOwnerActive ? '' : 'hover:bg-pink-500/5'
              }" style="${isOwnerActive ? 'background:rgba(236,72,153,0.15); color:#f472b6; border-left:3px solid #ec4899;' : 'color:rgba(236,72,153,0.7); border:1px solid rgba(236,72,153,0.12);'}; font-family:'Inter',sans-serif;">
                <i data-feather="key" class="w-[18px] h-[18px] shrink-0" style="color:#ec4899;"></i>
                <span class="sb-text">Painel Owner</span>
              </a>
            `;
          }
          
          adminSection.innerHTML = htmlContent;
          if (typeof feather !== 'undefined') feather.replace();
        }
      }

      // Adiciona botão flutuante de retorno se for admin/owner nas páginas de estudante
      if (user.role === 'admin' || user.role === 'owner') {
        const returnUrl = user.role === 'owner' ? 'owner.html' : 'admin.html';
        
        // Verifica se o botão já existe
        if (!document.getElementById('admin-floating-return')) {
          const floatingBtn = document.createElement('div');
          floatingBtn.id = 'admin-floating-return';
          floatingBtn.className = 'fixed bottom-6 right-6 z-[9999]';
          floatingBtn.innerHTML = `
            <button onclick="window.location.href='${returnUrl}'" class="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-extrabold text-xs shadow-2xl shadow-violet-600/35 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/10" style="font-family:'Sora',sans-serif; letter-spacing: 0.5px;">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Voltar ao Painel Master
            </button>
          `;
          document.body.appendChild(floatingBtn);
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
