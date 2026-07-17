Router.register('/flipper', async (app) => {
  app.innerHTML = `<div class="loading">Carregando Flipper...</div>`;

  const CITIES = ['Caerleon', 'Martlock', 'Lymhurst', 'Bridgewatch', 'Fort Sterling', 'Thetford'];
  let state = {
    originCity: 'Caerleon',
    minProfit: 1000,
    category: '',
    premium: false,
    sort: 'profit',
    maxAgeCity: 60,
    maxAgeBM: 180,
  };
  let results = null;
  let loading = false;

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
    const params = new URLSearchParams({
      originCity: state.originCity,
      minProfit: state.minProfit,
      maxAgeCity: state.maxAgeCity,
      maxAgeBM: state.maxAgeBM,
      premium: state.premium,
      sort: state.sort,
      limit: 50,
    });
    if (state.category) params.set('category', state.category);
    try {
      results = await apiGet('/api/flipper?' + params.toString());
    } catch (e) {
      results = { opportunities: [], total_found: 0, error: e.message };
    }
    loading = false;
    renderResults();
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

    el.innerHTML = `
      <div class="flipper-header-row">
        <span class="flipper-count">${results.opportunities.length} oportunidades</span>
        <span class="flipper-meta">Taxa: ${(results.tax_rate * 100).toFixed(1)}% · Atualizado: ${timeAgo(results.generated_at)} atrás</span>
      </div>
      <div class="flipper-grid">
        ${results.opportunities.map(o => `
          <a href="#/itens?item=${encodeURIComponent(o.item_id)}" class="flipper-card">
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
          </a>
        `).join('')}
      </div>`;
  }

  app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:1.5rem">
      <div class="flipper-page-header">
        <h2 style="font-size:1.1rem;font-weight:700;color:var(--text)">🔄 Flipper — Arbitragem de Mercado</h2>
        <div class="flipper-refresh" id="flipperRefresh" title="Atualizar">🔄 Atualizar</div>
      </div>

      <div class="flipper-filters">
        <div class="flipper-filter-group">
          <label>Cidade Origem</label>
          <div class="city-selector" id="flipperCitySelector">
            ${CITIES.map(c => `<button class="city-tab${c === state.originCity ? ' active' : ''}" data-city="${c}">${c}</button>`).join('')}
          </div>
        </div>
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
          <div class="flipper-filter-item">
            <label>Taxa</label>
            <div class="flipper-toggle-wrap">
              <button class="flipper-toggle${!state.premium ? ' active' : ''}" data-premium="false">4% Sem</button>
              <button class="flipper-toggle${state.premium ? ' active' : ''}" data-premium="true">2.5% Prem</button>
            </div>
          </div>
        </div>
      </div>

      <div id="flipperResults" class="flipper-results"></div>
    </div>
  `;

  document.getElementById('flipperCitySelector').addEventListener('click', (e) => {
    const tab = e.target.closest('.city-tab');
    if (!tab) return;
    state.originCity = tab.dataset.city;
    document.querySelectorAll('#flipperCitySelector .city-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.city === state.originCity)
    );
    fetchFlipper();
  });

  document.getElementById('flipperMinProfit').addEventListener('change', (e) => {
    state.minProfit = Number(e.target.value) || 0;
    fetchFlipper();
  });

  document.getElementById('flipperSort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    fetchFlipper();
  });

  document.querySelectorAll('.flipper-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      state.premium = btn.dataset.premium === 'true';
      document.querySelectorAll('.flipper-toggle').forEach(b =>
        b.classList.toggle('active', b.dataset.premium === String(state.premium))
      );
      fetchFlipper();
    });
  });

  document.getElementById('flipperRefresh').addEventListener('click', () => fetchFlipper());

  fetchFlipper();

  let autoRefresh = setInterval(fetchFlipper, 3 * 60 * 1000);
  const observer = new MutationObserver(() => {
    if (!document.getElementById('flipperResults')) {
      clearInterval(autoRefresh);
      observer.disconnect();
    }
  });
  observer.observe(app, { childList: true });
});
