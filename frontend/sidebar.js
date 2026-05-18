// =========================================================================
// ENEMFLOW AI — Dynamic, Collapsible & Persistent Sidebar
// Automatically injected across all platform pages.
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Check authentication first
  if (!localStorage.getItem('token') && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('reset-password.html')) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Identify the active page to highlight the active menu item
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'dashboard.html';

  // 3. Retrieve or default collapsed state from localStorage
  let isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';

  // 4. Inject fonts and custom styles dynamically for the Sidebar
  if (!document.getElementById('sidebar-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'sidebar-styles';
    styleEl.innerHTML = `
      .sidebar-transition {
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .sidebar-collapsed {
        width: 80px !important;
      }
      .sidebar-collapsed .logo-text,
      .sidebar-collapsed .menu-label,
      .sidebar-collapsed .link-text,
      .sidebar-collapsed .user-details {
        display: none !important;
      }
      .sidebar-collapsed .nav-item {
        justify-content: center !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .sidebar-collapsed .logo-container {
        justify-content: center !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .sidebar-collapsed .user-container {
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
      }
      .sidebar-collapsed .logout-btn span {
        display: none !important;
      }
      .sidebar-collapsed .logout-btn {
        justify-content: center !important;
        padding: 10px !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 5. Create Sidebar Container (Aside)
  const sidebar = document.createElement('aside');
  sidebar.id = 'dynamic-sidebar';
  sidebar.className = `sidebar-transition fixed lg:sticky top-0 left-0 h-screen bg-white/75 dark:bg-[#0c0c0e]/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-white/10 z-50 flex flex-col -translate-x-full lg:translate-x-0 ${isCollapsed ? 'sidebar-collapsed w-[80px]' : 'w-64'}`;

  // 6. Sidebar Header (Logo and Collapse Toggle button)
  const header = document.createElement('div');
  header.className = 'p-6 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 logo-container';
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
        <i data-feather="zap" class="w-5 h-5"></i>
      </div>
      <span class="text-xl font-bold tracking-tight logo-text">EnemFlow <span class="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">AI</span></span>
    </div>
    <button id="toggleSidebarBtn" class="hidden lg:flex p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 logo-text">
      <i data-feather="${isCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
    </button>
  `;
  sidebar.appendChild(header);

  // 7. Sidebar Menu List
  const menuList = document.createElement('div');
  menuList.className = 'p-4 flex-1 overflow-y-auto space-y-1 scrollbar-thin';

  // Base Menu items definition
  const menuItems = [
    { title: 'Dashboard', icon: 'home', url: 'dashboard.html', category: 'Menu Principal' },
    { title: 'Matérias', icon: 'book-open', url: 'materias.html', category: 'Menu Principal' },
    { title: 'Tutor IA', icon: 'message-circle', url: 'chat.html', category: 'Menu Principal' },
    { title: 'Plano de Estudos', icon: 'calendar', url: 'plan.html', category: 'Menu Principal' },
    { title: 'Questões ENEM', icon: 'check-square', url: 'exercises.html', category: 'Menu Principal' },
    { title: 'Histórico', icon: 'clock', url: 'history.html', category: 'Sua Conta' },
    { title: 'Configurações', icon: 'settings', url: 'settings.html', category: 'Sua Conta' }
  ];

  // Helper to inject items
  let currentCategory = '';
  menuItems.forEach(item => {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      const label = document.createElement('p');
      label.className = 'px-4 text-xs font-semibold text-slate-400/80 dark:text-slate-500 uppercase tracking-wider mb-2 mt-4 menu-label';
      label.innerText = currentCategory;
      menuList.appendChild(label);
    }

    const isActive = page === item.url;
    const a = document.createElement('a');
    a.href = item.url;
    a.className = `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 nav-item ${
      isActive 
        ? 'bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500' 
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
    }`;
    a.innerHTML = `
      <i data-feather="${item.icon}" class="w-5 h-5 shrink-0"></i>
      <span class="link-text text-sm">${item.title}</span>
    `;
    menuList.appendChild(a);
  });

  sidebar.appendChild(menuList);

  // 8. Sidebar Footer (User Info & Logout)
  const footer = document.createElement('div');
  footer.className = 'p-4 border-t border-slate-200/80 dark:border-white/10';
  footer.innerHTML = `
    <div class="flex items-center gap-3 px-4 mb-4 user-container cursor-pointer" onclick="window.location.href='perfil.html'">
      <div id="sidebarUserAvatar" class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center font-bold text-lg bg-cover bg-center shrink-0">?</div>
      <div class="overflow-hidden user-details">
        <p id="sidebarUserName" class="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">Carregando...</p>
        <p class="text-xs text-indigo-500 font-medium"><span id="sidebarUserXP">0</span> XP Acumulado</p>
      </div>
    </div>
    <button onclick="App.logout()" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-semibold text-sm border border-red-200 dark:border-red-500/20 logout-btn">
      <i data-feather="log-out" class="w-4 h-4 shrink-0"></i>
      <span>Sair da conta</span>
    </button>
  `;
  sidebar.appendChild(footer);

  // 9. Inject Mobile Header & Overlay
  const mobileHeader = document.createElement('div');
  mobileHeader.className = 'lg:hidden fixed top-0 w-full bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl z-40 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-white/10';
  mobileHeader.innerHTML = `
    <div class="flex items-center gap-2">
      <i data-feather="zap" class="text-indigo-500 w-5 h-5"></i>
      <span class="font-bold text-slate-800 dark:text-white">EnemFlow <span class="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">AI</span></span>
    </div>
    <button id="mobileMenuBtnDynamic" class="p-2 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-400">
      <i data-feather="menu" class="w-5 h-5"></i>
    </button>
  `;

  const mobileOverlay = document.createElement('div');
  mobileOverlay.id = 'sidebar-overlay';
  mobileOverlay.className = 'fixed inset-0 bg-black/50 z-40 hidden lg:hidden backdrop-blur-sm';

  // 10. Auto-inject elements into the DOM
  const body = document.body;
  
  // Clean up any existing sidebars or headers first to prevent duplication
  const oldSidebar = document.getElementById('sidebar');
  if (oldSidebar) oldSidebar.remove();
  const oldSidebarClass = document.querySelector('.sidebar');
  if (oldSidebarClass && oldSidebarClass.id !== 'dynamic-sidebar') oldSidebarClass.remove();
  const oldMobileHeader = document.querySelector('.lg\\:hidden.fixed.top-0.w-full');
  if (oldMobileHeader) oldMobileHeader.remove();
  const oldMobileHeaderClass = document.querySelector('.mobile-top-actions');
  if (oldMobileHeaderClass) oldMobileHeaderClass.remove();
  const oldOverlay = document.getElementById('mobileOverlay');
  if (oldOverlay) oldOverlay.remove();

  // Inject our dynamic premium layout elements
  body.insertBefore(mobileOverlay, body.firstChild);
  body.insertBefore(sidebar, body.firstChild);
  body.insertBefore(mobileHeader, body.firstChild);

  // Adjust container margins on pages so the main content starts after the sidebar or has a proper padding on desktop
  const main = document.querySelector('main');
  if (main) {
    main.classList.add('lg:pl-0');
    // Ensure padding-top is present for mobile header
    main.classList.add('pt-16', 'lg:pt-0');
  }

  // 11. Interactive Event Handlers
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      localStorage.setItem('sidebar_collapsed', isCollapsed);
      if (isCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        sidebar.style.width = '80px';
        toggleBtn.innerHTML = '<i data-feather="chevron-right" class="w-4 h-4"></i>';
      } else {
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.style.width = '16rem'; // w-64
        toggleBtn.innerHTML = '<i data-feather="chevron-left" class="w-4 h-4"></i>';
      }
      feather.replace();
    });
  }

  // Mobile drawer controls
  const mobileMenuBtn = document.getElementById('mobileMenuBtnDynamic');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.remove('-translate-x-full');
      mobileOverlay.classList.remove('hidden');
    });
  }

  mobileOverlay.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    mobileOverlay.classList.add('hidden');
  });

  // 12. Load User Profile and Check Admin Role
  async function loadSidebarProfile() {
    try {
      const user = await App.api('/auth/me');
      
      // Update sidebar texts
      document.getElementById('sidebarUserName').innerText = user.nome;
      document.getElementById('sidebarUserXP').innerText = user.xp;
      
      const avatarEl = document.getElementById('sidebarUserAvatar');
      if (user.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
        avatarEl.innerText = '';
      } else {
        avatarEl.innerText = user.nome.charAt(0).toUpperCase();
      }

      // Check if user is admin, if so, inject the Admin Control panel!
      if (user.role === 'admin') {
        const hasAdminLink = Array.from(menuList.querySelectorAll('a')).some(a => a.getAttribute('href') === 'admin.html');
        if (!hasAdminLink) {
          const adminLabel = document.createElement('p');
          adminLabel.className = 'px-4 text-xs font-semibold text-yellow-500/80 uppercase tracking-wider mb-2 mt-6 menu-label';
          adminLabel.innerText = 'Administração';
          menuList.appendChild(adminLabel);

          const adminLink = document.createElement('a');
          adminLink.href = 'admin.html';
          adminLink.className = `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all duration-200 border border-yellow-500/20 ${
            page === 'admin.html'
              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-l-4 border-yellow-500'
              : 'text-yellow-600 dark:text-yellow-500/80 hover:bg-yellow-500/10'
          }`;
          adminLink.innerHTML = `
            <i data-feather="shield" class="w-5 h-5 shrink-0 text-yellow-500"></i>
            <span class="link-text text-sm">Painel Admin</span>
          `;
          menuList.appendChild(adminLink);
          feather.replace();
        }
      }
    } catch (err) {
      console.error('Sidebar error fetching user:', err.message);
      if (err.message.includes('Sessão') || err.message.includes('Token')) {
        App.logout();
      }
    }
  }

  loadSidebarProfile();
  feather.replace();
});
