Router.register('/craft', async (app) => {
  app.innerHTML = `
    <div>
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Calculadora de Craft</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Calcule o custo de produção e margem de lucro</span>
      </div>

      <div class="grid-2" style="gap:1rem;margin-bottom:1rem">
        <div class="card">
          <div class="section-title">Item a Craftar</div>
          <div style="position:relative;margin-bottom:0.8rem">
            <input type="text" class="input" id="craftSearch" placeholder="Buscar item..." style="width:100%;font-size:0.85rem" autocomplete="off" />
            <div class="search-results" id="craftResults"></div>
          </div>
          <div id="craftSelected" style="color:var(--text-dim);font-size:0.8rem">Nenhum item selecionado</div>
          <div style="margin-top:1rem">
            <label style="font-size:0.75rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Quantidade</label>
            <input type="number" class="input" id="craftQty" value="1" min="1" style="width:100%" />
          </div>
        </div>

        <div class="card">
          <div class="section-title">Cidade de Venda</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem" id="craftCities"></div>
          <div style="margin-top:1rem">
            <label style="font-size:0.75rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Taxa do mercado (Tax)</label>
            <input type="number" class="input" id="craftTax" value="15" min="0" max="100" style="width:100%" />
          </div>
          <div style="margin-top:0.8rem">
            <label style="font-size:0.75rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Return Rate (retorno de materiais %)</label>
            <input type="number" class="input" id="craftReturnRate" value="15" min="0" max="100" style="width:100%" />
          </div>
          <button class="btn btn-primary" id="craftCalc" style="margin-top:1rem;width:100%">Calcular</button>
        </div>
      </div>

      <div id="craftResult"></div>
    </div>
  `;

  const CITIES = ['Caerleon', 'Bridgewatch', 'Lymhurst', 'Martlock', 'Fort Sterling', 'Thetford'];
  let selectedCity = 'Caerleon';
  let selectedItem = null;

  const citiesDiv = document.getElementById('craftCities');
  citiesDiv.innerHTML = CITIES.map(c =>
    `<button class="badge ${c === selectedCity ? 'badge-gold' : 'badge-surface'}" style="cursor:pointer;border:none" data-city="${c}">${c}</button>`
  ).join('');

  citiesDiv.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    selectedCity = btn.dataset.city;
    citiesDiv.querySelectorAll('button').forEach(b => {
      b.className = b.dataset.city === selectedCity ? 'badge badge-gold' : 'badge badge-surface';
      b.style.cursor = 'pointer';
    });
  });

  const search = document.getElementById('craftSearch');
  const results = document.getElementById('craftResults');
  let timeout;
  search.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = search.value.trim();
    if (q.length < 2) { results.classList.remove('active'); return; }
    timeout = setTimeout(async () => {
      const items = await searchItems(q);
      results.innerHTML = items.slice(0, 15).map(it => `
        <div class="sr-item" data-id="${it.unique_name}" data-name="${it.name_ptbr || it.unique_name}" data-tier="${it.tier || ''}">
          <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
          <span class="sr-meta">
            <span class="badge badge-gold">T${it.tier || '?'}</span>
          </span>
        </div>
      `).join('');
      results.classList.add('active');
      results.querySelectorAll('.sr-item[data-id]').forEach(el => {
        el.addEventListener('click', () => {
          selectedItem = { id: el.dataset.id, name: el.dataset.name, tier: el.dataset.tier };
          document.getElementById('craftSelected').innerHTML =
            `<span style="font-weight:600">${el.dataset.name}</span> <span class="badge badge-gold">T${el.dataset.tier}</span>`;
          search.value = el.dataset.name;
          results.classList.remove('active');
        });
      });
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#craftSearch')) results.classList.remove('active');
  });

  document.getElementById('craftCalc').addEventListener('click', async () => {
    const result = document.getElementById('craftResult');
    if (!selectedItem) {
      result.innerHTML = '<div class="card" style="border-left:3px solid #e74c3c;padding:1rem;color:#e74c3c">Selecione um item primeiro</div>';
      return;
    }

    const qty = parseInt(document.getElementById('craftQty').value) || 1;
    const tax = parseInt(document.getElementById('craftTax').value) || 15;
    const returnRate = parseInt(document.getElementById('craftReturnRate').value) || 15;

    result.innerHTML = '<div class="loading">Buscando preços...</div>';

    try {
      const [sellPrices, buyPrices] = await Promise.all([
        getLatestPrices(selectedItem.id),
        getLatestPrices(selectedItem.id),
      ]);

      const cityData = sellPrices.filter(p => p.city === selectedCity);
      const sellMin = cityData.length ? Math.min(...cityData.map(p => p.sell_price_min).filter(Boolean)) : 0;
      const sellMax = cityData.length ? Math.max(...cityData.map(p => p.sell_price_max).filter(Boolean)) : 0;
      const buyMin = cityData.length ? Math.min(...cityData.map(p => p.buy_price_min).filter(Boolean)) : 0;

      const effectiveReturn = 1 - (returnRate / 100);
      const taxRate = 1 - (tax / 100);

      const allCities = {};
      for (const city of CITIES) {
        const cData = sellPrices.filter(p => p.city === city);
        allCities[city] = {
          sell: cData.length ? Math.min(...cData.map(p => p.sell_price_min).filter(Boolean)) : 0,
          buy: cData.length ? Math.min(...cData.map(p => p.buy_price_min).filter(Boolean)) : 0,
        };
      }

      const totalSell = sellMin * qty * taxRate;
      const effectiveCost = buyMin * qty * effectiveReturn;

      result.innerHTML = `
        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Resultado</div>
          <div class="grid-3" style="gap:1rem;margin-top:0.5rem">
            <div class="stat-box" style="border-left:3px solid #27ae60">
              <div class="value" style="font-size:1rem">${fmt(Math.round(totalSell))}</div>
              <div class="label">Receita (${selectedCity}, ${tax}% tax)</div>
            </div>
            <div class="stat-box" style="border-left:3px solid #e74c3c">
              <div class="value" style="font-size:1rem">${fmt(Math.round(effectiveCost))}</div>
              <div class="label">Custo efetivo (${returnRate}% return)</div>
            </div>
            <div class="stat-box" style="border-left:3px solid ${totalSell > effectiveCost ? '#27ae60' : '#e74c3c'}">
              <div class="value" style="font-size:1rem;color:${totalSell > effectiveCost ? '#27ae60' : '#e74c3c'}">
                ${fmt(Math.round(totalSell - effectiveCost))}
              </div>
              <div class="label">Lucro estimado</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Preços por Cidade (${selectedItem.name})</div>
          <table class="price-table">
            <thead><tr><th>Cidade</th><th>Venda mín</th><th>Compra mín</th><th>Diferença</th></tr></thead>
            <tbody>${CITIES.map(c => {
              const d = allCities[c];
              const diff = d.sell && d.buy ? Math.round((1 - d.buy / d.sell) * 100) : null;
              return `<tr style="${c === selectedCity ? 'background:rgba(201,169,78,0.08)' : ''}">
                <td class="city" style="font-weight:600">${c} ${c === selectedCity ? '⭐' : ''}</td>
                <td class="price">${fmt(d.sell)}</td>
                <td class="price">${fmt(d.buy)}</td>
                <td>${diff !== null ? `<span style="color:${diff > 20 ? '#27ae60' : '#e67e22'}">${diff}%</span>` : '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      `;
    } catch (e) {
      result.innerHTML = `<div class="card" style="border-left:3px solid #e74c3c;padding:1rem;color:#e74c3c">Erro: ${e.message}</div>`;
    }
  });
});
