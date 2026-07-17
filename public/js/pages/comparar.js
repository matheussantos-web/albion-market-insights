Router.register('/comparar', async (app) => {
  app.innerHTML = `
    <div>
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Comparar Cidades</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Encontre os melhores preços entre cidades</span>
      </div>
      <div style="position:relative;margin-bottom:1rem">
        <input type="text" class="input" id="compareSearch" placeholder="Buscar item..." style="width:100%;font-size:0.9rem;padding:0.7rem 1rem" autocomplete="off" />
        <div class="search-results" id="compareResults"></div>
      </div>
      <div id="compareTable"></div>
    </div>
  `;

  async function loadCompare(itemId) {
    const table = document.getElementById('compareTable');
    table.innerHTML = '<div class="loading">Carregando preços...</div>';
    try {
      const data = await apiGet(`/api/prices/compare?item=${itemId}`);
      if (!data.length) {
        table.innerHTML = '<div class="empty-state"><p>Sem dados de preços para este item</p></div>';
        return;
      }

      const sells = data.filter(d => d.sell_price_min);
      const buys = data.filter(d => d.buy_price_min);
      const bestSell = sells.length ? sells.reduce((a, b) => a.sell_price_min < b.sell_price_min ? a : b) : null;
      const bestBuy = buys.length ? buys.reduce((a, b) => a.buy_price_min > b.buy_price_min ? a : b) : null;

      const itemName = (data[0] && data[0].name_ptbr) || itemId;

      table.innerHTML = `
        <div class="card" style="margin-bottom:1rem">
          <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:0.5rem">
            <h3 style="font-size:1rem;font-weight:600">${itemName}</h3>
            <span style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${itemId}</span>
          </div>
          <div class="grid-2" style="gap:1rem;margin-top:0.5rem">
            ${bestSell ? `<div class="stat-box" style="border-left:3px solid #27ae60">
              <div class="value" style="font-size:1.1rem">${fmt(bestSell.sell_price_min)}</div>
              <div class="label">Melhor venda em ${bestSell.city}</div>
            </div>` : ''}
            ${bestBuy ? `<div class="stat-box" style="border-left:3px solid #e74c3c">
              <div class="value" style="font-size:1.1rem">${fmt(bestBuy.buy_price_min)}</div>
              <div class="label">Melhor compra em ${bestBuy.city}</div>
            </div>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="section-title">Preços por Cidade</div>
          <table class="price-table">
            <thead><tr>
              <th>Cidade</th><th>Venda mín</th><th>Venda máx</th><th>Compra mín</th><th>Compra máx</th><th>Spread</th><th>Fonte</th>
            </tr></thead>
            <tbody>${data.map(r => {
              const spread = r.sell_price_min && r.buy_price_max
                ? Math.round((1 - r.buy_price_max / r.sell_price_min) * 100) : null;
              const isBestSell = bestSell && r.city === bestSell.city;
              const isBestBuy = bestBuy && r.city === bestBuy.city;
              return `<tr>
                <td class="city" style="font-weight:600">${r.city}</td>
                <td class="price ${isBestSell ? 'best' : ''}">${fmt(r.sell_price_min)}</td>
                <td class="price">${fmt(r.sell_price_max)}</td>
                <td class="price ${isBestBuy ? 'best' : ''}">${fmt(r.buy_price_min)}</td>
                <td class="price">${fmt(r.buy_price_max)}</td>
                <td>${spread !== null ? `<span style="color:${spread > 20 ? '#27ae60' : '#e67e22'}">${spread}%</span>` : '—'}</td>
                <td><span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      `;
    } catch (e) {
      table.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro: ${e.message}</p></div>`;
    }
  }

  const search = document.getElementById('compareSearch');
  const results = document.getElementById('compareResults');
  let timeout;
  search.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = search.value.trim();
    if (q.length < 2) { results.classList.remove('active'); return; }
    timeout = setTimeout(async () => {
      const items = await searchItems(q);
      results.innerHTML = items.slice(0, 15).map(it => `
        <div class="sr-item" data-id="${it.unique_name}">
          <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
          <span class="sr-meta">
            <span class="badge badge-surface">${it.category || ''}</span>
            <span class="badge badge-gold">T${it.tier || '?'}</span>
          </span>
        </div>
      `).join('');
      results.classList.add('active');
      results.querySelectorAll('.sr-item[data-id]').forEach(el => {
        el.addEventListener('click', () => {
          search.value = el.querySelector('.sr-name').textContent;
          results.classList.remove('active');
          loadCompare(el.dataset.id);
        });
      });
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#compareSearch')) results.classList.remove('active');
  });
});
