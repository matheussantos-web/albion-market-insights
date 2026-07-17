Router.register('/flipper', async (app) => {
  app.innerHTML = `<div class="loading">Carregando Flipper...</div>`;

  const CITIES = ['Caerleon', 'Martlock', 'Lymhurst', 'Bridgewatch', 'Fort Sterling', 'Thetford'];
  const TIERS = [0, 3, 4, 5, 6, 7, 8];
  let state = {
    mode: 'blackmarket',
    originCity: 'Caerleon',
    upgradeCity: '',
    upgradeTier: 0,
    minProfit: 1000,
    category: '',
    premium: false,
    sort: 'profit',
    maxAgeCity: 60,
    maxAgeBM: 180,
    scope: 'all',
  };
  let results = null;
  let loading = false;
  let activity = [];

  function itemIcon(name) {
    const clean = name.replace(/_/g, '.');
    return `https://albiononline2d.b-cdn.net/thumbnail/80x80/${clean}.png`;
  }

  function formatPrice(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString('pt-BR');
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

  async function fetchFlipper() {
    loading = true;
    renderResults();

    const params = new URLSearchParams({ sort: state.sort, limit: 50, scope: state.scope });
    let endpoint = '/api/flipper';

    if (state.mode === 'blackmarket') {
      params.set('originCity', state.originCity);
      params.set('minProfit', state.minProfit);
      params.set('maxAgeCity', state.maxAgeCity);
      params.set('maxAgeBM', state.maxAgeBM);
      params.set('premium', state.premium);
      if (state.category) params.set('category', state.category);
    } else {
      params.set('mode', 'upgrade');
      params.set('city', state.upgradeCity);
      params.set('tier', state.upgradeTier);
      params.set('minProfit', state.minProfit);
    }

    try {
      results = await apiGet(endpoint + '?' + params.toString());
    } catch (e) {
      results = { opportunities: [], total_found: 0, error: e.message };
    }
    loading = false;
    renderResults();
  }

  async function fetchActivity() {
    try {
      const data = await apiGet('/api/flipper/activity?limit=8');
      activity = data.activity || [];
      renderActivity();
    } catch (_) {}
  }

  async function consumeFlip(opp) {
    const dest = state.mode === 'upgrade'
      ? `${opp.city} +${opp.buy_enchant}→+${opp.sell_enchant}`
      : `${opp.origin_city} → Black Market`;

    try {
      await fetch('/api/flipper/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: opp.item_id,
          origin_city: opp.origin_city || opp.city,
          destination: dest,
          net_profit: opp.net_profit,
        }),
      });
      fetchActivity();
    } catch (_) {}
  }

  function renderResults() {
    const el = document.getElementById('flipperResults');
    if (!el) return;

    if (loading) {
      el.innerHTML = '<div class="market-loading">Buscando oportunidades...</div>';
      return;
    }

    if (!results || !results.opportunities.length) {
      el.innerHTML = `<div class="market-empty">
        <div style="font-size:1.5rem;margin-bottom:0.5rem">🔍</div>
        <div>Nenhuma oportunidade encontrada</div>
        <div style="font-size:0.6rem;margin-top:0.3rem;color:var(--text-muted)">
          ${results ? `Verificados ${results.total_found} resultados · Lucro mínimo: ${formatPrice(state.minProfit)}` : 'Tente ajustar os filtros'}
        </div>
      </div>`;
      return;
    }

    const isBM = state.mode === 'blackmarket';

    el.innerHTML = `
      <div class="flipper-header-row">
        <span class="flipper-count">${results.opportunities.length} oportunidades</span>
        <span class="flipper-meta">
          ${state.scope === 'private' ? '🔒 Seus dados · ' : ''}
          Taxa: ${(results.tax_rate * 100).toFixed(1)}% · Atualizado: ${timeAgo(results.generated_at)} atrás
        </span>
      </div>
      <div class="flipper-grid">
        ${results.opportunities.map(o => isBM ? renderBMCard(o) : renderUpgradeCard(o)).join('')}
      </div>`;
  }

  function renderBMCard(o) {
    return `
    <a href="#/itens?item=${encodeURIComponent(o.item_id)}" class="flipper-card" data-flip='${JSON.stringify({item_id:o.item_id,city:o.origin_city,dest:"BM",profit:o.net_profit})}'>
      <div class="flipper-card-top">
        <img src="${itemIcon(o.item_id)}" alt="" class="flipper-card-icon" loading="lazy" onerror="this.style.display='none'" />
        <div class="flipper-card-info">
          <div class="flipper-card-name">${o.item_name}</div>
          <div class="flipper-card-meta">
            <span class="badge badge-gold">T${o.tier || '?'}</span>
            <span class="flipper-card-route">${o.origin_city} → Black Market</span>
          </div>
        </div>
        <div class="flipper-card-profit">
          <div class="flipper-profit-value">+${formatPrice(o.net_profit)}</div>
          <div class="flipper-profit-roi">+${o.roi_percent}%</div>
        </div>
      </div>
      <div class="flipper-card-prices">
        <div class="flipper-price-row">
          <span class="flipper-price-label">Compra</span>
          <span class="flipper-price-val">${formatPrice(o.sell_price)}</span>
        </div>
        <div class="flipper-price-row">
          <span class="flipper-price-label">Venda BM</span>
          <span class="flipper-price-val">${formatPrice(o.bm_buy_price)}</span>
        </div>
        <div class="flipper-price-row">
          <span class="flipper-price-label">Taxa</span>
          <span class="flipper-price-val flipper-price-tax">-${formatPrice(o.tax_value)}</span>
        </div>
      </div>
      <div class="flipper-card-footer">
        <span title="Atualizado cidade">Cidade: ${timeAgo(o.updated_origin)}</span>
        <span title="Atualizado BM">BM: ${timeAgo(o.updated_bm)}</span>
      </div>
    </a>`;
  }

  function renderUpgradeCard(o) {
    return `
    <a href="#/itens?item=${encodeURIComponent(o.item_id)}" class="flipper-card" data-flip='${JSON.stringify({item_id:o.item_id,city:o.city,dest:`+${o.buy_enchant}→+${o.sell_enchant}`,profit:o.net_profit})}'>
      <div class="flipper-card-top">
        <img src="${itemIcon(o.item_id)}" alt="" class="flipper-card-icon" loading="lazy" onerror="this.style.display='none'" />
        <div class="flipper-card-info">
          <div class="flipper-card-name">${o.item_name}</div>
          <div class="flipper-card-meta">
            <span class="badge badge-gold">T${o.tier || '?'}</span>
            <span class="flipper-card-route">${o.city}: +${o.buy_enchant} → +${o.sell_enchant}</span>
          </div>
        </div>
        <div class="flipper-card-profit">
          <div class="flipper-profit-value">+${formatPrice(o.net_profit)}</div>
          <div class="flipper-profit-roi">+${o.roi_percent}%</div>
        </div>
      </div>
      <div class="flipper-card-prices">
        <div class="flipper-price-row">
          <span class="flipper-price-label">Compra +${o.buy_enchant}</span>
          <span class="flipper-price-val">${formatPrice(o.buy_price)}</span>
        </div>
        <div class="flipper-price-row">
          <span class="flipper-price-label">Custo upgrade (${o.material_name})</span>
          <span class="flipper-price-val flipper-price-tax">-${formatPrice(o.upgrade_cost)}</span>
        </div>
        <div class="flipper-price-row">
          <span class="flipper-price-label">Venda +${o.sell_enchant}</span>
          <span class="flipper-price-val" style="color:var(--green)">${formatPrice(o.sell_price)}</span>
        </div>
        <div class="flipper-price-row">
          <span class="flipper-price-label">Taxa</span>
          <span class="flipper-price-val flipper-price-tax">-${formatPrice(o.tax_value)}</span>
        </div>
      </div>
      <div class="flipper-card-footer">
        <span title="Atualizado compra">Compra: ${timeAgo(o.updated_buy)}</span>
        <span title="Atualizado venda">Venda: ${timeAgo(o.updated_sell)}</span>
      </div>
    </a>`;
  }

  function renderActivity() {
    const el = document.getElementById('flipperActivity');
    if (!el) return;

    if (!activity.length) {
      el.innerHTML = `<div class="flipper-activity-empty">Nenhuma atividade recente</div>`;
      return;
    }

    el.innerHTML = activity.map(a => `
      <div class="flipper-activity-item">
        <span class="flipper-activity-name">${a.contributor_name}</span>
        <span class="flipper-activity-text">flipou</span>
        <a href="#/itens?item=${encodeURIComponent(a.item_id)}" class="flipper-activity-item-name">${a.item_id.replace(/_/g, ' ')}</a>
        <span class="flipper-activity-text">${timeAgo(a.consumed_at)} atrás</span>
      </div>
    `).join('');
  }

  function render() {
    const isBM = state.mode === 'blackmarket';

    app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:1.5rem">
      <div class="flipper-page-header">
        <h2 style="font-size:1.1rem;font-weight:700;color:var(--text)">🔄 Flipper v2 — Arbitragem</h2>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <div class="flipper-refresh" id="flipperRefresh" title="Atualizar">🔄 Atualizar</div>
        </div>
      </div>

      <div class="flipper-mode-tabs">
        <button class="flipper-mode-tab${isBM ? ' active' : ''}" data-mode="blackmarket">
          <span class="flipper-mode-icon">⚔️</span> Black Market
        </button>
        <button class="flipper-mode-tab${!isBM ? ' active' : ''}" data-mode="upgrade">
          <span class="flipper-mode-icon">⬆️</span> Upgrade de Encantamento
        </button>
      </div>

      <div class="flipper-filters">
        <div class="flipper-filter-group">
          <label>Cidade Origem</label>
          ${isBM ? `
            <div class="city-selector" id="flipperCitySelector">
              ${CITIES.map(c => `<button class="city-tab${c === state.originCity ? ' active' : ''}" data-city="${c}">${c}</button>`).join('')}
            </div>
          ` : `
            <div class="city-selector" id="flipperCitySelector">
              <button class="city-tab${state.upgradeCity === '' ? ' active' : ''}" data-city="">Todas</button>
              ${CITIES.map(c => `<button class="city-tab${c === state.upgradeCity ? ' active' : ''}" data-city="${c}">${c}</button>`).join('')}
            </div>
          `}
        </div>

        ${!isBM ? `
        <div class="flipper-filter-group">
          <label>Tier</label>
          <div class="city-selector" id="flipperTierSelector">
            ${TIERS.map(t => `<button class="city-tab${t === state.upgradeTier ? ' active' : ''}" data-tier="${t}">${t === 0 ? 'Todas' : 'T' + t}</button>`).join('')}
          </div>
        </div>
        ` : ''}

        <div class="flipper-filter-row">
          <div class="flipper-filter-item">
            <label>Lucro Mínimo</label>
            <input type="number" class="input" id="flipperMinProfit" value="${state.minProfit}" min="0" step="500" style="width:120px;font-size:0.8rem" />
          </div>
          <div class="flipper-filter-item">
            <label>Ordenar por</label>
            <select class="input" id="flipperSort" style="font-size:0.8rem">
              <option value="profit"${state.sort === 'profit' ? ' selected' : ''}>Lucro (↓)</option>
              <option value="roi"${state.sort === 'roi' ? ' selected' : ''}>ROI % (↓)</option>
            </select>
          </div>
          ${isBM ? `
          <div class="flipper-filter-item">
            <label>Taxa</label>
            <div class="flipper-toggle-wrap">
              <button class="flipper-toggle${!state.premium ? ' active' : ''}" data-premium="false">4% Sem</button>
              <button class="flipper-toggle${state.premium ? ' active' : ''}" data-premium="true">2.5% Prem</button>
            </div>
          </div>
          ` : ''}
          <div class="flipper-filter-item">
            <label>Escopo</label>
            <div class="flipper-toggle-wrap">
              <button class="flipper-toggle${state.scope === 'all' ? ' active' : ''}" data-scope="all">Todos</button>
              <button class="flipper-toggle${state.scope === 'private' ? ' active' : ''}" data-scope="private">🔒 Meus Dados</button>
            </div>
          </div>
        </div>
      </div>

      <div class="flipper-layout-split">
        <div id="flipperResults" class="flipper-results"></div>
        <div class="flipper-activity-panel">
          <div class="flipper-activity-title">Atividade Recente</div>
          <div id="flipperActivity" class="flipper-activity-list"></div>
        </div>
      </div>
    </div>`;

    bindEvents();
    fetchFlipper();
    fetchActivity();
  }

  function bindEvents() {
    document.querySelectorAll('.flipper-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.mode = tab.dataset.mode;
        render();
      });
    });

    document.getElementById('flipperCitySelector').addEventListener('click', (e) => {
      const tab = e.target.closest('.city-tab');
      if (!tab) return;
      if (state.mode === 'blackmarket') {
        state.originCity = tab.dataset.city;
      } else {
        state.upgradeCity = tab.dataset.city;
      }
      document.querySelectorAll('#flipperCitySelector .city-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.city === (state.mode === 'blackmarket' ? state.originCity : state.upgradeCity))
      );
      fetchFlipper();
    });

    const tierSel = document.getElementById('flipperTierSelector');
    if (tierSel) {
      tierSel.addEventListener('click', (e) => {
        const tab = e.target.closest('.city-tab');
        if (!tab) return;
        state.upgradeTier = Number(tab.dataset.tier);
        document.querySelectorAll('#flipperTierSelector .city-tab').forEach(t =>
          t.classList.toggle('active', Number(t.dataset.tier) === state.upgradeTier)
        );
        fetchFlipper();
      });
    }

    document.getElementById('flipperMinProfit').addEventListener('change', (e) => {
      state.minProfit = Number(e.target.value) || 0;
      fetchFlipper();
    });

    document.getElementById('flipperSort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      fetchFlipper();
    });

    document.querySelectorAll('.flipper-toggle[data-premium]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.premium = btn.dataset.premium === 'true';
        document.querySelectorAll('.flipper-toggle[data-premium]').forEach(b =>
          b.classList.toggle('active', b.dataset.premium === String(state.premium))
        );
        fetchFlipper();
      });
    });

    document.querySelectorAll('.flipper-toggle[data-scope]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.scope = btn.dataset.scope;
        document.querySelectorAll('.flipper-toggle[data-scope]').forEach(b =>
          b.classList.toggle('active', b.dataset.scope === state.scope)
        );
        fetchFlipper();
      });
    });

    document.getElementById('flipperRefresh').addEventListener('click', () => {
      fetchFlipper();
      fetchActivity();
    });

    document.getElementById('flipperResults').addEventListener('click', (e) => {
      const card = e.target.closest('.flipper-card[data-flip]');
      if (!card) return;
      e.preventDefault();
      const href = card.getAttribute('href');
      const flipData = JSON.parse(card.dataset.flip);
      consumeFlip(flipData).then(() => {
        window.location.hash = href.replace(/^#/, '');
      });
    });
  }

  render();

  let autoRefresh = setInterval(() => { fetchFlipper(); fetchActivity(); }, 3 * 60 * 1000);
  const observer = new MutationObserver(() => {
    if (!document.getElementById('flipperResults')) {
      clearInterval(autoRefresh);
      observer.disconnect();
    }
  });
  observer.observe(app, { childList: true });
});
