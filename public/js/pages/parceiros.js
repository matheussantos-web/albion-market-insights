Router.register('/parceiros', async (app) => {
  const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  const token = localStorage.getItem('auth_token');

  if (!token) {
    app.innerHTML = `
      <div style="max-width:500px;margin:3rem auto;padding:0 1.5rem;text-align:center">
        <div class="card" style="padding:2rem">
          <div style="font-size:2.5rem;margin-bottom:1rem">🔗</div>
          <h2 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem">Seja um Contribuidor</h2>
          <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:1.5rem">
            Cadastre-se para compartilhar dados de mercado do Albion Online e ganhar acesso a recursos exclusivos.
          </p>
          <div style="display:flex;gap:0.75rem;justify-content:center">
            <a href="#/login" class="btn btn-primary" style="padding:0.5rem 1.2rem;font-size:0.8rem">Entrar</a>
            <a href="#/register" class="btn btn-gold" style="padding:0.5rem 1.2rem;font-size:0.8rem">Criar Conta</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:1.5rem">
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Contribuidor</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Sua chave de acesso ao sistema</span>
      </div>

      <div class="card" style="padding:1.5rem;margin-bottom:1rem" id="contribCard">
        <div style="text-align:center;padding:1rem 0">
          <div style="font-size:1.5rem;margin-bottom:0.5rem">⏳</div>
          <p style="font-size:0.8rem;color:var(--text-dim)">Carregando...</p>
        </div>
      </div>

      <div class="card" style="padding:1.5rem">
        <h3 style="font-size:0.85rem;font-weight:600;margin-bottom:1rem">Como usar</h3>
        <div style="display:flex;flex-direction:column;gap:0.8rem">
          <div style="display:flex;gap:0.75rem;align-items:flex-start">
            <span style="background:var(--gold);color:#000;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">1</span>
            <div>
              <p style="font-size:0.8rem;font-weight:600">Baixe o Client</p>
              <p style="font-size:0.7rem;color:var(--text-dim)">Baixe o pacote na seção de downloads do repo</p>
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;align-items:flex-start">
            <span style="background:var(--gold);color:#000;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">2</span>
            <div>
              <p style="font-size:0.8rem;font-weight:600">Instale o Npcap</p>
              <p style="font-size:0.7rem;color:var(--text-dim)">Execute INSTALAR.bat como administrador</p>
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;align-items:flex-start">
            <span style="background:var(--gold);color:#000;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">3</span>
            <div>
              <p style="font-size:0.8rem;font-weight:600">Cole sua API Key</p>
              <p style="font-size:0.7rem;color:var(--text-dim)">Execute CONFIGURAR.bat e cole a chave abaixo</p>
            </div>
          </div>
          <div style="display:flex;gap:0.75rem;align-items:flex-start">
            <span style="background:var(--gold);color:#000;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">4</span>
            <div>
              <p style="font-size:0.8rem;font-weight:600">Execute e jogue</p>
              <p style="font-size:0.7rem;color:var(--text-dim)">Abra o Albion, execute INICIAR.bat como admin e vá ao mercado</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await apiGet('/api/auth/contributor');
    const card = document.getElementById('contribCard');

    if (!data.has_contributor) {
      card.innerHTML = `
        <div style="text-align:center;padding:1rem 0">
          <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1rem">Você ainda não tem uma chave de contribuidor.</p>
          <button class="btn btn-gold" id="claimBtn" style="padding:0.5rem 1.2rem;font-size:0.8rem">Gerar Minha Chave</button>
        </div>
      `;
      document.getElementById('claimBtn').addEventListener('click', async () => {
        // The contributor is created on registration; this shouldn't normally happen
        // but as a fallback, we can try to create one
        alert('Chave já deveria ter sido criada no registro. Faça logout e login novamente.');
      });
      return;
    }

    const key = data.api_key;
    card.innerHTML = `
      <div style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <span style="font-size:0.7rem;color:var(--text-dim)">Sua chave</span>
          <span style="font-size:0.65rem;color:${data.active ? 'var(--green)' : 'var(--red)'};font-weight:600">${data.active ? '● Ativa' : '● Inativa'}</span>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <code id="apiKeyDisplay" style="flex:1;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:0.6rem 0.8rem;font-size:0.75rem;color:var(--gold);word-break:break-all;user-select:all">${key}</code>
          <button class="btn btn-ghost" id="copyBtn" style="padding:0.5rem 0.7rem;flex-shrink:0" title="Copiar">
            📋
          </button>
        </div>
      </div>
      <div style="display:flex;gap:1rem;font-size:0.65rem;color:var(--text-dim);border-top:1px solid var(--border);padding-top:0.8rem">
        <span>Criado: ${new Date(data.created_at).toLocaleDateString('pt-BR')}</span>
        ${data.last_seen_at ? `<span>Último envio: ${new Date(data.last_seen_at).toLocaleDateString('pt-BR')}</span>` : '<span>Nunca enviou dados</span>'}
      </div>
    `;

    document.getElementById('copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(key).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 1500);
      });
    });
  } catch (e) {
    document.getElementById('contribCard').innerHTML = `
      <div style="text-align:center;padding:1rem 0">
        <p style="font-size:0.8rem;color:var(--red)">Erro ao carregar dados</p>
      </div>
    `;
  }
});
