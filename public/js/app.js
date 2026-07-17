function updateAuthUI() {
  const authArea = document.getElementById('authArea');
  if (!authArea) return;

  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      const initial = (user.display_name || user.username).charAt(0).toUpperCase();
      authArea.innerHTML = `
        <div class="auth-user-wrap">
          <div class="auth-avatar">${initial}</div>
          <span class="auth-user">${user.display_name || user.username}</span>
        </div>
        <button class="auth-btn auth-btn-logout" id="logoutBtn">Sair</button>
      `;
      document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
          });
        } catch (e) {}
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        updateAuthUI();
        Router.navigate('/');
      });
    } catch (e) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      authArea.innerHTML = '<a href="#/login" class="auth-btn">Entrar</a>';
    }
  } else {
    authArea.innerHTML = '<a href="#/login" class="auth-btn">Entrar</a>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mainNav').classList.toggle('open');
  });

  document.getElementById('mainNav').addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-link')) {
      document.getElementById('mainNav').classList.remove('open');
    }
  });

  updateAuthUI();
  Router.init();
});
