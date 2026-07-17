Router.register('/refino', async (app) => {
  const REFINING_DATA = {
    'Barra de Metal': { raw: 'Minerio', resource: 'Minério', icon: '⛏' },
    'Prancha': { raw: 'Madeira', resource: 'Madeira', icon: '🪵' },
    'Tecido': { raw: 'Fibra', resource: 'Fibra', icon: '🌿' },
    'Couro': { raw: 'Couro Bruto', resource: 'Couro Bruto', icon: '🦌' },
    'Bloco de Pedra': { raw: 'Pedra', resource: 'Pedra', icon: '🪨' },
  };

  const TIERS = [4, 5, 6, 7, 8];
  const RETURN_RATES = { base: 15.2, premium: 51.8 };

  app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:1.5rem">
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Calculadora de Refino</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Calcule o custo e lucro do refino de recursos</span>
      </div>

      <div class="grid-2" style="gap:1rem;margin-bottom:1.5rem">
        <div class="card">
          <div class="section-title">Configurações</div>
          <div style="display:flex;flex-direction:column;gap:0.8rem">
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Recurso Bruto</label>
              <select class="select" id="refRaw" style="width:100%">
                ${Object.entries(REFINING_DATA).map(([k, v]) => `<option value="${k}">${v.icon} ${v.resource} → ${k}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Tier</label>
              <div class="tier-bar" id="refTierBar" style="margin-bottom:0">
                ${TIERS.map(t => `<button data-tier="${t}"${t === 4 ? ' class="active"' : ''}>T${t}</button>`).join('')}
              </div>
            </div>
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Cidade</label>
              <select class="select" id="refCity" style="width:100%">
                <option value="Caerleon">Caerleon</option>
                <option value="Bridgewatch">Bridgewatch</option>
                <option value="Lymhurst" selected>Lymhurst</option>
                <option value="Martlock">Martlock</option>
                <option value="Fort Sterling">Fort Sterling</option>
                <option value="Thetford">Thetford</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Premium</label>
              <div style="display:flex;gap:0.5rem">
                <button class="btn" id="refPremiumNo" style="flex:1">Não</button>
                <button class="btn btn-gold" id="refPremiumYes" style="flex:1">Sim</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Resultado</div>
          <div id="refResult" style="color:var(--text-dim);font-size:0.8rem;padding:1rem 0">
            Buscando preços...
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Todos os Recursos</div>
        <div id="refAllRows" style="color:var(--text-dim);font-size:0.8rem">Carregando...</div>
      </div>
    </div>
  `;

  let selectedTier = 4;
  let isPremium = true;

  document.getElementById('refPremiumYes').addEventListener('click', () => {
    isPremium = true;
    document.getElementById('refPremiumYes').className = 'btn btn-gold';
    document.getElementById('refPremiumNo').className = 'btn';
    calcRefine();
  });
  document.getElementById('refPremiumNo').addEventListener('click', () => {
    isPremium = false;
    document.getElementById('refPremiumNo').className = 'btn btn-gold';
    document.getElementById('refPremiumYes').className = 'btn';
    calcRefine();
  });

  document.getElementById('refTierBar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    selectedTier = parseInt(btn.dataset.tier);
    document.getElementById('refTierBar').querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', parseInt(b.dataset.tier) === selectedTier)
    );
    calcRefine();
  });

  document.getElementById('refRaw').addEventListener('change', calcRefine);
  document.getElementById('refCity').addEventListener('change', calcRefine);

  async function getItemPrice(itemId, city) {
    try {
      const prices = await getLatestPrices(itemId);
      const cityPrice = prices.find(p => p.city === city);
      if (cityPrice) return cityPrice.sell_price_min || cityPrice.sell_price_max || 0;
      return 0;
    } catch { return 0; }
  }

  async function calcRefine() {
    const refined = document.getElementById('refRaw').value;
    const city = document.getElementById('refCity').value;
    const tier = selectedTier;
    const data = REFINING_DATA[refined];
    if (!data) return;

    const rawId = `T${tier}_${data.raw}`;
    const refinedId = `T${tier}_${refined.replace(/ /g, '_')}`;
    const returnRate = isPremium ? RETURN_RATES.premium : RETURN_RATES.base;

    const [rawPrice, refinedPrice] = await Promise.all([
      getItemPrice(rawId, city),
      getItemPrice(refinedId, city)
    ]);

    const costPerUnit = rawPrice;
    const revenuePerUnit = refinedPrice;
    const profitPerUnit = revenuePerUnit - costPerUnit;
    const profitClass = profitPerUnit > 0 ? 'color:var(--green)' : profitPerUnit < 0 ? 'color:var(--red)' : '';

    document.getElementById('refResult').innerHTML = `
      <div class="grid-3" style="gap:0.8rem">
        <div class="stat-box"><div class="value">${rawPrice.toLocaleString('pt-BR')}</div><div class="label">Preço Bruto (un)</div></div>
        <div class="stat-box"><div class="value">${revenuePerUnit.toLocaleString('pt-BR')}</div><div class="label">Preço Refinado (un)</div></div>
        <div class="stat-box"><div class="value" style="${profitClass}">${profitPerUnit.toLocaleString('pt-BR')}</div><div class="label">Lucro (un)</div></div>
      </div>
      <div style="margin-top:0.8rem;font-size:0.7rem;color:var(--text-dim)">
        Retorno: ${returnRate}% · City: ${city} · T${tier} ${isPremium ? '(Premium)' : ''}
      </div>
    `;
  }

  async function loadAllRows() {
    const city = document.getElementById('refCity').value;
    const rows = [];
    for (const [refined, data] of Object.entries(REFINING_DATA)) {
      for (const tier of TIERS) {
        const rawId = `T${tier}_${data.raw}`;
        const refinedId = `T${tier}_${refined.replace(/ /g, '_')}`;
        const [rawP, refP] = await Promise.all([getItemPrice(rawId, city), getItemPrice(refinedId, city)]);
        const profit = refP - rawP;
        rows.push({ tier, refined, data, rawP, refP, profit });
      }
    }

    document.getElementById('refAllRows').innerHTML = `
      <table class="data-table">
        <thead><tr><th>Tier</th><th>Bruto</th><th>Preço Bruto</th><th>Refinado</th><th>Preço Refinado</th><th>Lucro</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td><span class="badge badge-gold">T${r.tier}</span></td>
            <td>${r.data.resource}</td>
            <td class="price">${r.rawP.toLocaleString('pt-BR')}</td>
            <td>${r.refined}</td>
            <td class="price">${r.refP.toLocaleString('pt-BR')}</td>
            <td style="font-family:monospace;font-weight:600;${r.profit > 0 ? 'color:var(--green)' : r.profit < 0 ? 'color:var(--red)' : ''}">${r.profit.toLocaleString('pt-BR')}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  }

  calcRefine();
  loadAllRows();
});
