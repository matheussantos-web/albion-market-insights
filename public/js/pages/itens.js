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

const QUALITY_LABELS = { 0: 'Normal', 1: 'Incomum', 2: 'Raro', 3: 'Épico', 4: 'Lendário' };
const TIER_NAMES = { 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'T8' };

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

function tierIcon(tier) {
  const colors = { 3: '#6b6b6b', 4: '#2d8f2d', 5: '#2277dd', 6: '#9944cc', 7: '#dd7700', 8: '#cc2222' };
  return `<span style="color:${colors[tier] || '#888'};font-weight:700;font-size:0.8rem">T${tier}</span>`;
}

Router.register('/itens', async (app, params) => {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  let activeCategory = urlParams.get('cat') || '';
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
        <div id="breadcrumb" style="margin-bottom:0.8rem;font-size:0.75rem;color:var(--text-dim)">
          <span style="color:var(--gold);cursor:pointer" id="bcAll">Todos</span>
        </div>
        <div id="itemGrid" class="card" style="padding:1rem"></div>
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
        loadBases();
      });
    });
  }

  function setBreadcrumb(parts) {
    const bc = document.getElementById('breadcrumb');
    let html = `<span style="color:var(--gold);cursor:pointer" id="bcAll">Todos</span>`;
    parts.forEach((p, i) => {
      html += ` <span style="color:var(--text-dim)">▸</span> `;
      if (i < parts.length - 1) {
        html += `<span style="color:var(--gold);cursor:pointer" class="bc-link" data-level="${i}">${p.label}</span>`;
      } else {
        html += `<span style="color:var(--text)">${p.label}</span>`;
      }
    });
    bc.innerHTML = html;
    document.getElementById('bcAll')?.addEventListener('click', () => {
      activeCategory = '';
      renderTree();
      loadBases();
    });
    bc.querySelectorAll('.bc-link').forEach(el => {
      el.addEventListener('click', () => {
        const level = parseInt(el.dataset.level);
        if (level === 0) { loadBases(); }
      });
    });
  }

  async function loadBases() {
    const grid = document.getElementById('itemGrid');
    grid.innerHTML = '<div class="loading">Carregando...</div>';
    setBreadcrumb([]);

    try {
      const bases = await getItemBases(activeCategory || undefined);
      if (!bases.length) {
        grid.innerHTML = '<div class="empty-state"><p>Nenhum item encontrado nesta categoria</p></div>';
        return;
      }
      grid.style.display = '';
      grid.innerHTML = `<div class="section-title">${activeCategory || 'Todos os Itens'} — ${bases.length} itens</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem;margin-top:0.6rem" id="basesList"></div>`;
      const list = document.getElementById('basesList');
      list.innerHTML = bases.map(b => `
        <div class="card" style="padding:0.7rem;cursor:pointer;transition:border-color 0.15s" data-base="${b.item_base}" data-name="${b.name_ptbr}">
          <div style="font-weight:600;font-size:0.85rem;margin-bottom:0.3rem">${b.name_ptbr || b.item_base}</div>
          <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
            ${b.tiers.map(t => `<span class="badge badge-gold">${tierIcon(t)}</span>`).join('')}
            <span class="badge badge-surface">${b.variant_count} vars</span>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.card[data-base]').forEach(el => {
        el.addEventListener('click', () => showTiers(el.dataset.base, el.dataset.name));
      });
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  async function showTiers(base, baseName) {
    const grid = document.getElementById('itemGrid');
    grid.innerHTML = '<div class="loading">Carregando variantes...</div>';
    setBreadcrumb([{ label: baseName }]);

    try {
      const variants = await getItemVariants(base);
      if (!variants.length) {
        grid.innerHTML = '<div class="empty-state"><p>Nenhuma variante encontrada</p></div>';
        return;
      }
      const tierMap = {};
      variants.forEach(v => {
        const t = v.tier;
        if (!tierMap[t]) tierMap[t] = [];
        tierMap[t].push(v);
      });
      const tiers = Object.keys(tierMap).map(Number).sort((a, b) => a - b);

      grid.style.display = '';
      grid.innerHTML = `
        <div style="margin-bottom:0.8rem">
          <a href="javascript:void(0)" id="backToBases" style="font-size:0.75rem;color:var(--gold);cursor:pointer">← Voltar a ${activeCategory || 'Todos'}</a>
        </div>
        <div class="section-title" style="margin-bottom:0.6rem">${baseName}</div>
        <div style="display:flex;flex-direction:column;gap:0.5rem" id="tierList"></div>
      `;
      document.getElementById('backToBases').addEventListener('click', loadBases);

      const tierList = document.getElementById('tierList');
      tierList.innerHTML = tiers.map(t => `
        <div class="card" style="padding:0.7rem;cursor:pointer;transition:border-color 0.15s" data-tier="${t}">
          <div style="display:flex;align-items:center;gap:0.6rem">
            ${tierIcon(t)}
            <span style="font-size:0.8rem;color:var(--text-dim)">${tierMap[t].length} variações (enc @0 a @${Math.max(...tierMap[t].map(v => v.enchantment))})</span>
          </div>
        </div>
      `).join('');
      tierList.querySelectorAll('.card[data-tier]').forEach(el => {
        el.addEventListener('click', () => showQualities(base, baseName, parseInt(el.dataset.tier), tierMap[parseInt(el.dataset.tier)]));
      });
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  async function showQualities(base, baseName, tier, variants) {
    const grid = document.getElementById('itemGrid');
    grid.innerHTML = '<div class="loading">Carregando qualidades...</div>';
    setBreadcrumb([{ label: baseName }, { label: TIER_NAMES[tier] }]);

    const variantsByEnc = {};
    variants.forEach(v => {
      const enc = v.enchantment;
      if (!variantsByEnc[enc]) variantsByEnc[enc] = [];
      variantsByEnc[enc].push(v);
    });

    const encs = Object.keys(variantsByEnc).map(Number).sort((a, b) => a - b);

    grid.style.display = '';
    grid.innerHTML = `
      <div style="margin-bottom:0.8rem">
        <a href="javascript:void(0)" id="backToTiers" style="font-size:0.75rem;color:var(--gold);cursor:pointer">← Voltar a ${baseName}</a>
      </div>
      <div class="section-title" style="margin-bottom:0.6rem">${baseName} ${TIER_NAMES[tier]}</div>
      <div style="display:flex;flex-direction:column;gap:0.5rem" id="encList"></div>
    `;
    document.getElementById('backToTiers').addEventListener('click', () => showTiers(base, baseName));

    const encList = document.getElementById('encList');
    if (encs.length === 1 && encs[0] === 0) {
      showQualityDetail(variants[0].unique_name, baseName, tier, 0);
      return;
    }
    encList.innerHTML = encs.map(enc => `
      <div class="card" style="padding:0.7rem;cursor:pointer;transition:border-color 0.15s" data-enc="${enc}">
        <div style="display:flex;align-items:center;gap:0.6rem">
          <span style="font-weight:600">${enc > 0 ? `@${enc}` : '@0 (base)'}</span>
          <span style="font-size:0.75rem;color:var(--text-dim)">${variantsByEnc[enc].length} qualidade(s)</span>
        </div>
      </div>
    `).join('');
    encList.querySelectorAll('.card[data-enc]').forEach(el => {
      el.addEventListener('click', () => {
        const enc = parseInt(el.dataset.enc);
        const v = variantsByEnc[enc][0];
        showQualityDetail(v.unique_name, baseName, tier, enc);
      });
    });
  }

  async function showQualityDetail(itemId, baseName, tier, enchantment) {
    const grid = document.getElementById('itemGrid');
    grid.innerHTML = '<div class="loading">Carregando preços...</div>';
    setBreadcrumb([{ label: baseName }, { label: `${TIER_NAMES[tier]}${enchantment > 0 ? ` @${enchantment}` : ''}` }]);

    try {
      const [latest, history, itemInfo] = await Promise.all([
        getLatestPrices(itemId),
        getPriceHistory(itemId, 500),
        apiGet(`/api/items/${itemId}`).catch(() => null)
      ]);

      const name = (itemInfo && itemInfo.name_ptbr) || baseName;

      grid.innerHTML = `
        <div style="margin-bottom:0.8rem">
          <a href="javascript:void(0)" id="backToEncs" style="font-size:0.75rem;color:var(--gold);cursor:pointer">← Voltar</a>
        </div>
        <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
          <h2 style="font-size:1.1rem;font-weight:700">${name}</h2>
          <span style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${itemId}</span>
          ${tierIcon(tier)}
          ${enchantment > 0 ? `<span class="badge badge-purple">@${enchantment}</span>` : ''}
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
      `;

      document.getElementById('backToEncs').addEventListener('click', () => {
        if (enchantment > 0) {
          const variantsByEnc = {};
          const fakeVariants = [{ unique_name: itemId, enchantment }];
          showQualities(itemId.split('_').slice(0, -1).join('_'), baseName, tier, fakeVariants);
        } else {
          showTiers(itemId.replace(/(_\d+)?$/, ''), baseName);
        }
      });

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
                x: { type: 'time', time: { tooltipFormat: 'dd/MM/yyyy HH:mm', unit: 'hour' }, ticks: { color: '#8a8070', font: { size: 9 }, maxTicksLimit: 10 }, grid: { color: '#1e1e2a' } },
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
      grid.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  document.getElementById('catSearch').addEventListener('input', (e) => {
    renderTree(e.target.value.trim().toLowerCase());
  });

  renderTree();

  if (urlParams.get('item')) {
    const itemId = urlParams.get('item');
    const parts = itemId.split('_');
    const tier = parseInt(parts[0]?.replace('T', ''));
    const baseName = itemId;
    showQualityDetail(itemId, baseName, tier || 4, 0);
  } else {
    loadBases();
  }
});
