Router.register('/', async (app) => {
  app.innerHTML = `<div class="loading">Carregando...</div>`;

  try {
    const [categories, items] = await Promise.all([
      getCategories(),
      searchItems('', '', '')
    ]);

    const totalItems = categories.reduce((s, c) => s + c.count, 0);

    const weaponCats = ['Espadas', 'Machados', 'Macas', 'Lancas', 'Arcos', 'Bestas', 'Adagas'];
    const armorCats = ['Armadura de Placa', 'Armadura de Couro', 'Armadura de Tecido'];
    const resourceCats = ['Minerio', 'Madeira', 'Fibra', 'Couro Bruto', 'Barra de Metal', 'Prancha'];

    app.innerHTML = `
      <div class="home-page">
        <div class="hero">
          <h1 class="hero-title">Albion <span class="gold">Market</span> Insights</h1>
          <p class="hero-sub">Dashboard privado de análise de mercado — dados em tempo real da comunidade</p>
          <div class="hero-search" style="position:relative;max-width:500px;margin:1.5rem auto 0">
            <input type="text" class="input" id="homeSearch" placeholder="Buscar item (ex: espada, capuz, poção...)" style="width:100%;padding:0.7rem 1rem;font-size:0.9rem" autocomplete="off" />
            <div class="search-results" id="homeSearchResults"></div>
          </div>
        </div>

        <div class="grid-4" style="margin:2rem 0">
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
            <div class="value">2</div>
            <div class="label">Fontes de Dados</div>
          </div>
        </div>

        <div style="margin-top:2rem">
          <div class="section-title">⚔ Categorias de Armas</div>
          <div class="grid-3">
            ${weaponCats.map(cat => {
              const c = categories.find(x => x.category === cat);
              return c ? `<a href="#/itens?cat=${encodeURIComponent(cat)}" class="highlight-card">
                <div class="hc-name">${cat}</div>
                <div class="hc-meta">${c.count} itens</div>
              </a>` : '';
            }).join('')}
          </div>
        </div>

        <div style="margin-top:2rem">
          <div class="section-title">🛡 Armaduras</div>
          <div class="grid-3">
            ${armorCats.map(cat => {
              const c = categories.find(x => x.category === cat);
              return c ? `<a href="#/itens?cat=${encodeURIComponent(cat)}" class="highlight-card">
                <div class="hc-name">${cat}</div>
                <div class="hc-meta">${c.count} itens</div>
              </a>` : '';
            }).join('')}
          </div>
        </div>

        <div style="margin-top:2rem">
          <div class="section-title">⛏ Recursos</div>
          <div class="grid-3">
            ${resourceCats.map(cat => {
              const c = categories.find(x => x.category === cat);
              return c ? `<a href="#/itens?cat=${encodeURIComponent(cat)}" class="highlight-card">
                <div class="hc-name">${cat}</div>
                <div class="hc-meta">${c.count} itens</div>
              </a>` : '';
            }).join('')}
          </div>
        </div>

        <div style="margin-top:2rem">
          <div class="section-title">📊 Todas as Categorias</div>
          <div class="grid-4">
            ${categories.map(c => `
              <a href="#/itens?cat=${encodeURIComponent(c.category)}" class="highlight-card">
                <div class="hc-name">${c.category}</div>
                <div class="hc-meta">${c.count} itens</div>
              </a>
            `).join('')}
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
      if (!e.target.closest('.hero-search')) homeResults.classList.remove('active');
    });

  } catch (e) {
    app.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${e.message}</p></div>`;
  }
});
