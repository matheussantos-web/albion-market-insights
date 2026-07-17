Router.register('/login', async (app) => {
  app.innerHTML = `
    <div style="max-width:400px;margin:3rem auto;padding:0 1.5rem">
      <div class="card">
        <div style="text-align:center;margin-bottom:1.5rem">
          <img src="/img/logo.png" alt="Logo" style="height:60px;width:auto;margin-bottom:0.5rem" />
          <h2 style="font-size:1rem;font-weight:700">Entrar</h2>
          <p style="font-size:0.7rem;color:var(--text-dim)">Acesse sua conta para recursos exclusivos</p>
        </div>

        <div id="loginError" style="display:none;background:rgba(248,113,113,0.1);border:1px solid var(--red);border-radius:6px;padding:0.5rem 0.75rem;color:var(--red);font-size:0.75rem;margin-bottom:1rem"></div>

        <div style="display:flex;flex-direction:column;gap:0.8rem">
          <div>
            <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Username</label>
            <input type="text" class="input" id="loginUser" placeholder="Seu username" style="width:100%;font-size:0.85rem" autocomplete="username" />
          </div>
          <div>
            <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Senha</label>
            <input type="password" class="input" id="loginPass" placeholder="Sua senha" style="width:100%;font-size:0.85rem" autocomplete="current-password" />
          </div>
          <button class="btn btn-gold" id="loginBtn" style="width:100%;padding:0.6rem">Entrar</button>
        </div>

        <div style="text-align:center;margin-top:1.2rem">
          <span style="font-size:0.7rem;color:var(--text-dim)">Não tem conta?</span>
          <a href="#/register" style="font-size:0.7rem;font-weight:600"> Criar conta</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');

    if (!username || !password) {
      errEl.textContent = 'Preencha todos os campos';
      errEl.style.display = 'block';
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Erro ao fazer login';
        errEl.style.display = 'block';
        return;
      }
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({ username: data.username, display_name: data.display_name, role: data.role }));
      updateAuthUI();
      Router.navigate('/');
    } catch (e) {
      errEl.textContent = 'Erro de conexão';
      errEl.style.display = 'block';
    }
  });

  document.getElementById('loginPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });
});

Router.register('/register', async (app) => {
  app.innerHTML = `
    <div style="max-width:400px;margin:3rem auto;padding:0 1.5rem">
      <div class="card">
        <div style="text-align:center;margin-bottom:1.5rem">
          <img src="/img/logo.png" alt="Logo" style="height:60px;width:auto;margin-bottom:0.5rem" />
          <h2 style="font-size:1rem;font-weight:700">Criar Conta</h2>
          <p style="font-size:0.7rem;color:var(--text-dim)">Registre-se para acessar o painel</p>
        </div>

        <div id="regError" style="display:none;background:rgba(248,113,113,0.1);border:1px solid var(--red);border-radius:6px;padding:0.5rem 0.75rem;color:var(--red);font-size:0.75rem;margin-bottom:1rem"></div>

        <div style="display:flex;flex-direction:column;gap:0.8rem">
          <div>
            <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Username</label>
            <input type="text" class="input" id="regUser" placeholder="Escolha um username" style="width:100%;font-size:0.85rem" autocomplete="username" />
          </div>
          <div>
            <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Nome de exibição</label>
            <input type="text" class="input" id="regDisplay" placeholder="Seu nome (opcional)" style="width:100%;font-size:0.85rem" />
          </div>
          <div>
            <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Senha</label>
            <input type="password" class="input" id="regPass" placeholder="Mínimo 4 caracteres" style="width:100%;font-size:0.85rem" autocomplete="new-password" />
          </div>
          <button class="btn btn-gold" id="regBtn" style="width:100%;padding:0.6rem">Criar Conta</button>
        </div>

        <div style="text-align:center;margin-top:1.2rem">
          <span style="font-size:0.7rem;color:var(--text-dim)">Já tem conta?</span>
          <a href="#/login" style="font-size:0.7rem;font-weight:600"> Entrar</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('regBtn').addEventListener('click', async () => {
    const username = document.getElementById('regUser').value.trim();
    const display_name = document.getElementById('regDisplay').value.trim();
    const password = document.getElementById('regPass').value;
    const errEl = document.getElementById('regError');

    if (!username || !password) {
      errEl.textContent = 'Preencha username e senha';
      errEl.style.display = 'block';
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, display_name })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Erro ao registrar';
        errEl.style.display = 'block';
        return;
      }
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({ username: data.username, display_name: data.display_name }));
      updateAuthUI();
      Router.navigate('/');
    } catch (e) {
      errEl.textContent = 'Erro de conexão';
      errEl.style.display = 'block';
    }
  });

  document.getElementById('regPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('regBtn').click();
  });
});
