function fmtPrice(v) {
  if (!v && v !== 0) return '—';
  return Number(v).toLocaleString('pt-BR');
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

    await loadVariantDetail(variant.unique_name, variant.name_ptbr || selected.base, selected.tier);
  }

  function getItemIconUrl(uniqueName) {
    return `https://render.albiononline.com/v1/item/${uniqueName}?quality=1&size=128`;
  }

  async function loadVariantDetail(uniqueName, itemName, tier) {
    const panel = document.getElementById('itemResultPanel');
    panel.innerHTML = '<div class="loading">Carregando...</div>';

    try {
      const enchantLevel = parseInt(String(uniqueName).match(/@(\d+)$/)?.[1] || '0', 10);

      const [latest, history, recipeData, flipData, recipeCheck] = await Promise.all([
        getLatestPrices(uniqueName, 1),
        getPriceHistory(uniqueName, 500, 1),
        getRecipe(uniqueName),
        getFlipperForItem(uniqueName),
        hasRecipe(uniqueName),
      ]);

      const hasDirectRecipe = !!(recipeData && recipeData.recipe);
      const recipeLevel = recipeData.recipe_level || recipeCheck.level;
      const isCraftable = hasDirectRecipe || recipeCheck.has_recipe || enchantLevel > 0;
      const hasExactRecipe = recipeLevel === 'direct';
      const recipe = { has_recipe: isCraftable, materials: (recipeData && recipeData.resources) || [], recipe_level: recipeLevel, has_exact: hasExactRecipe };
      const lowConfidence = latest.low_confidence || history.low_confidence;

      const sells = latest.map(r => r.sell_price_min).filter(Boolean);
      const menor = sells.length ? Math.min(...sells) : null;
      const maior = sells.length ? Math.max(...sells) : null;
      const spread = (menor && maior) ? (((maior - menor) / menor) * 100).toFixed(1) : null;
      const melhorCompraCidade = menor ? latest.find(r => r.sell_price_min === menor)?.city : null;
      const melhorVendaCidade = maior ? latest.find(r => r.sell_price_min === maior)?.city : null;
      const lastUpdate = latest.length
        ? latest.reduce((a, b) => new Date(a.observed_at) > new Date(b.observed_at) ? a : b).observed_at
        : null;

      let html = '';

      const iconUrl = getItemIconUrl(uniqueName);
      const tierColor = TIER_COLORS[tier] || '#888';
      const enchantLabel = selected.enchantment > 0 ? `@${selected.enchantment}` : '';

      html += `
        <div class="item-hero">
          <div class="item-hero-icon-wrap">
            <div class="item-hero-glow" style="background:radial-gradient(circle,${tierColor}33 0%,transparent 70%)"></div>
            <img src="${iconUrl}" alt="${itemName}" class="item-hero-icon" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a26%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23888%22 font-size=%2214%22>?</text></svg>'" />
          </div>
          <div class="item-hero-info">
            <div class="item-hero-row">
              <h2 class="item-hero-name">${itemName}</h2>
              <span class="item-hero-tier" style="background:${tierColor}">T${tier}</span>
              ${enchantLabel ? `<span class="item-hero-tier item-hero-enchant">${enchantLabel}</span>` : ''}
              <span class="item-hero-cat">${selected.category}</span>
            </div>
            <div class="item-hero-id">${uniqueName}</div>
            <div class="item-hero-metrics">
              <div class="item-metric">
                <span class="item-metric-label">Menor</span>
                <span class="item-metric-value price-gold">${menor ? fmtPrice(menor) : '—'}</span>
                ${melhorCompraCidade ? `<span class="item-metric-city">${melhorCompraCidade}</span>` : ''}
              </div>
              <div class="item-metric-sep">→</div>
              <div class="item-metric">
                <span class="item-metric-label">Maior</span>
                <span class="item-metric-value price-green">${maior ? fmtPrice(maior) : '—'}</span>
                ${melhorVendaCidade ? `<span class="item-metric-city">${melhorVendaCidade}</span>` : ''}
              </div>
              <div class="item-metric-sep">·</div>
              <div class="item-metric">
                <span class="item-metric-label">Spread</span>
                <span class="item-metric-value price-purple">${spread ? spread + '%' : '—'}</span>
              </div>
              <div class="item-metric-sep">·</div>
              <div class="item-metric">
                <span class="item-metric-label">Craftável</span>
                <span class="item-metric-value ${recipe.has_recipe ? 'price-green' : 'price-dim'}">${recipe.has_recipe ? 'Sim' : 'Não'}</span>
              </div>
            </div>
            <div class="item-hero-updated">Última atualização: ${timeAgo(lastUpdate)}</div>
          </div>
          ${lowConfidence ? `
            <div class="item-hero-warning">
              <span>⚠</span> Poucos registros — dado pode não refletir o mercado real.
            </div>
          ` : ''}
        </div>`;

      const sortedCities = [...latest].sort((a, b) => (a.sell_price_min || Infinity) - (b.sell_price_min || Infinity));

      html += `<div class="item-route card" style="margin-bottom:1rem">
        <div class="section-title">Rotas de Comércio</div>
        <div class="route-flow">
          ${sortedCities.map((r, i) => {
            const isCheapest = r.city === melhorCompraCidade;
            const isDearest = r.city === melhorVendaCidade;
            const cityClass = isCheapest ? 'route-city--buy' : isDearest ? 'route-city--sell' : '';
            return `
              ${i > 0 ? '<div class="route-arrow"><span>→</span></div>' : ''}
              <div class="route-city ${cityClass}">
                <div class="route-city-name">${r.city}</div>
                <div class="route-city-sell price-gold">${fmtPrice(r.sell_price_min)}</div>
                <div class="route-city-buy">${r.buy_price_max ? fmtPrice(r.buy_price_max) : '—'}</div>
                <div class="route-city-source">
                  <span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>`;

      const hasOpportunity = flipData && flipData.net_profit > 0;

      if (history.length) {
        html += `<div class="item-chart-zone card" style="margin-bottom:1rem;position:relative">
          <div class="item-chart-header">
            <div class="section-title" style="margin-bottom:0">Histórico de Preços</div>
            <div class="pill-bar" id="chartRangeBar">
              <button class="pill" data-hours="6">6h</button>
              <button class="pill active" data-hours="24">24h</button>
              <button class="pill" data-hours="168">7d</button>
            </div>
          </div>
          ${hasOpportunity ? `
            <div class="item-chart-opp-overlay">
              <div class="opp-badge opp-badge--flip">
                <span class="opp-badge-icon">⚡</span>
                <span class="opp-badge-label">FLIP</span>
                <span class="opp-badge-profit price-green">+${fmtPrice(flipData.net_profit)} <small>(${flipData.roi_percent}%)</small></span>
                <span class="opp-badge-route">${flipData.origin_city} → Black Market</span>
              </div>
            </div>
          ` : ''}
          ${recipe.has_recipe ? `
            <div class="item-chart-opp-overlay item-chart-opp-overlay--below">
              <div class="opp-badge opp-badge--craft">
                <span class="opp-badge-icon">🔨</span>
                <span class="opp-badge-label">CRAFT</span>
                <span class="opp-badge-link"><a href="#/craft">Ver calculadora →</a></span>
              </div>
            </div>
          ` : ''}
          <div class="item-chart-canvas-wrap"><canvas id="detailChart"></canvas></div>
          <div class="item-chart-stats" id="chartStatsRow"></div>
        </div>`;
      } else if (hasOpportunity || recipe.has_recipe) {
        html += `<div class="card" style="margin-bottom:1rem">
          ${hasOpportunity ? `
            <div class="opp-badge opp-badge--flip" style="margin-bottom:0.5rem">
              <span class="opp-badge-icon">⚡</span>
              <span class="opp-badge-label">FLIP</span>
              <span class="opp-badge-profit price-green">+${fmtPrice(flipData.net_profit)} <small>(${flipData.roi_percent}%)</small></span>
              <span class="opp-badge-route">${flipData.origin_city} → Black Market</span>
            </div>
          ` : ''}
          ${recipe.has_recipe ? `
            <div class="opp-badge opp-badge--craft">
              <span class="opp-badge-icon">🔨</span>
              <span class="opp-badge-label">CRAFT</span>
              <span class="opp-badge-link"><a href="#/craft">Ver calculadora completa →</a></span>
            </div>
          ` : ''}
        </div>`;
      }

      if (recipe.has_recipe) {
        html += `<div class="item-tree card" id="recipeBlock"></div>`;
      }

      panel.innerHTML = html;

      if (history.length) {
        renderDetailChart(history, 24);
        document.getElementById('chartRangeBar').addEventListener('click', (e) => {
          const btn = e.target.closest('button');
          if (!btn) return;
          document.querySelectorAll('#chartRangeBar button').forEach(b => b.classList.toggle('active', b === btn));
          renderDetailChart(history, Number(btn.dataset.hours));
        });
      }

      if (recipe.has_recipe) {
        renderCraftTree(recipe, latest, menor);
      }

    } catch (e) {
      panel.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  async function renderCraftTree(recipe, latest, sellPrice) {
    const block = document.getElementById('recipeBlock');
    if (!block) return;

    const uniqueName = variants.find(v => v.tier === selected.tier && v.enchantment === selected.enchantment)?.unique_name || '';
    const enchantLevel = parseInt(String(uniqueName).match(/@(\d+)$/)?.[1] || '0', 10);

    if (enchantLevel > 0 && !recipe.has_exact) {
      block.innerHTML = `
        <div class="section-title">Receita de Craft</div>
        <div class="craft-tree">
          <div class="craft-tree-upgrade-notice">
            <div class="craft-tree-upgrade-icon">⬆</div>
            <div class="craft-tree-upgrade-info">
              <span class="craft-tree-upgrade-title">Upgrade via Runa/Alma/Relíquia</span>
              <span class="craft-tree-upgrade-desc">Este item não tem receita de craft direta. O caminho é fazer o item base @0 e aplicar encantamento.</span>
            </div>
          </div>
        </div>
      `;
      return;
    }

    block.innerHTML = '<div class="section-title">Receita de Craft</div><div class="loading" style="font-size:0.75rem">Calculando custo...</div>';

    try {
      const materialPricesArr = await Promise.all(
        recipe.materials.map(m => getLatestPrices(m.unique_name || m.resource_unique_name).catch(() => []))
      );

      const rows = recipe.materials.map((m, idx) => {
        const rName = m.unique_name || m.resource_unique_name;
        const rCount = m.quantity || m.count;
        const mName = m.name_ptbr || rName;
        const iconUrl = getItemIconUrl(rName);
        const prices = materialPricesArr[idx];
        const cityPrices = prices.filter(p => p.city && p.sell_price_min > 0);
        const cheapest = cityPrices.length ? cityPrices.reduce((a, b) => a.sell_price_min < b.sell_price_min ? a : b) : null;
        const unitPrice = cheapest ? cheapest.sell_price_min : 0;
        return { name: mName, resource: rName, count: rCount, unitPrice, city: cheapest?.city, subtotal: unitPrice * rCount, iconUrl };
      });

      const totalCost = rows.reduce((acc, r) => acc + r.subtotal, 0);

      block.innerHTML = `
        <div class="section-title">Receita de Craft</div>
        <div class="craft-tree">
          <div class="craft-tree-root">
            <div class="craft-tree-node craft-tree-node--final">
              <img src="${getItemIconUrl(recipe.materials[0]?.unique_name ? recipe.materials[0].unique_name.replace(/T\d+_.*$/, selected.base) : '')}" class="craft-tree-node-icon" onerror="this.style.display='none'" />
              <div class="craft-tree-node-info">
                <span class="craft-tree-node-name">${recipe.recipe?.item_name || selected.base}</span>
                <span class="craft-tree-node-sub">Item final</span>
              </div>
            </div>
            <div class="craft-tree-stem"></div>
            <div class="craft-tree-branches">
              ${rows.map(r => `
                <div class="craft-tree-branch">
                  <div class="craft-tree-connector"></div>
                  <div class="craft-tree-node">
                    <img src="${r.iconUrl}" class="craft-tree-node-icon" onerror="this.style.display='none'" />
                    <div class="craft-tree-node-info">
                      <span class="craft-tree-node-name">${r.name}</span>
                      <span class="craft-tree-node-sub">${r.count}x</span>
                    </div>
                    <div class="craft-tree-node-price">
                      <span class="price-gold">${fmtPrice(r.subtotal)}</span>
                      ${r.city ? `<span class="craft-tree-city">${r.city}</span>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="craft-tree-footer">
            <span>Custo total</span>
            <span class="price-gold craft-tree-total">${fmtPrice(totalCost)}</span>
          </div>
          ${sellPrice ? `
            <div class="craft-tree-profit">
              Lucro estimado (venda direta, sem taxa):
              <span class="${sellPrice - totalCost > 0 ? 'price-green' : 'price-red'}">${fmtPrice(sellPrice - totalCost)}</span>
            </div>
          ` : ''}
          <a href="#/craft" class="craft-tree-link">Calculadora de Craft completa →</a>
        </div>
      `;
    } catch (e) {
      block.innerHTML = `<div class="section-title">Receita de Craft</div><div style="font-size:0.75rem;color:#e74c3c">Erro ao calcular: ${e.message}</div>`;
    }
  }

  function renderDetailChart(history, hours) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const filtered = history.filter(r => new Date(r.observed_at).getTime() >= cutoff);

    const CITY_COLORS = {
      'Caerleon': '#c9a94e', 'Bridgewatch': '#e67e22', 'Lymhurst': '#27ae60',
      'Martlock': '#3498db', 'Fort Sterling': '#ecf0f1', 'Thetford': '#8e44ad', 'Black Market': '#e74c3c',
    };
    const byCity = {};
    for (const row of [...filtered].reverse()) {
      if (!byCity[row.city]) byCity[row.city] = [];
      byCity[row.city].push(row);
    }
    const datasets = Object.entries(byCity).map(([city, rows]) => ({
      label: city,
      data: rows.map(r => ({ x: new Date(r.observed_at), y: r.sell_price_min || r.sell_price_max })),
      borderColor: CITY_COLORS[city] || '#888', backgroundColor: 'transparent',
      borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 5, tension: 0.3,
    }));

    const allValues = filtered.map(r => r.sell_price_min || r.sell_price_max).filter(Boolean);
    const avg = allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
    const first = filtered.length ? (filtered[filtered.length - 1].sell_price_min || 0) : 0;
    const last = filtered.length ? (filtered[0].sell_price_min || 0) : 0;
    const variacao = first ? (((last - first) / first) * 100).toFixed(1) : 0;
    const tendencia = variacao > 2 ? 'alta' : variacao < -2 ? 'baixa' : 'lateral';

    const statsRow = document.getElementById('chartStatsRow');
    if (statsRow) {
      statsRow.innerHTML = `
        <div class="item-chart-stat">
          <span class="item-chart-stat-label">Último</span>
          <span class="item-chart-stat-value price-gold">${fmtPrice(last)}</span>
        </div>
        <div class="item-chart-stat">
          <span class="item-chart-stat-label">Média</span>
          <span class="item-chart-stat-value price-purple">${fmtPrice(Math.round(avg))}</span>
        </div>
        <div class="item-chart-stat">
          <span class="item-chart-stat-label">Variação</span>
          <span class="item-chart-stat-value ${variacao > 0 ? 'price-green' : variacao < 0 ? 'price-red' : 'price-dim'}">${variacao}%</span>
        </div>
        <div class="item-chart-stat">
          <span class="item-chart-stat-label">Tendência</span>
          <span class="item-chart-stat-value ${tendencia === 'alta' ? 'price-green' : tendencia === 'baixa' ? 'price-red' : 'price-dim'}">${tendencia}</span>
        </div>
      `;
    }

    const ctx = document.getElementById('detailChart');
    if (!ctx) return;
    if (window.__detailChartInstance) window.__detailChartInstance.destroy();
    window.__detailChartInstance = new Chart(ctx, {
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
