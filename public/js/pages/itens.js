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

  async function loadVariantDetail(uniqueName, itemName, tier) {
    const panel = document.getElementById('itemResultPanel');
    panel.innerHTML = '<div class="loading">Carregando...</div>';

    try {
      const [latest, history, recipeData, flipData] = await Promise.all([
        getLatestPrices(uniqueName, 1),
        getPriceHistory(uniqueName, 500, 1),
        getRecipe(uniqueName),
        getFlipperForItem(uniqueName),
      ]);

      const recipe = { has_recipe: !!(recipeData && recipeData.recipe), materials: (recipeData && recipeData.resources) || [] };
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

      html += `<div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:0.8rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">${itemName}</h2>
        <span style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${uniqueName}</span>
        <span class="badge badge-gold" style="background:${TIER_COLORS[tier] || '#888'}">T${tier}</span>
        ${selected.enchantment > 0 ? `<span class="badge badge-purple">@${selected.enchantment}</span>` : ''}
        <span class="badge badge-surface">${selected.category}</span>
      </div>`;

      if (lowConfidence) {
        html += `<div style="font-size:0.7rem;color:var(--warning,#e67e22);margin-bottom:1rem;padding:0.4rem 0.6rem;background:rgba(230,126,34,0.08);border-radius:4px;border-left:3px solid var(--warning,#e67e22)">
          &#9888; Poucos registros disponíveis — dado pode não refletir o mercado real.
        </div>`;
      }

      html += `<div class="grid-4" style="gap:0.8rem;margin-bottom:1rem">
        <div class="stat-box"><div class="value">${menor ? fmtPrice(menor) : '—'}</div><div class="label">Menor preço</div></div>
        <div class="stat-box"><div class="value">${maior ? fmtPrice(maior) : '—'}</div><div class="label">Maior preço</div></div>
        <div class="stat-box"><div class="value">${spread ?? '—'}%</div><div class="label">Spread</div></div>
        <div class="stat-box"><div class="value">${recipe.has_recipe ? 'Sim' : 'Não'}</div><div class="label">Craftável</div></div>
      </div>
      <div style="font-size:0.7rem;color:var(--text-dim);margin-bottom:1rem">
        Última atualização: ${timeAgo(lastUpdate)}
      </div>`;

      html += `<div class="grid-2" style="gap:1rem;align-items:start;margin-bottom:1rem">
        <div class="card">
          <div class="section-title">Preços por Cidade</div>
          <table class="price-table">
            <thead><tr><th>Cidade</th><th>Pedido de Venda</th><th>Pedido de Compra</th><th>Fonte</th><th>Atualizado</th></tr></thead>
            <tbody>${latest.length ? latest.map(r => `<tr>
              <td class="city">${r.city}
                ${r.city === melhorCompraCidade ? ' <span style="color:var(--gold);font-size:0.6rem">(melhor compra)</span>' : ''}
                ${r.city === melhorVendaCidade ? ' <span style="color:#27ae60;font-size:0.6rem">(melhor venda)</span>' : ''}
              </td>
              <td class="price">${fmtPrice(r.sell_price_min)}</td>
              <td class="price">${fmtPrice(r.buy_price_max)}</td>
              <td><span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span></td>
              <td class="time-ago">${timeAgo(r.observed_at)}</td>
            </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">Sem dados disponíveis</td></tr>'}</tbody>
          </table>
        </div>
        <div class="card">
          <div class="section-title">Oportunidades</div>
          ${renderOpportunities(flipData, recipe, latest, uniqueName)}
        </div>
      </div>`;

      if (history.length) {
        html += `<div class="card" style="margin-bottom:1rem">
          <div class="section-title">Gráfico de Preços</div>
          <div class="pill-bar" id="chartRangeBar" style="margin-bottom:0.6rem">
            <button class="pill active" data-hours="6">6h</button>
            <button class="pill" data-hours="24">24h</button>
            <button class="pill" data-hours="168">7d</button>
          </div>
          <div class="chart-container"><canvas id="detailChart"></canvas></div>
          <div class="grid-4" style="gap:0.6rem;margin-top:0.8rem" id="chartStatsRow"></div>
        </div>`;
      }

      if (recipe.has_recipe) {
        html += `<div class="card" style="margin-bottom:1rem" id="recipeBlock"></div>`;
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
        renderInlineRecipe(recipe, latest, menor);
      }

    } catch (e) {
      panel.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  function renderOpportunities(flipData, recipe, latest, uniqueName) {
    const blocks = [];

    if (flipData && flipData.net_profit > 0) {
      blocks.push(`
        <div style="border-left:3px solid var(--gold);padding:0.6rem 0.8rem;margin-bottom:0.6rem;background:rgba(201,169,78,0.06)">
          <div style="font-size:0.7rem;color:var(--gold);font-weight:700;margin-bottom:0.2rem">OPORTUNIDADE DE FLIP</div>
          <div style="font-size:0.8rem">Comprar em ${flipData.origin_city} e vender no Black Market</div>
          <div style="font-size:0.85rem;color:#27ae60;font-weight:700">Lucro: ${fmtPrice(flipData.net_profit)} (${flipData.roi_percent}%)</div>
        </div>
      `);
    } else {
      blocks.push(`<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.6rem">Sem oportunidade válida de flip no momento.</div>`);
    }

    if (recipe.has_recipe) {
      blocks.push(`<div style="font-size:0.7rem;color:var(--text-dim)">Craft: veja a seção "Receita de Craft" abaixo para custo detalhado.</div>`);
    }

    return blocks.join('');
  }

  async function renderInlineRecipe(recipe, latest, sellPrice) {
    const block = document.getElementById('recipeBlock');
    if (!block) return;
    block.innerHTML = '<div class="section-title">Receita de Craft</div><div class="loading" style="font-size:0.75rem">Calculando custo...</div>';

    try {
      const materialPricesArr = await Promise.all(
        recipe.materials.map(m => getLatestPrices(m.unique_name || m.resource_unique_name).catch(() => []))
      );

      const rows = recipe.materials.map((m, idx) => {
        const rName = m.unique_name || m.resource_unique_name;
        const rCount = m.quantity || m.count;
        const mName = m.name_ptbr || rName;
        const prices = materialPricesArr[idx];
        const cityPrices = prices.filter(p => p.city && p.sell_price_min > 0);
        const cheapest = cityPrices.length ? cityPrices.reduce((a, b) => a.sell_price_min < b.sell_price_min ? a : b) : null;
        const unitPrice = cheapest ? cheapest.sell_price_min : 0;
        return { name: mName, resource: rName, count: rCount, unitPrice, city: cheapest?.city, subtotal: unitPrice * rCount };
      });

      const totalCost = rows.reduce((acc, r) => acc + r.subtotal, 0);

      block.innerHTML = `
        <div class="section-title">Receita de Craft</div>
        <table class="price-table">
          <thead><tr><th>Material</th><th>Qtd</th><th>Preço usado</th><th>Custo total</th></tr></thead>
          <tbody>${rows.map(r => `<tr>
            <td>${r.name}</td>
            <td>${r.count}x</td>
            <td class="price">${r.unitPrice ? `${fmtPrice(r.unitPrice)} (${r.city})` : 'sem dado'}</td>
            <td class="price">${fmtPrice(r.subtotal)}</td>
          </tr>`).join('')}</tbody>
        </table>
        <div style="margin-top:0.6rem;font-size:0.85rem;font-weight:700">Custo total: ${fmtPrice(totalCost)}</div>
        ${sellPrice ? `<div style="font-size:0.8rem;color:${sellPrice - totalCost > 0 ? '#27ae60' : '#e74c3c'}">Lucro estimado (venda direta, sem taxa): ${fmtPrice(sellPrice - totalCost)}</div>` : ''}
        <a href="#/craft" style="font-size:0.75rem;color:var(--gold);display:inline-block;margin-top:0.5rem">Ir para Calculadora de Craft completa →</a>
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
        <div class="stat-box"><div class="value">${fmtPrice(last)}</div><div class="label">Último</div></div>
        <div class="stat-box"><div class="value">${fmtPrice(Math.round(avg))}</div><div class="label">Média</div></div>
        <div class="stat-box"><div class="value">${variacao}%</div><div class="label">Variação</div></div>
        <div class="stat-box"><div class="value" style="color:${tendencia === 'alta' ? '#27ae60' : tendencia === 'baixa' ? '#e74c3c' : 'var(--text-dim)'}">${tendencia}</div><div class="label">Tendência</div></div>
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
