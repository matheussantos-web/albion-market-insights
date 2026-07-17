Router.register('/historico', async (app, itemId) => {
  if (!itemId) {
    app.innerHTML = `
      <div style="max-width:500px;margin:3rem auto;text-align:center">
        <h2 style="font-size:1.1rem;color:var(--gold);margin-bottom:0.5rem">Histórico de Preços</h2>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1.5rem">Busque um item para ver o histórico de preços</p>
        <div style="position:relative">
          <input type="text" class="input" id="histSearch" placeholder="Buscar item..." style="width:100%;font-size:0.9rem;padding:0.7rem 1rem" autocomplete="off" />
          <div class="search-results" id="histResults"></div>
        </div>
      </div>
    `;

    const search = document.getElementById('histSearch');
    const results = document.getElementById('histResults');
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
          el.addEventListener('click', () => Router.navigate('/historico/' + el.dataset.id));
        });
      }, 250);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#histSearch')) results.classList.remove('active');
    });
    return;
  }

  app.innerHTML = '<div class="loading">Carregando...</div>';

  try {
    const [latest, history, itemInfo] = await Promise.all([
      getLatestPrices(itemId),
      getPriceHistory(itemId, 500),
      apiGet(`/api/items/${itemId}`).catch(() => null)
    ]);

    const name = (itemInfo && itemInfo.name_ptbr) || (latest.length && latest[0].name_ptbr) || itemId;

    app.innerHTML = `
      <div>
        <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
          <a href="#/itens" style="font-size:0.75rem;color:var(--text-dim)">← Voltar</a>
          <h2 style="font-size:1.1rem;font-weight:700">${name}</h2>
          <span style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${itemId}</span>
          ${itemInfo ? `<span class="badge badge-gold">T${itemInfo.tier || '?'}</span>` : ''}
          ${itemInfo && itemInfo.enchantment ? `<span class="badge badge-purple">@${itemInfo.enchantment}</span>` : ''}
          ${itemInfo && itemInfo.category ? `<span class="badge badge-surface">${itemInfo.category}</span>` : ''}
        </div>

        ${latest.length ? `
        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Preços Atuais por Cidade</div>
          <table class="price-table">
            <thead><tr><th>Cidade</th><th>Venda min</th><th>Venda max</th><th>Compra min</th><th>Compra max</th><th>Fonte</th><th>Atualizado</th></tr></thead>
            <tbody>${latest.map(r => `<tr>
              <td class="city">${r.city}</td>
              <td class="price">${fmt(r.sell_price_min)}</td>
              <td class="price">${fmt(r.sell_price_max)}</td>
              <td class="price">${fmt(r.buy_price_min)}</td>
              <td class="price">${fmt(r.buy_price_max)}</td>
              <td><span class="source-badge ${r.source}">${r.source === 'private' ? 'Privado' : 'AODP'}</span></td>
              <td class="time-ago">${timeAgo(r.observed_at)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Estatísticas</div>
          <div class="grid-3" id="histStats"></div>
        </div>

        <div class="card">
          <div class="section-title">Gráfico de Preços</div>
          <div class="chart-controls" id="histMetric">
            <button class="active" data-metric="sell">Venda</button>
            <button data-metric="buy">Compra</button>
          </div>
          <div class="chart-container"><canvas id="histChart"></canvas></div>
        </div>
      </div>
    `;

    if (history.length) {
      const sells = history.filter(h => h.sell_price_min).map(h => h.sell_price_min);
      const buys = history.filter(h => h.buy_price_min).map(h => h.buy_price_min);
      const avgSell = sells.length ? Math.round(sells.reduce((a, b) => a + b, 0) / sells.length) : 0;
      const minSell = sells.length ? Math.min(...sells) : 0;
      const maxSell = sells.length ? Math.max(...sells) : 0;
      const avgBuy = buys.length ? Math.round(buys.reduce((a, b) => a + b, 0) / buys.length) : 0;

      document.getElementById('histStats').innerHTML = `
        <div class="stat-box"><div class="value">${fmt(avgSell)}</div><div class="label">Venda médio</div></div>
        <div class="stat-box"><div class="value">${fmt(minSell)}</div><div class="label">Venda mín</div></div>
        <div class="stat-box"><div class="value">${fmt(maxSell)}</div><div class="label">Venda máx</div></div>
        <div class="stat-box"><div class="value">${fmt(avgBuy)}</div><div class="label">Compra médio</div></div>
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
        chartInstance = new Chart(document.getElementById('histChart'), {
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
      document.getElementById('histMetric').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        document.querySelectorAll('#histMetric button').forEach(b => b.classList.toggle('active', b === btn));
        drawChart(btn.dataset.metric);
      });
    }

  } catch (e) {
    app.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro: ${e.message}</p></div>`;
  }
});
