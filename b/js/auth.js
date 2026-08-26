// ===== SISTEMA DE AUTENTICACIÓN SECRETA =====
const ADMIN_KEY = 'sauce2026'; // 🔑 Cambia esta clave por la que quieras
const STORAGE_KEY = 'admin_authenticated';

const Auth = {
  isAuthenticated: false,
  logoClicks: 0,
  lastClickTime: 0,

  init() {
    // Verificar sesión activa
    if (sessionStorage.getItem(STORAGE_KEY) === 'true') {
      this.isAuthenticated = true;
      this.showAdminUI();
    }

    // Atajo de teclado: Ctrl + Shift + A
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.promptLogin();
      }
    });

    // Clics secretos en el logo (5 clics rápidos)
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.addEventListener('click', () => {
        const now = Date.now();
        if (now - this.lastClickTime > 1000) {
          this.logoClicks = 1;
        } else {
          this.logoClicks++;
        }
        this.lastClickTime = now;

        if (this.logoClicks >= 5) {
          this.logoClicks = 0;
          this.promptLogin();
        }
      });
    }

    // FAB admin
    const fab = document.getElementById('adminFab');
    if (fab) {
      fab.addEventListener('click', () => this.toggleAdminMenu());
    }

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('adminMenu');
      const fab = document.getElementById('adminFab');
      if (menu && !menu.contains(e.target) && !fab?.contains(e.target)) {
        menu.classList.remove('active');
      }
    });
  },

  promptLogin() {
    if (this.isAuthenticated) {
      this.toggleAdminMenu();
      return;
    }

    const password = prompt('🔐 Acceso restringido\nIngresá la clave:');
    if (password === null) return;

    if (password === ADMIN_KEY) {
      this.isAuthenticated = true;
      sessionStorage.setItem(STORAGE_KEY, 'true');
      this.showAdminUI();
      this.showToast('✅ Acceso admin activado', 'success');
    } else if (password.trim() !== '') {
      this.showToast('❌ Clave incorrecta', 'error');
    }
  },

  showAdminUI() {
    const fab = document.getElementById('adminFab');
    if (fab) fab.classList.add('visible');
  },

  toggleAdminMenu() {
    const menu = document.getElementById('adminMenu');
    if (menu) menu.classList.toggle('active');
  },

  logout() {
    this.isAuthenticated = false;
    sessionStorage.removeItem(STORAGE_KEY);
    const fab = document.getElementById('adminFab');
    if (fab) fab.classList.remove('visible');
    const menu = document.getElementById('adminMenu');
    if (menu) menu.classList.remove('active');
    this.showToast('🔒 Sesión admin cerrada', 'success');
  },

  showToast(message, type = 'info') {
    // Buscar o crear toast
    let toast = document.getElementById('globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast active ${type}`;
    setTimeout(() => toast.classList.remove('active'), 3000);
  },

  requireAuth(callback) {
    if (!this.isAuthenticated) {
      this.promptLogin();
      return false;
    }
    callback();
    return true;
  }
};

// Inicializar cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => Auth.init());