let chartInstance = null;
let currentItemId = null;
let searchTimeout = null;
let activeTier = '';
let activeCategory = '';
let categories = [];

const $ = (sel) => document.querySelector(sel);

const searchInput = $('#searchInput');
const searchResults = $('#searchResults');
const syncBtn = $('#syncBtn');
const categoryTree = $('#categoryTree');
const selectedInfo = $('#selectedInfo');
const selectedCatLabel = $('#selectedCatLabel');
const clearFilter = $('#clearFilter');
const cityFilter = $('#cityFilter');
const sourceFilter = $('#sourceFilter');

syncBtn.addEventListener('click', handleSync);
clearFilter.addEventListener('click', () => { activeCategory = ''; updateCategoryUI(); refreshCurrentItem(); });
cityFilter.addEventListener('change', handleFilterChange);
sourceFilter.addEventListener('change', handleFilterChange);
searchInput.addEventListener('input', handleSearchInput);
searchInput.addEventListener('keydown', handleSearchKeydown);
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) searchResults.classList.remove('active');
});

$('#tierBar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  activeTier = btn.dataset.tier;
  $('#tierBar').querySelectorAll('button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tier === activeTier)
  );
  if (searchInput.value.trim()) doSearch(searchInput.value.trim());
});

const CATEGORY_TREE = [
  {
    label: '⚔ Armas Corpo a Corpo', children: [
      'Espadas', 'Machados', 'Macas', 'Lancas', 'Martelos', 'Luvas de Guerra'
    ]
  },
  {
    label: '🏹 Armas a Distância', children: [
      'Arcos', 'Bestas', 'Adagas'
    ]
  },
  {
    label: '🔮 Cajados', children: [
      'Cajados de Fogo', 'Cajados de Gelo', 'Cajados Sagrados',
      'Cajados Arcanos', 'Cajados Amaldicoados', 'Cajados da Natureza'
    ]
  },
  {
    label: '🛡 Off-hand', children: [
      'Escudos', 'Tochas', 'Livros', 'Chifres', 'Totens', 'Orbes', 'Runas', 'Pergaminhos'
    ]
  },
  {
    label: '🛡 Armaduras de Placa', children: [
      'Capacete de Placa', 'Armadura de Placa', 'Botas de Placa'
    ]
  },
  {
    label: '🧥 Armaduras de Couro', children: [
      'Capacete de Couro', 'Armadura de Couro', 'Botas de Couro'
    ]
  },
  {
    label: '👘 Armaduras de Tecido', children: [
      'Capacete de Tecido', 'Armadura de Tecido', 'Botas de Tecido'
    ]
  },
  {
    label: '👑 Outras Armaduras', children: [
      'Capacetes', 'Armaduras', 'Botas'
    ]
  },
  {
    label: '🎒 Acessórios', children: [
      'Capas', 'Bolsas'
    ]
  },
  {
    label: '🐴 Montarias', children: ['Montarias']
  },
  {
    label: '🧪 Consumíveis', children: [
      'Pocoes', 'Comida', 'Pesca'
    ]
  },
  {
    label: '⛏ Recursos Brutos', children: [
      'Minerio', 'Madeira', 'Fibra', 'Couro Bruto', 'Pedra'
    ]
  },
  {
    label: '🔨 Recursos Refinados', children: [
      'Barra de Metal', 'Prancha', 'Tecido', 'Couro', 'Bloco de Pedra'
    ]
  },
  {
    label: '🔧 Ferramentas', children: ['Ferramentas']
  },
  {
    label: '🏠 Outros', children: [
      'Gemas', 'Mobilha', 'Decoracao', 'Itens Unicos'
    ]
  }
];

loadCategories();

async function loadCategories() {
  try {
    categories = await getCategories();
    renderCategoryTree();
  } catch (e) {
    categoryTree.innerHTML = '<div style="padding:0.75rem;color:var(--text-dim);font-size:0.7rem">Erro ao carregar</div>';
  }
}

function renderCategoryTree() {
  const catMap = {};
  categories.forEach(c => catMap[c.category] = c.count);

  let html = `<div class="cat-item all-items${activeCategory === '' ? ' active' : ''}" data-cat="" style="font-weight:600;color:var(--text);padding-left:0.75rem;border-bottom:1px solid var(--border);margin-bottom:0.15rem">
    <span>Todos os itens</span>
    <span class="cat-count">${categories.reduce((s, c) => s + c.count, 0)}</span>
  </div>`;

  CATEGORY_TREE.forEach(group => {
    const activeChildren = group.children.filter(c => catMap[c]);
    if (!activeChildren.length) return;

    const isOpen = group.children.some(c => c === activeCategory);
    const totalInGroup = activeChildren.reduce((s, c) => s + (catMap[c] || 0), 0);

    html += `<div class="cat-group${isOpen ? ' open' : ''}" data-group="${group.label}">`;
    html += `<div class="cat-group-header">
      <span class="cat-arrow">▶</span>
      <span>${group.label}</span>
      <span class="cat-count" style="margin-left:auto;font-size:0.6rem;opacity:0.5">${totalInGroup}</span>
    </div>`;
    html += `<div class="cat-group-children">`;
    activeChildren.forEach(cat => {
      html += `<div class="cat-item${activeCategory === cat ? ' active' : ''}" data-cat="${cat}">
        <span>${cat}</span>
        <span class="cat-count">${catMap[cat]}</span>
      </div>`;
    });
    html += `</div></div>`;
  });

  categoryTree.innerHTML = html;

  categoryTree.querySelectorAll('.cat-group-header').forEach(el => {
    el.addEventListener('click', () => {
      el.parentElement.classList.toggle('open');
    });
  });

  categoryTree.querySelectorAll('.cat-item[data-cat]').forEach(el => {
    el.addEventListener('click', () => {
      activeCategory = el.dataset.cat;
      updateCategoryUI();
      if (searchInput.value.trim()) doSearch(searchInput.value.trim());
      else if (activeCategory) browseCategory(activeCategory);
    });
  });
}

function updateCategoryUI() {
  selectedInfo.style.display = activeCategory ? '' : 'none';
  selectedCatLabel.textContent = activeCategory || '';
  renderCategoryTree();
}

async function browseCategory(cat) {
  try {
    const items = await searchItems('', activeTier, cat);
    if (!items.length) {
      searchResults.innerHTML = '<div class="sr-item" style="cursor:default;color:var(--text-dim)">Nenhum item nesta categoria</div>';
      searchResults.classList.add('active');
      return;
    }
    searchResults.innerHTML = items.slice(0, 40).map(it => `
      <div class="sr-item" data-id="${it.unique_name}">
        <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
        <span class="sr-meta">
          <span class="sr-tier">T${it.tier || '?'}</span>
          ${it.enchantment > 0 ? `<span class="sr-enchant">@${it.enchantment}</span>` : ''}
        </span>
      </div>
    `).join('');
    searchResults.classList.add('active');
    searchResults.querySelectorAll('.sr-item[data-id]').forEach(el => {
      el.addEventListener('click', () => selectItem(el.dataset.id));
    });
  } catch (e) {
    console.error('Erro ao buscar categoria:', e);
  }
}

function handleFilterChange() {
  if (currentItemId) selectItem(currentItemId);
}

function handleSearchInput() {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.classList.remove('active'); return; }
  searchTimeout = setTimeout(() => doSearch(q), 250);
}

function handleSearchKeydown(e) {
  const items = searchResults.querySelectorAll('.sr-item');
  const selected = searchResults.querySelector('.sr-item.selected');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = selected ? selected.nextElementSibling : items[0];
    if (next) { items.forEach(i => i.classList.remove('selected')); next.classList.add('selected'); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = selected ? selected.previousElementSibling : items[items.length - 1];
    if (prev) { items.forEach(i => i.classList.remove('selected')); prev.classList.add('selected'); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selected) selected.click();
  } else if (e.key === 'Escape') {
    searchResults.classList.remove('active');
  }
}

async function doSearch(q) {
  try {
    const items = await searchItems(q, activeTier, activeCategory);
    if (!items.length) {
      searchResults.innerHTML = '<div class="sr-item" style="cursor:default;color:var(--text-dim)">Nenhum encontrado</div>';
      searchResults.classList.add('active');
      return;
    }
    searchResults.innerHTML = items.slice(0, 40).map(it => `
      <div class="sr-item" data-id="${it.unique_name}">
        <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
        <span class="sr-meta">
          <span class="sr-cat">${it.category || ''}</span>
          <span class="sr-tier">T${it.tier || '?'}</span>
          ${it.enchantment > 0 ? `<span class="sr-enchant">@${it.enchantment}</span>` : ''}
        </span>
      </div>
    `).join('');
    searchResults.classList.add('active');
    searchResults.querySelectorAll('.sr-item[data-id]').forEach(el => {
      el.addEventListener('click', () => selectItem(el.dataset.id));
    });
  } catch (err) {
    console.error('Erro na busca:', err);
  }
}

async function selectItem(id) {
  currentItemId = id;
  searchResults.classList.remove('active');
  showLoading(true);

  let [latest, history] = await Promise.all([
    getLatestPrices(id), getPriceHistory(id)
  ]);

  const displayName = (latest.length && latest[0].name_ptbr) || id;
  searchInput.value = displayName;

  if (!latest.length) {
    showLoading(true, 'Buscando dados no AODP...');
    try {
      const syncData = await fetchFromAodp(id);
      if (syncData.fetched > 0) {
        [latest, history] = await Promise.all([
          getLatestPrices(id), getPriceHistory(id)
        ]);
      }
    } catch (e) { console.warn('Falha ao buscar do AODP:', e); }
  }

  showLoading(false);
  renderLatest(id, latest);
  renderStats(latest, history);
  renderChart(id, history);
}

function refreshCurrentItem() {
  if (currentItemId) selectItem(currentItemId);
}

function showLoading(on, msg) {
  let el = $('#loadingBanner');
  if (on) {
    if (!el) { el = document.createElement('div'); el.id = 'loadingBanner'; el.className = 'loading-banner'; document.body.appendChild(el); }
    el.textContent = msg || 'Carregando...';
    el.style.display = '';
  } else if (el) { el.style.display = 'none'; }
}

function timeAgo(dateStr) {
  if (!dateStr) return '\u2014';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function fmt(n) {
  if (n == null) return '\u2014';
  return n.toLocaleString('pt-BR');
}

function renderLatest(itemId, rows) {
  const empty = $('#latestEmpty');
  const content = $('#latestContent');

  if (!rows.length) {
    empty.style.display = '';
    content.style.display = 'none';
    empty.querySelector('p').textContent = 'Sem dados de preço para este item';
    return;
  }

  empty.style.display = 'none';
  content.style.display = '';

  const item = rows[0];
  const cf = cityFilter.value;
  const sf = sourceFilter.value;
  let filtered = rows;
  if (cf) filtered = filtered.filter(r => r.city === cf);
  if (sf) filtered = filtered.filter(r => r.source === sf);

  content.innerHTML = `
    <div class="selected-item-header">
      <span class="name">${item.name_ptbr || itemId}</span>
      <span class="uname">${itemId}</span>
      ${item.tier ? `<span class="tier-badge">T${item.tier}</span>` : ''}
      ${item.enchantment ? `<span class="enchant-badge">@${item.enchantment}</span>` : ''}
      ${item.category ? `<span class="cat-badge">${item.category}</span>` : ''}
    </div>
    ${filtered.length ? `
    <table class="price-table">
      <thead><tr><th>Cidade</th><th>Venda min</th><th>Venda max</th><th>Compra min</th><th>Compra max</th><th>Fonte</th><th>Atualizado</th></tr></thead>
      <tbody>${filtered.map(r => `<tr>
        <td class="city-name">${r.city}</td>
        <td class="price">${fmt(r.sell_price_min)}</td>
        <td class="price">${fmt(r.sell_price_max)}</td>
        <td class="price">${fmt(r.buy_price_min)}</td>
        <td class="price">${fmt(r.buy_price_max)}</td>
        <td><span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span></td>
        <td class="time-ago">${timeAgo(r.observed_at)}</td>
      </tr>`).join('')}</tbody>
    </table>` : '<p style="color:var(--text-dim);font-size:0.75rem;text-align:center;padding:0.75rem">Nenhum dado para os filtros selecionados</p>'}
  `;
}

function renderStats(latest, history) {
  const empty = $('#statsEmpty');
  const content = $('#statsContent');
  if (!history.length) { empty.style.display = ''; content.style.display = 'none'; empty.querySelector('p').textContent = 'Sem dados suficientes para estatísticas'; return; }
  empty.style.display = 'none'; content.style.display = '';
  const sells = history.filter(h => h.sell_price_min).map(h => h.sell_price_min);
  const buys = history.filter(h => h.buy_price_min).map(h => h.buy_price_min);
  const avgSell = sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 0;
  const minSell = sells.length ? Math.min(...sells) : 0;
  const maxSell = sells.length ? Math.max(...sells) : 0;
  const avgBuy = buys.length ? Math.round(buys.reduce((a, b) => a + b, 0) / buys.length) : 0;
  const cities = new Set(history.map(h => h.city));
  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="value">${fmt(avgSell)}</div><div class="label">Venda médio</div></div>
      <div class="stat-card"><div class="value">${fmt(minSell)}</div><div class="label">Venda mín</div></div>
      <div class="stat-card"><div class="value">${fmt(maxSell)}</div><div class="label">Venda máx</div></div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="value">${fmt(avgBuy)}</div><div class="label">Compra médio</div></div>
      <div class="stat-card"><div class="value">${history.length}</div><div class="label">Registros</div></div>
      <div class="stat-card"><div class="value">${cities.size}</div><div class="label">Cidades</div></div>
    </div>
  `;
}

const CITY_COLORS = {
  'Caerleon': '#c9a94e', 'Bridgewatch': '#e67e22', 'Lymhurst': '#27ae60',
  'Martlock': '#3498db', 'Fort Sterling': '#ecf0f1', 'Thetford': '#8e44ad', 'Black Market': '#e74c3c',
};

function renderChart(itemId, history) {
  const empty = $('#historyEmpty');
  const content = $('#historyContent');
  if (!history.length) { empty.style.display = ''; content.style.display = 'none'; return; }
  empty.style.display = 'none'; content.style.display = '';
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  content.innerHTML = `<div class="chart-controls" id="chartMetric">
    <button class="active" data-metric="sell">Venda</button>
    <button data-metric="buy">Compra</button>
  </div><div class="chart-container"><canvas id="priceChart"></canvas></div>`;
  const byCity = {};
  for (const row of [...history].reverse()) {
    if (!byCity[row.city]) byCity[row.city] = [];
    byCity[row.city].push(row);
  }
  let activeMetric = 'sell';
  drawChart(byCity, activeMetric);
  $('#chartMetric').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    activeMetric = btn.dataset.metric;
    content.querySelectorAll('#chartMetric button').forEach(b => b.classList.toggle('active', b.dataset.metric === activeMetric));
    drawChart(byCity, activeMetric);
  });
  function drawChart(byCity, metric) {
    if (chartInstance) chartInstance.destroy();
    const datasets = Object.entries(byCity).map(([city, rows]) => ({
      label: city,
      data: rows.map(r => ({ x: new Date(r.observed_at), y: metric === 'sell' ? (r.sell_price_min || r.sell_price_max) : (r.buy_price_min || r.buy_price_max) })),
      borderColor: CITY_COLORS[city] || '#888', backgroundColor: 'transparent',
      borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 5, tension: 0.3,
    }));
    chartInstance = new Chart(content.querySelector('#priceChart'), {
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
}
