Router.register('/craft', async (app) => {
  app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:1.5rem">
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Calculadora de Craft</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Receitas reais do jogo. Calcule custo de produção e margem de lucro.</span>
      </div>

      <div class="grid-2" style="gap:1rem;margin-bottom:1rem">
        <div class="card">
          <div class="section-title">Item a Craftar</div>
          <div style="position:relative;margin-bottom:0.8rem">
            <input type="text" class="input" id="craftSearch" placeholder="Buscar item com receita..." style="width:100%;font-size:0.85rem" autocomplete="off" />
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
  let selectedCity = null;
  let selectedItem = null;
  let recipeData = null;

  function safeMin(arr) {
    const valid = arr.filter(v => v > 0 && isFinite(v));
    return valid.length ? Math.min(...valid) : 0;
  }

  const citiesDiv = document.getElementById('craftCities');
  citiesDiv.innerHTML = CITIES.map(c =>
    `<button class="badge badge-surface" style="cursor:pointer;border:none" data-city="${c}">${c}</button>`
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
      try {
        const items = await searchRecipes(q);
        results.innerHTML = items.filter(it => it.tradeable).slice(0, 15).map(it => `
          <div class="sr-item" data-id="${it.item_unique_name}" data-name="${it.name_ptbr || it.item_unique_name}" data-tier="${it.tier || ''}">
            <span class="sr-name">${it.name_ptbr || it.item_unique_name}</span>
            <span class="sr-meta">
              <span class="badge badge-gold">T${it.tier || '?'}</span>
              <span style="color:var(--text-dim);font-size:0.7rem">${it.category || ''}</span>
            </span>
          </div>
        `).join('');
        results.classList.add('active');
        results.querySelectorAll('.sr-item[data-id]').forEach(el => {
          el.addEventListener('click', async () => {
            const id = el.dataset.id;
            const name = el.dataset.name;
            const tier = el.dataset.tier;
            selectedItem = { id, name, tier };
            document.getElementById('craftSelected').innerHTML =
              `<span style="font-weight:600">${name}</span> <span class="badge badge-gold">T${tier}</span>`;
            search.value = name;
            results.classList.remove('active');
            await loadRecipe(id);
          });
        });
      } catch (e) {
        results.innerHTML = `<div class="sr-item" style="color:var(--text-dim)">${e.message}</div>`;
        results.classList.add('active');
      }
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#craftSearch')) results.classList.remove('active');
  });

  async function loadRecipe(itemId) {
    const result = document.getElementById('craftResult');
    try {
      const data = await getRecipe(itemId);
      recipeData = data;
      if (!data.recipe) {
        result.innerHTML = '<div class="card" style="border-left:3px solid #e67e22;padding:1rem;color:#e67e22">Este item não possui receita de craft no jogo.</div>';
        return;
      }
      const resHtml = data.resources.map(r => {
        const tierTag = r.tier ? `<span class="badge badge-gold" style="font-size:0.65rem">T${r.tier}${r.enchantment ? '@' + r.enchantment : ''}</span>` : '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.8rem">
          <span>${r.name_ptbr || r.resource_unique_name} ${tierTag}</span>
          <span style="color:var(--gold);font-weight:600">${r.count}x</span>
        </div>`;
      }).join('');
      result.innerHTML = `
        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Receita: ${selectedItem.name}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.5rem">
            Custo de prata: ${fmt(data.recipe.silver_cost)} silver &nbsp;|&nbsp; Tempo: ${data.recipe.craft_time}s
          </div>
          ${resHtml}
        </div>
      `;
    } catch (e) {
      result.innerHTML = `<div class="card" style="border-left:3px solid #e74c3c;padding:1rem;color:#e74c3c">Erro ao carregar receita: ${e.message}</div>`;
    }
  }

  document.getElementById('craftCalc').addEventListener('click', async () => {
    const result = document.getElementById('craftResult');
    if (!selectedItem) {
      result.innerHTML = '<div class="card" style="border-left:3px solid #e74c3c;padding:1rem;color:#e74c3c">Selecione um item primeiro</div>';
      return;
    }
    if (!selectedCity) {
      result.innerHTML = '<div class="card" style="border-left:3px solid #e67e22;padding:1rem;color:#e67e22">Selecione uma cidade de venda acima</div>';
      return;
    }
    if (!recipeData || !recipeData.recipe) {
      result.innerHTML = '<div class="card" style="border-left:3px solid #e67e22;padding:1rem;color:#e67e22">Este item não possui receita de craft.</div>';
      return;
    }

    const qty = parseInt(document.getElementById('craftQty').value) || 1;
    const tax = parseInt(document.getElementById('craftTax').value) || 15;
    const returnRate = parseInt(document.getElementById('craftReturnRate').value) || 15;

    result.innerHTML = '<div class="loading">Buscando preços dos materiais...</div>';

    try {
      const resourceNames = recipeData.resources.map(r => r.resource_unique_name);
      const pricePromises = resourceNames.map(name => getLatestPrices(name).catch(() => []));
      const itemPrices = getLatestPrices(selectedItem.id).catch(() => []);

      const allPrices = await Promise.all([...pricePromises, itemPrices]);
      const resourcePrices = {};
      for (let i = 0; i < resourceNames.length; i++) {
        resourcePrices[resourceNames[i]] = allPrices[i];
      }
      const sellPrices = allPrices[allPrices.length - 1];

      const citySellData = sellPrices.filter(p => p.city === selectedCity);
      const sellMin = safeMin(citySellData.map(p => p.sell_price_min));

      const taxRate = 1 - (tax / 100);
      const effectiveReturn = 1 - (returnRate / 100);

      let totalMaterialCost = 0;
      let missingDataCount = 0;
      const breakdown = [];

      for (const r of recipeData.resources) {
        const prices = resourcePrices[r.resource_unique_name] || [];
        const cityPrices = prices.filter(p => p.city === selectedCity);
        const buyPrice = safeMin(cityPrices.map(p => p.buy_price_min));
        const hasData = buyPrice > 0;
        if (!hasData) missingDataCount++;

        const lineCost = buyPrice * r.count * qty;
        totalMaterialCost += lineCost;

        const allCityPrices = {};
        for (const city of CITIES) {
          const cp = prices.filter(p => p.city === city);
          allCityPrices[city] = {
            buy: safeMin(cp.map(p => p.buy_price_min)),
          };
        }

        breakdown.push({
          name: r.name_ptbr || r.resource_unique_name,
          uniqueName: r.resource_unique_name,
          count: r.count,
          buyPrice,
          lineCost,
          allCityPrices,
          hasData,
        });
      }

      const silverCost = recipeData.recipe.silver_cost * qty;
      const totalCost = totalMaterialCost + silverCost;
      const returnedMaterials = totalMaterialCost * (returnRate / 100);
      const effectiveCost = totalCost - returnedMaterials;
      const sellRevenue = sellMin * qty * taxRate;
      const profit = sellRevenue - effectiveCost;
      const margin = sellRevenue > 0 ? ((profit / sellRevenue) * 100).toFixed(1) : 0;

      const allCitiesSummary = {};
      for (const city of CITIES) {
        const cd = sellPrices.filter(p => p.city === city);
        allCitiesSummary[city] = safeMin(cd.map(p => p.sell_price_min));
      }

      const missingWarning = missingDataCount > 0
        ? `<div style="margin-top:0.8rem;padding:0.5rem 0.75rem;background:rgba(230,126,34,0.1);border:1px solid rgba(230,126,34,0.2);border-radius:6px;font-size:0.75rem;color:#e67e22">
             <strong>⚠ ${missingDataCount} material(is) sem preço em ${selectedCity}.</strong> O custo total está subestimado —some os preços faltando manualmente para um resultado preciso.
           </div>`
        : '';

      const sellMissing = sellMin === 0
        ? `<div style="margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(230,126,34,0.1);border:1px solid rgba(230,126,34,0.2);border-radius:6px;font-size:0.75rem;color:#e67e22">
             <strong>⚠ Sem preço de venda em ${selectedCity}.</strong> A receita e o lucro não podem ser calculados. Tente outra cidade.
           </div>`
        : '';

      result.innerHTML = `
        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Resultado: ${selectedItem.name} x${qty}</div>
          ${sellMissing}
          <div class="grid-3" style="gap:1rem;margin-top:0.5rem">
            <div class="stat-box" style="border-left:3px solid #e74c3c">
              <div class="value" style="font-size:1rem">${sellMin > 0 ? fmt(Math.round(totalCost)) : '—'}</div>
              <div class="label">Custo total (materiais + prata)</div>
            </div>
            <div class="stat-box" style="border-left:3px solid #27ae60">
              <div class="value" style="font-size:1rem">${sellMin > 0 ? fmt(Math.round(sellRevenue)) : '—'}</div>
              <div class="label">Receita (${selectedCity}, ${tax}% tax)</div>
            </div>
            <div class="stat-box" style="border-left:3px solid ${profit > 0 ? '#27ae60' : '#e74c3c'}">
              <div class="value" style="font-size:1.1rem;color:${profit > 0 ? '#27ae60' : '#e74c3c'}">
                ${sellMin > 0 ? `${fmt(Math.round(profit))} <span style="font-size:0.75rem">(${margin}%)</span>` : '—'}
              </div>
              <div class="label">Lucro (${returnRate}% return rate)</div>
            </div>
          </div>
          <div style="margin-top:0.8rem;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.03);border-radius:6px;font-size:0.75rem;color:var(--text-dim)">
            <strong>Resumo:</strong>
            Custo materiais: ${fmt(Math.round(totalMaterialCost))} &nbsp;|&nbsp;
            Prata craft: ${fmt(silverCost)} &nbsp;|&nbsp;
            Retorno (${returnRate}%): -${fmt(Math.round(returnedMaterials))} &nbsp;|&nbsp;
            Receita final: ${fmt(Math.round(sellRevenue))}
          </div>
          ${missingWarning}
        </div>

        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Custo por Material</div>
          <table class="price-table">
            <thead><tr><th>Material</th><th>Qtd</th><th>Preço Compra (${selectedCity})</th><th>Custo Total</th></tr></thead>
            <tbody>${breakdown.map(b => `
              <tr style="${!b.hasData ? 'background:rgba(230,126,34,0.05)' : ''}">
                <td class="city" style="font-weight:600">${b.name} ${!b.hasData ? '<span style="color:#e67e22;font-size:0.65rem">sem preço</span>' : ''}</td>
                <td>${b.count * qty}x</td>
                <td class="price">${b.hasData ? fmt(b.buyPrice) : '<span style="color:#e67e22">—</span>'}</td>
                <td class="price" style="font-weight:600">${b.hasData ? fmt(Math.round(b.lineCost)) : '<span style="color:#e67e22">—</span>'}</td>
              </tr>
            `).join('')}
              <tr style="border-top:2px solid var(--border)">
                <td colspan="3" style="text-align:right;font-weight:600">Total materiais + prata:</td>
                <td class="price" style="font-weight:700;color:#e74c3c">${fmt(Math.round(totalCost))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Preço de Venda por Cidade (${selectedItem.name})</div>
          <table class="price-table">
            <thead><tr><th>Cidade</th><th>Venda mín</th><th>Receita x${qty}</th><th>Lucro x${qty}</th></tr></thead>
            <tbody>${CITIES.map(c => {
              const sp = allCitiesSummary[c];
              const rev = sp * qty * taxRate;
              const prof = rev - effectiveCost;
              const isBest = sp > 0 && sp === Math.max(...Object.values(allCitiesSummary).filter(v => v > 0));
              return `<tr style="${c === selectedCity ? 'background:rgba(201,169,78,0.08)' : ''}">
                <td class="city" style="font-weight:600">${c} ${c === selectedCity ? '⭐' : ''} ${isBest && c !== selectedCity ? '<span style="color:var(--green);font-size:0.65rem">melhor</span>' : ''}</td>
                <td class="price">${sp > 0 ? fmt(sp) : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td class="price">${sp > 0 ? fmt(Math.round(rev)) : '—'}</td>
                <td style="font-weight:600;color:${prof > 0 ? '#27ae60' : '#e74c3c'}">${sp > 0 ? fmt(Math.round(prof)) : '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>

        <div class="card" style="margin-bottom:1rem">
          <div class="section-title">Onde Comprar Materiais (mais barato)</div>
          <table class="price-table">
            <thead><tr><th>Material</th><th>Comprar em</th><th>Preço</th></tr></thead>
            <tbody>${breakdown.map(b => {
              const bestCity = Object.entries(b.allCityPrices).filter(([,v]) => v.buy > 0).sort((a, b) => a[1].buy - b[1].buy)[0];
              return `<tr>
                <td class="city" style="font-weight:600">${b.name}</td>
                <td>${bestCity ? bestCity[0] : '<span style="color:var(--text-muted)">sem dado</span>'}</td>
                <td class="price">${bestCity ? fmt(bestCity[1].buy) : '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
          <div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.4rem">
            Mostrando a cidade mais barata para comprar cada material (entre as 6 cidades principais).
          </div>
        </div>
      `;
    } catch (e) {
      result.innerHTML = `<div class="card" style="border-left:3px solid #e74c3c;padding:1rem;color:#e74c3c">Erro: ${e.message}</div>`;
    }
  });
});
