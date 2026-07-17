Router.register('/', async (app) => {
  app.innerHTML = `<div class="loading">Carregando...</div>`;

  try {
    const categories = await getCategories();
    const totalItems = categories.reduce((s, c) => s + c.count, 0);

    const GROUPS = [
      { icon: '⚔', label: 'Armas Corpo a Corpo', cats: ['Espadas', 'Machados', 'Macas', 'Lancas', 'Martelos', 'Luvas de Guerra'] },
      { icon: '🏹', label: 'Armas a Distância', cats: ['Arcos', 'Bestas', 'Adagas'] },
      { icon: '🔮', label: 'Cajados', cats: ['Cajados de Fogo', 'Cajados de Gelo', 'Cajados Sagrados', 'Cajados Arcanos', 'Cajados Amaldicoados', 'Cajados da Natureza'] },
      { icon: '🛡', label: 'Off-hand & Defesa', cats: ['Escudos', 'Tochas', 'Livros', 'Chifres', 'Totens', 'Orbes', 'Runas', 'Pergaminhos'] },
      { icon: '🪖', label: 'Armaduras de Placa', cats: ['Capacete de Placa', 'Armadura de Placa', 'Botas de Placa'] },
      { icon: '🧥', label: 'Armaduras de Couro', cats: ['Capacete de Couro', 'Armadura de Couro', 'Botas de Couro'] },
      { icon: '👘', label: 'Armaduras de Tecido', cats: ['Capacete de Tecido', 'Armadura de Tecido', 'Botas de Tecido'] },
      { icon: '🎒', label: 'Acessórios & Outros', cats: ['Capas', 'Bolsas', 'Montarias'] },
      { icon: '🧪', label: 'Consumíveis', cats: ['Pocoes', 'Comida', 'Pesca'] },
      { icon: '⛏', label: 'Recursos Brutos', cats: ['Minerio', 'Madeira', 'Fibra', 'Couro Bruto', 'Pedra'] },
      { icon: '🔨', label: 'Recursos Refinados', cats: ['Barra de Metal', 'Prancha', 'Tecido', 'Couro', 'Bloco de Pedra'] },
      { icon: '🔧', label: 'Ferramentas & Outros', cats: ['Ferramentas', 'Gemas', 'Mobilha', 'Decoracao', 'Itens Unicos'] },
    ];

    app.innerHTML = `
      <div class="hero-banner">
        <img src="/img/banner.png" alt="Albion Market Insights" />
        <div class="hero-content">
          <h1>ALBION <span class="gold">MARKET</span> INSIGHTS</h1>
          <p>Painel de Análise do Mercado Albion Online</p>
          <div class="hero-search-wrap">
            <input type="text" class="input" id="homeSearch" placeholder="Buscar item (ex: espada, capuz, poção...)" style="width:100%;padding:0.7rem 1rem;font-size:0.85rem" autocomplete="off" />
            <div class="search-results" id="homeSearchResults"></div>
          </div>
        </div>
      </div>

      <div style="max-width:1200px;margin:0 auto;padding:0 1.5rem">

        <div class="grid-4" style="margin:1.5rem 0 2rem">
          <div class="stat-box">
            <div class="value">${totalItems.toLocaleString('pt-BR')}</div>
            <div class="label">Itens Cadastrados</div>
          </div>
          <div class="stat-box">
            <div class="value">${categories.length}</div>
            <div class="label">Categorias</div>
          </div>
          <div class="stat-box">
            <div class="value">7</div>
            <div class="label">Cidades</div>
          </div>
          <div class="stat-box">
            <div class="value">235</div>
            <div class="label">Watchlist AODP</div>
          </div>
        </div>

        <div style="margin-bottom:2rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">📊</span>
            <h3 style="font-size:0.8rem;font-weight:700;color:var(--text)">Categorias de Itens</h3>
          </div>
          ${GROUPS.map(group => {
            const groupCats = group.cats.map(c => categories.find(x => x.category === c)).filter(Boolean);
            if (!groupCats.length) return '';
            const totalCount = groupCats.reduce((s, c) => s + c.count, 0);
            return `
              <div class="cat-section">
                <div class="cat-section-header">
                  <span class="cat-section-icon">${group.icon}</span>
                  <h3>${group.label}</h3>
                  <span class="cat-section-count">${totalCount} itens</span>
                </div>
                <div class="cat-section-grid">
                  ${groupCats.map(c => `
                    <a href="#/itens?cat=${encodeURIComponent(c.category)}" class="highlight-card">
                      <div class="hc-name">${c.category}</div>
                      <div class="hc-meta">${c.count} itens</div>
                    </a>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-bottom:2rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">⚙</span>
            <h3 style="font-size:0.8rem;font-weight:700;color:var(--text)">Como Funciona</h3>
          </div>
          <div class="how-it-works">
            <div class="hiw-card">
              <div class="hiw-icon">📊</div>
              <h4>Dados Privados</h4>
              <p>Contribuidores enviam dados de preço em tempo real via API, criando uma rede de informações confiáveis da comunidade.</p>
            </div>
            <div class="hiw-card">
              <div class="hiw-icon">🔄</div>
              <h4>Sync Automático</h4>
              <p>Dados públicos do AODP são sincronizados a cada 30 minutos como baseline, cobrindo 235 itens populares em 6 cidades.</p>
            </div>
            <div class="hiw-card">
              <div class="hiw-icon">📈</div>
              <h4>Análise Completa</h4>
              <p>Histórico de preços, comparação entre cidades, calculadora de craft e insights para maximizar seus lucros.</p>
            </div>
          </div>
        </div>

      </div>
    `;

    const homeSearch = document.getElementById('homeSearch');
    const homeResults = document.getElementById('homeSearchResults');
    let timeout;

    homeSearch.addEventListener('input', () => {
      clearTimeout(timeout);
      const q = homeSearch.value.trim();
      if (q.length < 2) { homeResults.classList.remove('active'); return; }
      timeout = setTimeout(async () => {
        const items = await searchItems(q);
        if (!items.length) {
          homeResults.innerHTML = '<div class="sr-item" style="cursor:default;color:var(--text-dim)">Nenhum encontrado</div>';
          homeResults.classList.add('active');
          return;
        }
        homeResults.innerHTML = items.slice(0, 15).map(it => `
          <div class="sr-item" data-id="${it.unique_name}">
            <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
            <span class="sr-meta">
              <span class="badge badge-surface">${it.category || ''}</span>
              <span class="badge badge-gold">T${it.tier || '?'}</span>
            </span>
          </div>
        `).join('');
        homeResults.classList.add('active');
        homeResults.querySelectorAll('.sr-item[data-id]').forEach(el => {
          el.addEventListener('click', () => {
            Router.navigate('/historico/' + el.dataset.id);
          });
        });
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.hero-search-wrap')) homeResults.classList.remove('active');
    });

  } catch (e) {
    app.innerHTML = `<div style="max-width:1200px;margin:0 auto;padding:0 1.5rem"><div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${e.message}</p></div></div>`;
  }
});
