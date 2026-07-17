const CATEGORY_TREE = [
  { label: '⚔ Armas Corpo a Corpo', children: ['Espadas', 'Machados', 'Macas', 'Lancas', 'Martelos', 'Luvas de Guerra'] },
  { label: '🏹 Armas a Distância', children: ['Arcos', 'Bestas', 'Adagas'] },
  { label: '🔮 Cajados', children: ['Cajados de Fogo', 'Cajados de Gelo', 'Cajados Sagrados', 'Cajados Arcanos', 'Cajados Amaldicoados', 'Cajados da Natureza'] },
  { label: '🛡 Off-hand', children: ['Escudos', 'Tochas', 'Livros', 'Chifres', 'Totens', 'Orbes', 'Runas', 'Pergaminhos'] },
  { label: '🛡 Armaduras de Placa', children: ['Capacete de Placa', 'Armadura de Placa', 'Botas de Placa'] },
  { label: '🧥 Armaduras de Couro', children: ['Capacete de Couro', 'Armadura de Couro', 'Botas de Couro'] },
  { label: '👘 Armaduras de Tecido', children: ['Capacete de Tecido', 'Armadura de Tecido', 'Botas de Tecido'] },
  { label: '👑 Outras Armaduras', children: ['Capacetes', 'Armaduras', 'Botas'] },
  { label: '🎒 Acessórios', children: ['Capas', 'Bolsas'] },
  { label: '🐴 Montarias', children: ['Montarias'] },
  { label: '🧪 Consumíveis', children: ['Pocoes', 'Comida', 'Pesca'] },
  { label: '⛏ Recursos Brutos', children: ['Minerio', 'Madeira', 'Fibra', 'Couro Bruto', 'Pedra'] },
  { label: '🔨 Recursos Refinados', children: ['Barra de Metal', 'Prancha', 'Tecido', 'Couro', 'Bloco de Pedra'] },
  { label: '🔧 Ferramentas', children: ['Ferramentas'] },
  { label: '🏠 Outros', children: ['Gemas', 'Mobilha', 'Decoracao', 'Itens Unicos'] }
];

function fmtPrice(v) {
  if (!v && v !== 0) return '—';
  return Number(v).toLocaleString('pt-BR');
}
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return min + 'min';
  const h = Math.floor(min / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

Router.register('/itens', async (app, params) => {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  let activeCategory = urlParams.get('cat') || '';
  let activeTier = '';
  let categories = [];

  app.innerHTML = `
    <div class="page-layout">
      <aside class="page-sidebar">
        <div class="card" style="padding:0.6rem">
          <div class="sidebar-search">
            <input type="text" class="input" id="catSearch" placeholder="Filtrar categoria..." style="width:100%;font-size:0.75rem;padding:0.4rem 0.6rem" />
          </div>
          <div id="categoryTree"></div>
        </div>
      </aside>
      <div class="page-content" id="pageContent">
        <div class="tier-bar" id="tierBar">
          <span class="label">Tier:</span>
          <button data-tier="" class="active">Todos</button>
          <button data-tier="3">T3</button>
          <button data-tier="4">T4</button>
          <button data-tier="5">T5</button>
          <button data-tier="6">T6</button>
          <button data-tier="7">T7</button>
          <button data-tier="8">T8</button>
        </div>
        <div style="position:relative;margin-bottom:0.8rem">
          <input type="text" class="input" id="itemSearch" placeholder="Buscar item..." style="width:100%;font-size:0.85rem" autocomplete="off" />
          <div class="search-results" id="itemResults"></div>
        </div>
        <div id="itemList" class="card"></div>
      </div>
    </div>
  `;

  const catMap = {};
  try {
    categories = await getCategories();
    categories.forEach(c => catMap[c.category] = c.count);
  } catch (e) {}

  function renderTree(filter = '') {
    const tree = document.getElementById('categoryTree');
    let html = `<div class="cat-child${activeCategory === '' ? ' active' : ''}" data-cat="" style="font-weight:600;color:var(--text);padding-left:0.6rem;border-bottom:1px solid var(--border)">
      <span>Todos</span><span class="cc-count">${categories.reduce((s, c) => s + c.count, 0)}</span>
    </div>`;

    CATEGORY_TREE.forEach(group => {
      const kids = group.children.filter(c => catMap[c] && (!filter || c.toLowerCase().includes(filter)));
      if (!kids.length) return;
      const isOpen = kids.some(c => c === activeCategory) || filter;
      const total = kids.reduce((s, c) => s + (catMap[c] || 0), 0);
      html += `<div class="cat-group${isOpen ? ' open' : ''}">`;
      html += `<div class="cat-group-header"><span class="cat-arrow">▶</span><span>${group.label}</span><span class="cc-count" style="margin-left:auto;font-size:0.55rem;opacity:0.5">${total}</span></div>`;
      html += `<div class="cat-group-children">`;
      kids.forEach(cat => {
        html += `<div class="cat-child${activeCategory === cat ? ' active' : ''}" data-cat="${cat}"><span>${cat}</span><span class="cc-count">${catMap[cat]}</span></div>`;
      });
      html += `</div></div>`;
    });

    tree.innerHTML = html;

    tree.querySelectorAll('.cat-group-header').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.parentElement.classList.toggle('open');
      });
    });

    tree.querySelectorAll('.cat-child[data-cat]').forEach(el => {
      el.addEventListener('click', () => {
        activeCategory = el.dataset.cat;
        renderTree(document.getElementById('catSearch').value.trim().toLowerCase());
        loadItems();
      });
    });
  }

  function showBrowseUI() {
    const pc = document.getElementById('pageContent');
    pc.innerHTML = `
      <div class="tier-bar" id="tierBar">
        <span class="label">Tier:</span>
        <button data-tier="" class="active">Todos</button>
        <button data-tier="3">T3</button>
        <button data-tier="4">T4</button>
        <button data-tier="5">T5</button>
        <button data-tier="6">T6</button>
        <button data-tier="7">T7</button>
        <button data-tier="8">T8</button>
      </div>
      <div style="position:relative;margin-bottom:0.8rem">
        <input type="text" class="input" id="itemSearch" placeholder="Buscar item..." style="width:100%;font-size:0.85rem" autocomplete="off" />
        <div class="search-results" id="itemResults"></div>
      </div>
      <div id="itemList" class="card"></div>
    `;
    bindTierBar();
    bindItemSearch();
    loadItems();
  }

  function bindTierBar() {
    document.getElementById('tierBar').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      activeTier = btn.dataset.tier;
      document.getElementById('tierBar').querySelectorAll('button').forEach(b =>
        b.classList.toggle('active', b.dataset.tier === activeTier)
      );
      loadItems();
    });
  }

  function bindItemSearch() {
    const itemSearch = document.getElementById('itemSearch');
    const itemResults = document.getElementById('itemResults');
    let timeout;
    itemSearch.addEventListener('input', () => {
      clearTimeout(timeout);
      const q = itemSearch.value.trim();
      if (q.length < 2) { itemResults.classList.remove('active'); return; }
      timeout = setTimeout(async () => {
        const items = await searchItems(q, activeTier || undefined, activeCategory || undefined);
        if (!items.length) {
          itemResults.innerHTML = '<div class="sr-item" style="cursor:default;color:var(--text-dim)">Nenhum encontrado</div>';
          itemResults.classList.add('active');
          return;
        }
        itemResults.innerHTML = items.slice(0, 20).map(it => `
          <div class="sr-item" data-id="${it.unique_name}">
            <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
            <span class="sr-meta">
              <span class="badge badge-gold">T${it.tier || '?'}</span>
              ${it.enchantment > 0 ? `<span class="badge badge-purple">@${it.enchantment}</span>` : ''}
            </span>
          </div>
        `).join('');
        itemResults.classList.add('active');
        itemResults.querySelectorAll('.sr-item[data-id]').forEach(el => {
          el.addEventListener('click', () => showItemDetail(el.dataset.id));
        });
      }, 250);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#itemSearch')) itemResults.classList.remove('active');
    });
  }

  async function loadItems() {
    const list = document.getElementById('itemList');
    list.innerHTML = '<div class="loading">Carregando...</div>';
    try {
      const items = await searchItems('', activeTier || undefined, activeCategory || undefined);
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>Nenhum item encontrado</p></div>';
        return;
      }
      list.innerHTML = `<table class="data-table">
        <thead><tr><th>Nome</th><th>ID</th><th>Tier</th><th>Enc</th><th>Categoria</th></tr></thead>
        <tbody>${items.map(it => `
          <tr style="cursor:pointer" data-id="${it.unique_name}" class="item-row">
            <td style="font-weight:600">${it.name_ptbr || it.unique_name}</td>
            <td style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${it.unique_name}</td>
            <td><span class="badge badge-gold">T${it.tier || '?'}</span></td>
            <td>${it.enchantment > 0 ? `<span class="badge badge-purple">@${it.enchantment}</span>` : ''}</td>
            <td><span class="badge badge-surface">${it.category || ''}</span></td>
          </tr>
        `).join('')}</tbody>
      </table>`;
      list.querySelectorAll('.item-row').forEach(row => {
        row.addEventListener('click', () => showItemDetail(row.dataset.id));
      });
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  async function showItemDetail(itemId) {
    const pc = document.getElementById('pageContent');
    pc.innerHTML = '<div class="loading">Carregando...</div>';

    try {
      const [latest, history, itemInfo] = await Promise.all([
        getLatestPrices(itemId),
        getPriceHistory(itemId, 500),
        apiGet(`/api/items/${itemId}`).catch(() => null)
      ]);

      const name = (itemInfo && itemInfo.name_ptbr) || (latest.length && latest[0].name_ptbr) || itemId;

      pc.innerHTML = `
        <div>
          <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
            <a href="javascript:void(0)" id="backToList" style="font-size:0.75rem;color:var(--gold);cursor:pointer">← Voltar à lista</a>
            <h2 style="font-size:1.1rem;font-weight:700">${name}</h2>
            <span style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${itemId}</span>
            ${itemInfo ? `<span class="badge badge-gold">T${itemInfo.tier || '?'}</span>` : ''}
            ${itemInfo && itemInfo.enchantment ? `<span class="badge badge-purple">@${itemInfo.enchantment}</span>` : ''}
            ${itemInfo && itemInfo.category ? `<span class="badge badge-surface">${itemInfo.category}</span>` : ''}
          </div>

          ${latest.length ? `
          <div class="card" style="margin-bottom:1rem">
            <div class="section-title">Preços por Cidade</div>
            <table class="price-table">
              <thead><tr><th>Cidade</th><th>Venda min</th><th>Venda max</th><th>Compra min</th><th>Compra max</th><th>Fonte</th><th>Atualizado</th></tr></thead>
              <tbody>${latest.map(r => `<tr>
                <td class="city">${r.city}</td>
                <td class="price">${fmtPrice(r.sell_price_min)}</td>
                <td class="price">${fmtPrice(r.sell_price_max)}</td>
                <td class="price">${fmtPrice(r.buy_price_min)}</td>
                <td class="price">${fmtPrice(r.buy_price_max)}</td>
                <td><span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span></td>
                <td class="time-ago">${timeAgo(r.observed_at)}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>` : '<div class="card" style="margin-bottom:1rem;padding:1.5rem;text-align:center;color:var(--text-dim);font-size:0.8rem">Sem dados de preço disponíveis</div>'}

          ${history.length ? `
          <div class="card" style="margin-bottom:1rem">
            <div class="section-title">Estatísticas</div>
            <div class="grid-3" id="detailStats"></div>
          </div>

          <div class="card">
            <div class="section-title">Gráfico de Preços</div>
            <div class="chart-controls" id="detailMetric">
              <button class="active" data-metric="sell">Venda</button>
              <button data-metric="buy">Compra</button>
            </div>
            <div class="chart-container"><canvas id="detailChart"></canvas></div>
          </div>` : ''}
        </div>
      `;

      document.getElementById('backToList').addEventListener('click', () => showBrowseUI());

      if (history.length) {
        const sells = history.filter(h => h.sell_price_min).map(h => h.sell_price_min);
        const buys = history.filter(h => h.buy_price_min).map(h => h.buy_price_min);
        const avgSell = sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 0;
        const minSell = sells.length ? Math.min(...sells) : 0;
        const maxSell = sells.length ? Math.max(...sells) : 0;
        const avgBuy = buys.length ? Math.round(buys.reduce((a, b) => a + b, 0) / buys.length) : 0;

        document.getElementById('detailStats').innerHTML = `
          <div class="stat-box"><div class="value">${fmtPrice(avgSell)}</div><div class="label">Venda médio</div></div>
          <div class="stat-box"><div class="value">${fmtPrice(minSell)}</div><div class="label">Venda mín</div></div>
          <div class="stat-box"><div class="value">${fmtPrice(maxSell)}</div><div class="label">Venda máx</div></div>
          <div class="stat-box"><div class="value">${fmtPrice(avgBuy)}</div><div class="label">Compra médio</div></div>
          <div class="stat-box"><div class="value">${history.length}</div><div class="label">Registros</div></div>
          <div class="stat-box"><div class="value">${new Set(history.map(h => h.city)).size}</div><div class="label">Cidades</div></div>
        `;

        const CITY_COLORS = {
          'Caerleon': '#c9a94e', 'Bridgewatch': '#e67e22', 'Lymhurst': '#27ae60',
          'Martlock': '#3498db', 'Fort Sterling': '#ecf0f1', 'Thetford': '#8e44ad', 'Black Market': '#e74c3c',
        };

        let chartInstance = null;
        const byCity = {};
        for (const row of [...history].reverse()) {
          if (!byCity[row.city]) byCity[row.city] = [];
          byCity[row.city].push(row);
        }

        function drawChart(metric) {
          if (chartInstance) chartInstance.destroy();
          const datasets = Object.entries(byCity).map(([city, rows]) => ({
            label: city,
            data: rows.map(r => ({ x: new Date(r.observed_at), y: metric === 'sell' ? (r.sell_price_min || r.sell_price_max) : (r.buy_price_min || r.buy_price_max) })),
            borderColor: CITY_COLORS[city] || '#888', backgroundColor: 'transparent',
            borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 5, tension: 0.3,
          }));
          chartInstance = new Chart(document.getElementById('detailChart'), {
            type: 'line', data: { datasets },
            options: {
              responsive: true, maintainAspectRatio: false,
              interaction: { mode: 'nearest', intersect: false },
              plugins: {
                legend: { labels: { color: '#8a8070', font: { size: 10 } } },
                tooltip: {
                  backgroundColor: '#1e1e2a', titleColor: '#e6d9b8', bodyColor: '#c9a94e',
                  borderColor: '#2a2a3a', borderWidth: 1,
                  callbacks: {
                    title: items => items.length ? new Date(items[0].parsed.x).toLocaleString('pt-BR') : '',
                    label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('pt-BR')}`,
                  },
                },
              },
              scales: {
                x: { type: 'timeseries', time: { tooltipFormat: 'dd/MM/yyyy HH:mm' }, ticks: { color: '#8a8070', font: { size: 9 }, maxTicksLimit: 10 }, grid: { color: '#1e1e2a' } },
                y: { ticks: { color: '#8a8070', font: { size: 9 }, callback: v => v?.toLocaleString('pt-BR') }, grid: { color: '#1e1e2a' } },
              },
            },
          });
        }

        drawChart('sell');
        document.getElementById('detailMetric').addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          document.querySelectorAll('#detailMetric button').forEach(b => b.classList.toggle('active', b === btn));
          drawChart(btn.dataset.metric);
        });
      }

    } catch (e) {
      pc.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro: ${e.message}</p><a href="javascript:void(0)" id="backToList" style="color:var(--gold);font-size:0.75rem;margin-top:0.5rem;display:inline-block">← Voltar à lista</a></div>`;
      document.getElementById('backToList')?.addEventListener('click', () => showBrowseUI());
    }
  }

  document.getElementById('catSearch').addEventListener('input', (e) => {
    renderTree(e.target.value.trim().toLowerCase());
  });

  bindTierBar();
  bindItemSearch();
  renderTree();
  loadItems();

  const searchQ = urlParams.get('q');
  if (searchQ) {
    const searchInput = document.getElementById('itemSearch');
    if (searchInput) {
      searchInput.value = searchQ;
      searchInput.dispatchEvent(new Event('input'));
    }
  }

  if (urlParams.get('item')) {
    showItemDetail(urlParams.get('item'));
  }
});
