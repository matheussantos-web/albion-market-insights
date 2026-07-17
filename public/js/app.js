let chartInstance = null;
let currentItemId = null;
let searchTimeout = null;
let activeTier = '';

const $ = (sel) => document.querySelector(sel);

const searchInput = $('#searchInput');
const searchResults = $('#searchResults');
const tierFilter = $('#tierFilter');
const syncBtn = $('#syncBtn');

syncBtn.addEventListener('click', handleSync);
tierFilter.addEventListener('click', handleTierFilter);
searchInput.addEventListener('input', handleSearchInput);
searchInput.addEventListener('keydown', handleSearchKeydown);
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) searchResults.classList.remove('active');
});

async function handleSync() {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Sincronizando...';
  syncBtn.style.borderColor = 'var(--gold)';
  syncBtn.style.color = 'var(--gold)';
  try {
    const data = await syncWatchlist();
    syncBtn.textContent = data.error ? 'Erro!' : `${data.synced} atualizados`;
    syncBtn.style.borderColor = data.error ? 'var(--red)' : 'var(--green)';
    syncBtn.style.color = data.error ? 'var(--red)' : 'var(--green)';
  } catch {
    syncBtn.textContent = 'Erro!';
    syncBtn.style.borderColor = 'var(--red)';
    syncBtn.style.color = 'var(--red)';
  }
  setTimeout(() => {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync AODP';
    syncBtn.style.borderColor = '';
    syncBtn.style.color = '';
  }, 3000);
}

function handleTierFilter(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  activeTier = btn.dataset.tier;
  tierFilter.querySelectorAll('button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tier === activeTier)
  );
  if (searchInput.value.trim()) doSearch(searchInput.value.trim());
}

function handleSearchInput() {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.classList.remove('active'); return; }
  searchTimeout = setTimeout(() => doSearch(q), 250);
}

function handleSearchKeydown(e) {
  const items = searchResults.querySelectorAll('.item');
  const selected = searchResults.querySelector('.item.selected');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = selected ? selected.nextElementSibling : items[0];
    if (next) { items.forEach((i) => i.classList.remove('selected')); next.classList.add('selected'); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = selected ? selected.previousElementSibling : items[items.length - 1];
    if (prev) { items.forEach((i) => i.classList.remove('selected')); prev.classList.add('selected'); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selected) selected.click();
  } else if (e.key === 'Escape') {
    searchResults.classList.remove('active');
  }
}

async function doSearch(q) {
  try {
    const items = await searchItems(q, activeTier);
    if (!items.length) {
      searchResults.innerHTML = '<div class="item" style="cursor:default;color:var(--text-dim)">Nenhum encontrado</div>';
      searchResults.classList.add('active');
      return;
    }
    searchResults.innerHTML = items.slice(0, 30).map((it) => `
      <div class="item" data-id="${it.unique_name}">
        <span>${it.name_ptbr || it.unique_name}</span>
        <span>
          <span class="tier">T${it.tier || '?'}</span>
          ${it.enchantment > 0 ? `<span class="enchant">@${it.enchantment}</span>` : ''}
        </span>
      </div>
    `).join('');
    searchResults.classList.add('active');
    searchResults.querySelectorAll('.item[data-id]').forEach((el) => {
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
    getLatestPrices(id),
    getPriceHistory(id),
  ]);

  const displayName = (latest.length && latest[0].name_ptbr) || id;
  searchInput.value = displayName;

  if (!latest.length) {
    showLoading(true, 'Buscando dados no AODP...');
    try {
      const syncData = await fetchFromAodp(id);
      if (syncData.fetched > 0) {
        [latest, history] = await Promise.all([
          getLatestPrices(id),
          getPriceHistory(id),
        ]);
      }
    } catch (e) {
      console.warn('Falha ao buscar do AODP:', e);
    }
  }

  showLoading(false);
  renderLatest(id, latest);
  renderStats(latest, history);
  renderChart(id, history);
}

function showLoading(on, msg) {
  let el = $('#loadingBanner');
  if (on) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'loadingBanner';
      el.className = 'loading-banner';
      document.body.appendChild(el);
    }
    el.textContent = msg || 'Carregando...';
    el.style.display = '';
  } else if (el) {
    el.style.display = 'none';
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '\u2014';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
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
  const displayName = item.name_ptbr || itemId;
  content.innerHTML = `
    <div class="selected-item-header">
      <span class="name">${displayName}</span>
      <span class="uname">${itemId}</span>
      ${item.tier ? `<span class="tier-badge">T${item.tier}</span>` : ''}
    </div>
    <table class="price-table">
      <thead>
        <tr>
          <th>Cidade</th>
          <th>Venda (min)</th>
          <th>Venda (max)</th>
          <th>Compra (min)</th>
          <th>Compra (max)</th>
          <th>Fonte</th>
          <th>Atualizado</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td class="city-name">${r.city}</td>
            <td class="price">${fmt(r.sell_price_min)}</td>
            <td class="price">${fmt(r.sell_price_max)}</td>
            <td class="price">${fmt(r.buy_price_min)}</td>
            <td class="price">${fmt(r.buy_price_max)}</td>
            <td><span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span></td>
            <td class="time-ago">${timeAgo(r.observed_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderStats(latest, history) {
  const empty = $('#statsEmpty');
  const content = $('#statsContent');

  if (!history.length) {
    empty.style.display = '';
    content.style.display = 'none';
    empty.querySelector('p').textContent = 'Sem dados suficientes para estatísticas';
    return;
  }

  empty.style.display = 'none';
  content.style.display = '';

  const sells = history.filter((h) => h.sell_price_min).map((h) => h.sell_price_min);
  const buys = history.filter((h) => h.buy_price_min).map((h) => h.buy_price_min);

  const avgSell = sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 0;
  const minSell = sells.length ? Math.min(...sells) : 0;
  const maxSell = sells.length ? Math.max(...sells) : 0;
  const avgBuy = buys.length ? Math.round(buys.reduce((a, b) => a + b, 0) / buys.length) : 0;

  const sources = new Set(history.map((h) => h.source));
  const cities = new Set(history.map((h) => h.city));

  content.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="value">${fmt(avgSell)}</div>
        <div class="label">Preço venda médio</div>
      </div>
      <div class="stat-card">
        <div class="value">${fmt(minSell)}</div>
        <div class="label">Preço venda mín</div>
      </div>
      <div class="stat-card">
        <div class="value">${fmt(maxSell)}</div>
        <div class="label">Preço venda máx</div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="value">${fmt(avgBuy)}</div>
        <div class="label">Preço compra médio</div>
      </div>
      <div class="stat-card">
        <div class="value">${history.length}</div>
        <div class="label">Registros</div>
      </div>
      <div class="stat-card">
        <div class="value">${cities.size} / ${sources.size}</div>
        <div class="label">Cidades / Fontes</div>
      </div>
    </div>
  `;
}

const CITY_COLORS = {
  'Caerleon': '#c9a94e',
  'Bridgewatch': '#e67e22',
  'Lymhurst': '#27ae60',
  'Martlock': '#3498db',
  'Fort Sterling': '#ecf0f1',
  'Thetford': '#8e44ad',
  'Black Market': '#e74c3c',
};

function renderChart(itemId, history) {
  const empty = $('#historyEmpty');
  const content = $('#historyContent');

  if (!history.length) {
    empty.style.display = '';
    content.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  content.style.display = '';

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  content.innerHTML = `
    <div class="chart-controls" id="chartMetric">
      <button class="active" data-metric="sell">Venda</button>
      <button data-metric="buy">Compra</button>
    </div>
    <div class="chart-container">
      <canvas id="priceChart"></canvas>
    </div>
  `;

  const byCity = {};
  for (const row of [...history].reverse()) {
    const city = row.city;
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(row);
  }

  let activeMetric = 'sell';
  drawChart(byCity, activeMetric);

  $('#chartMetric').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    activeMetric = btn.dataset.metric;
    content.querySelectorAll('#chartMetric button').forEach((b) =>
      b.classList.toggle('active', b.dataset.metric === activeMetric)
    );
    drawChart(byCity, activeMetric);
  });

  function drawChart(byCity, metric) {
    if (chartInstance) chartInstance.destroy();

    const datasets = Object.entries(byCity).map(([city, rows]) => ({
      label: city,
      data: rows.map((r) => ({
        x: new Date(r.observed_at),
        y: metric === 'sell' ? (r.sell_price_min || r.sell_price_max) : (r.buy_price_min || r.buy_price_max),
      })),
      borderColor: CITY_COLORS[city] || '#888',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.3,
    }));

    const canvas = content.querySelector('#priceChart');
    chartInstance = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#8a8070', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#1e1e2a',
            titleColor: '#e6d9b8',
            bodyColor: '#c9a94e',
            borderColor: '#2a2a3a',
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                if (!items.length) return '';
                return new Date(items[0].parsed.x).toLocaleString('pt-BR');
              },
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString('pt-BR')}`,
            },
          },
        },
        scales: {
          x: {
            type: 'timeseries',
            time: { tooltipFormat: 'dd/MM/yyyy HH:mm' },
            ticks: { color: '#8a8070', font: { size: 10 }, maxTicksLimit: 12 },
            grid: { color: '#1e1e2a' },
          },
          y: {
            ticks: { color: '#8a8070', font: { size: 10 }, callback: (v) => v?.toLocaleString('pt-BR') },
            grid: { color: '#1e1e2a' },
          },
        },
      },
    });
  }
}
