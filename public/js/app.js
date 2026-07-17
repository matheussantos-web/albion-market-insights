document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('mainNav').classList.toggle('open');
  });

  document.getElementById('mainNav').addEventListener('click', (e) => {
    if (e.target.classList.contains('nav-link')) {
      document.getElementById('mainNav').classList.remove('open');
    }
  });

  Router.init();
});
