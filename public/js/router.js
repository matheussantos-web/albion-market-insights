const Router = {
  routes: {},
  currentPage: null,

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = path;
  },

  init() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  },

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const hashPath = hash.split('?')[0];
    const [path, ...paramParts] = hashPath.split('/').filter(Boolean);
    const route = '/' + (path || '');

    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.getAttribute('href') === '#' + hash || (route === '/' && el.dataset.page === 'home'));
    });

    const app = document.getElementById('app');
    const handler = this.routes[route];
    if (handler) {
      this.currentPage = path || 'home';
      handler(app, paramParts.join('/'));
    } else {
      app.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Página não encontrada</p></div>`;
    }

    window.scrollTo(0, 0);
  }
};
