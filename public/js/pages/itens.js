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

const TIER_COLORS = { 3: '#6b6b6b', 4: '#2d8f2d', 5: '#2277dd', 6: '#9944cc', 7: '#dd7700', 8: '#cc2222' };

function createSearchableSelect(containerId, options, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return { setValue: () => {}, setEnabled: () => {}, load: () => {} };

  const trigger = container.querySelector('.ss-trigger');
  const dropdown = container.querySelector('.ss-dropdown');
  const search = container.querySelector('.ss-search');
  const list = container.querySelector('.ss-list');

  let currentValue = null;
  let isOpen = false;

  function renderList(filter) {
    const f = (filter || '').toLowerCase();
    const filtered = options.filter(o => o.label.toLowerCase().includes(f));
    if (!filtered.length) {
      list.innerHTML = '<div class="ss-item ss-empty">Nenhum resultado</div>';
      return;
    }
    list.innerHTML = filtered.map(o =>
      `<div class="ss-item${o.value === currentValue ? ' selected' : ''}" data-value="${o.value}">${o.label}${o.meta ? `<span class="ss-item-meta">${o.meta}</span>` : ''}</div>`
    ).join('');
    list.querySelectorAll('.ss-item[data-value]').forEach(el => {
      el.addEventListener('click', () => {
        currentValue = el.dataset.value;
        const chosen = options.find(o => o.value === currentValue);
        trigger.textContent = chosen ? chosen.label : 'Selecione...';
        trigger.classList.remove('placeholder');
        close();
        onSelect(currentValue);
      });
    });
  }

  function open() {
    closeAllSelects();
    isOpen = true;
    dropdown.classList.add('active');
    container.classList.add('open');
    search.value = '';
    search.focus();
    renderList('');
  }

  function close() {
    isOpen = false;
    dropdown.classList.remove('active');
    container.classList.remove('open');
  }

  trigger.addEventListener('click', () => isOpen ? close() : open());
  search.addEventListener('input', () => renderList(search.value));

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) close();
  });

  renderList('');

  return {
    setValue(v) {
      currentValue = v;
      const chosen = options.find(o => o.value === v);
      if (chosen) {
        trigger.textContent = chosen.label;
        trigger.classList.remove('placeholder');
      }
    },
    setEnabled(enabled) {
      trigger.disabled = !enabled;
      if (!enabled) {
        trigger.textContent = 'Selecione um item';
        trigger.classList.add('placeholder');
      }
    },
    load(newOptions) {
      options.length = 0;
      options.push(...newOptions);
      renderList(search ? search.value : '');
    },
    getValue() { return currentValue; },
  };
}

function closeAllSelects() {
  document.querySelectorAll('.searchable-select.open').forEach(el => {
    el.classList.remove('open');
    const dd = el.querySelector('.ss-dropdown');
    if (dd) dd.classList.remove('active');
  });
}

Router.register('/itens', async (app) => {
  let allCategories = [];
  let allBases = [];
  let variants = [];
  let selected = { category: '', base: '', tier: null, enchantment: null };

  app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:0 1.5rem">
      <div class="card" style="padding:1.25rem;margin-bottom:1rem">
        <div class="section-title" style="margin-bottom:1rem">Filtro de Item</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div>
            <label class="filter-label">Categoria</label>
            <div class="searchable-select" id="categorySelect">
              <button type="button" class="ss-trigger placeholder" id="categoryTrigger">Selecione uma categoria</button>
              <div class="ss-dropdown" id="categoryDropdown">
                <input type="text" class="input ss-search" id="categorySearch" placeholder="Buscar categoria..." />
                <div class="ss-list" id="categoryList"></div>
              </div>
            </div>
          </div>
          <div>
            <label class="filter-label">Item</label>
            <div class="searchable-select" id="itemSelect">
              <button type="button" class="ss-trigger placeholder" id="itemTrigger" disabled>Selecione um item</button>
              <div class="ss-dropdown" id="itemDropdown">
                <input type="text" class="input ss-search" id="itemSearchInput" placeholder="Buscar item..." />
                <div class="ss-list" id="itemListDropdown"></div>
              </div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:1rem;align-items:end">
          <div>
            <label class="filter-label">Níveis</label>
            <div class="pill-bar" id="tierPills"><span class="pill-empty">Selecione um item</span></div>
          </div>
          <div>
            <label class="filter-label">Encantamentos</label>
            <div class="pill-bar" id="enchantPills"><span class="pill-empty">Selecione um item</span></div>
          </div>
          <button class="btn btn-gold" id="updateSearchBtn" disabled style="height:34px;white-space:nowrap">Atualizar pesquisa</button>
        </div>
      </div>
      <div id="itemResultPanel"></div>
    </div>
  `;

  const catOptions = [];
  let catSelect;
  let itemSelect;

  try {
    allCategories = await getCategories();
    allCategories.forEach(c => {
      if (c.category !== 'Dados Privados') {
        catOptions.push({ value: c.category, label: `${c.category} (${c.count})` });
      }
    });
  } catch (e) { allCategories = []; }

  catSelect = createSearchableSelect('categorySelect', catOptions, async (catValue) => {
    selected.category = catValue;
    selected.base = '';
    selected.tier = null;
    selected.enchantment = null;

    itemSelect.setEnabled(false);
    itemSelect.load([]);
    renderTierPills([]);
    renderEnchantPills([]);
    document.getElementById('updateSearchBtn').disabled = true;
    document.getElementById('itemResultPanel').innerHTML = '';

    try {
      allBases = await getItemBases(catValue);
      const baseOpts = allBases.map(b => ({
        value: b.item_base,
        label: b.name_ptbr || b.item_base,
        meta: `${b.variant_count} vars`,
      }));
      itemSelect.load(baseOpts);
      itemSelect.setEnabled(true);
    } catch (e) { allBases = []; }
  });

  const itemOptions = [];
  itemSelect = createSearchableSelect('itemSelect', itemOptions, async (baseValue) => {
    selected.base = baseValue;
    selected.tier = null;
    selected.enchantment = null;
    document.getElementById('updateSearchBtn').disabled = true;

    try {
      variants = await getItemVariants(baseValue);
      const tiers = [...new Set(variants.map(v => v.tier))].sort((a, b) => a - b);
      const enchantments = [...new Set(variants.map(v => v.enchantment))].sort((a, b) => a - b);
      renderTierPills(tiers);
      renderEnchantPills(enchantments);
    } catch (e) {
      variants = [];
      renderTierPills([]);
      renderEnchantPills([]);
    }
  });

  function renderTierPills(tiers) {
    const el = document.getElementById('tierPills');
    if (!tiers.length) {
      el.innerHTML = '<span class="pill-empty">Selecione um item</span>';
      return;
    }
    el.innerHTML = tiers.map(t =>
      `<button class="pill" data-tier="${t}">T${t}</button>`
    ).join('');
    el.querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selected.tier = parseInt(btn.dataset.tier);
        checkReady();
      });
    });
  }

  function renderEnchantPills(enchantments) {
    const el = document.getElementById('enchantPills');
    if (!enchantments.length) {
      el.innerHTML = '<span class="pill-empty">Selecione um item</span>';
      return;
    }
    el.innerHTML = enchantments.map(e =>
      `<button class="pill" data-enchant="${e}">@${e}</button>`
    ).join('');
    el.querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selected.enchantment = parseInt(btn.dataset.enchant);
        checkReady();
      });
    });
  }

  function checkReady() {
    const ready = selected.base && selected.tier !== null && selected.enchantment !== null;
    document.getElementById('updateSearchBtn').disabled = !ready;
  }

  document.getElementById('updateSearchBtn').addEventListener('click', runSearch);

  async function runSearch() {
    if (!selected.base || selected.tier === null || selected.enchantment === null) return;

    const variant = variants.find(v => v.tier === selected.tier && v.enchantment === selected.enchantment);
    if (!variant) {
      document.getElementById('itemResultPanel').innerHTML = '<div class="empty-state"><p>Combinação não encontrada</p></div>';
      return;
    }

    const itemId = variant.unique_name;
    const panel = document.getElementById('itemResultPanel');
    panel.innerHTML = '<div class="loading">Carregando preços...</div>';

    try {
      const [latest, history] = await Promise.all([
        getLatestPrices(itemId),
        getPriceHistory(itemId, 500),
      ]);

      let html = '';

      html += `<div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">${variant.name_ptbr || selected.base}</h2>
        <span style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${itemId}</span>
        <span class="badge badge-gold" style="background:${TIER_COLORS[selected.tier] || '#888'}">T${selected.tier}</span>
        ${selected.enchantment > 0 ? `<span class="badge badge-purple">@${selected.enchantment}</span>` : ''}
        <span class="badge badge-surface">${selected.category}</span>
      </div>`;

      if (latest.length) {
        html += `<div class="card" style="margin-bottom:1rem">
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
        </div>`;
      } else {
        html += '<div class="card" style="margin-bottom:1rem;padding:1.5rem;text-align:center;color:var(--text-dim);font-size:0.8rem">Sem dados de preço disponíveis</div>';
      }

      if (history.length) {
        const sells = history.filter(h => h.sell_price_min).map(h => h.sell_price_min);
        const buys = history.filter(h => h.buy_price_min).map(h => h.buy_price_min);
        const avgSell = sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 0;
        const minSell = sells.length ? Math.min(...sells) : 0;
        const maxSell = sells.length ? Math.max(...sells) : 0;
        const avgBuy = buys.length ? Math.round(buys.reduce((a, b) => a + b, 0) / buys.length) : 0;

        html += `<div class="card" style="margin-bottom:1rem">
          <div class="section-title">Estatísticas</div>
          <div class="grid-3">
            <div class="stat-box"><div class="value">${fmtPrice(avgSell)}</div><div class="label">Venda médio</div></div>
            <div class="stat-box"><div class="value">${fmtPrice(minSell)}</div><div class="label">Venda mín</div></div>
            <div class="stat-box"><div class="value">${fmtPrice(maxSell)}</div><div class="label">Venda máx</div></div>
            <div class="stat-box"><div class="value">${fmtPrice(avgBuy)}</div><div class="label">Compra médio</div></div>
            <div class="stat-box"><div class="value">${history.length}</div><div class="label">Registros</div></div>
            <div class="stat-box"><div class="value">${new Set(history.map(h => h.city)).size}</div><div class="label">Cidades</div></div>
          </div>
        </div>`;

        html += `<div class="card">
          <div class="section-title">Gráfico de Preços</div>
          <div class="chart-controls" id="itemDetailMetric">
            <button class="active" data-metric="sell">Venda</button>
            <button data-metric="buy">Compra</button>
          </div>
          <div class="chart-container"><canvas id="itemDetailChart"></canvas></div>
        </div>`;
      }

      panel.innerHTML = html;

      if (history.length) {
        drawDetailChart(history, 'sell');
        document.getElementById('itemDetailMetric').addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          document.querySelectorAll('#itemDetailMetric button').forEach(b => b.classList.toggle('active', b === btn));
          drawDetailChart(history, btn.dataset.metric);
        });
      }

    } catch (e) {
      panel.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  function drawDetailChart(history, metric) {
    const CITY_COLORS = {
      'Caerleon': '#c9a94e', 'Bridgewatch': '#e67e22', 'Lymhurst': '#27ae60',
      'Martlock': '#3498db', 'Fort Sterling': '#ecf0f1', 'Thetford': '#8e44ad', 'Black Market': '#e74c3c',
    };

    const byCity = {};
    for (const row of [...history].reverse()) {
      if (!byCity[row.city]) byCity[row.city] = [];
      byCity[row.city].push(row);
    }

    const canvas = document.getElementById('itemDetailChart');
    if (!canvas) return;

    const datasets = Object.entries(byCity).map(([city, rows]) => ({
      label: city,
      data: rows.map(r => ({ x: new Date(r.observed_at), y: metric === 'sell' ? (r.sell_price_min || r.sell_price_max) : (r.buy_price_min || r.buy_price_max) })),
      borderColor: CITY_COLORS[city] || '#888', backgroundColor: 'transparent',
      borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 5, tension: 0.3,
    }));

    if (canvas._chartInstance) canvas._chartInstance.destroy();
    canvas._chartInstance = new Chart(canvas, {
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
          x: { type: 'time', time: { tooltipFormat: 'dd/MM/yyyy HH:mm', unit: 'hour' }, ticks: { color: '#8a8070', font: { size: 9 }, maxTicksLimit: 10 }, grid: { color: '#1e1e2a' } },
          y: { ticks: { color: '#8a8070', font: { size: 9 }, callback: v => v?.toLocaleString('pt-BR') }, grid: { color: '#1e1e2a' } },
        },
      },
    });
  }
});
