Router.register('/ilhas', async (app) => {
  const ISLAND_TYPES = [
    { id: 'personal', label: 'Ilha Pessoal', icon: '🏝', desc: 'Sua ilha pessoal com plantações e construções' },
    { id: 'guild', label: 'Ilha da Guild', icon: '🏰', desc: 'Ilha compartilhada com membros da guild' },
    { id: 'hideout', label: 'Hideout', icon: '⛺', desc: 'Base avançada no mundo aberto' },
  ];

  const CROPS = [
    { name: 'Carrot', growTime: 22, tier: 3, yield: 10 },
    { name: 'Bean', growTime: 22, tier: 3, yield: 10 },
    { name: 'Wheat', growTime: 22, tier: 3, yield: 10 },
    { name: 'Turnip', growTime: 22, tier: 3, yield: 10 },
    { name: 'Cabbage', growTime: 30, tier: 4, yield: 10 },
    { name: 'Potato', growTime: 30, tier: 4, yield: 10 },
    { name: 'Corn', growTime: 30, tier: 4, yield: 10 },
    { name: 'Stone', growTime: 48, tier: 4, yield: 15 },
    { name: 'Flax', growTime: 48, tier: 4, yield: 15 },
    { name: 'Hemp', growTime: 48, tier: 4, yield: 15 },
    { name: 'Grape', growTime: 72, tier: 5, yield: 10 },
    { name: 'Artichoke', growTime: 72, tier: 5, yield: 10 },
  ];

  app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:1.5rem">
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Ilhas & Plantations</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Planeje suas plantações e calcule retornos</span>
      </div>

      <div class="grid-3" style="gap:1rem;margin-bottom:1.5rem">
        ${ISLAND_TYPES.map(t => `
          <div class="hiw-card" style="text-align:left;cursor:pointer" data-type="${t.id}">
            <div class="hiw-icon" style="text-align:center">${t.icon}</div>
            <h4 style="text-align:center">${t.label}</h4>
            <p style="text-align:center">${t.desc}</p>
          </div>
        `).join('')}
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div class="section-title">Plantations Disponíveis</div>
        <div class="grid-4" style="gap:0.6rem">
          ${CROPS.map(c => `
            <div class="stat-box" style="cursor:pointer;text-align:left;padding:0.7rem">
              <div style="font-size:0.78rem;font-weight:600;color:var(--text)">${c.name}</div>
              <div style="font-size:0.6rem;color:var(--text-dim);margin-top:0.2rem">
                Tier ${c.tier} · ${c.growTime}h · ${c.yield}/colheita
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="grid-2" style="gap:1rem">
        <div class="card">
          <div class="section-title">Calculadora de Plantation</div>
          <div style="display:flex;flex-direction:column;gap:0.8rem">
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Cultura</label>
              <select class="select" id="islandCrop" style="width:100%">
                ${CROPS.map(c => `<option value="${c.name}">${c.name} (T${c.tier} · ${c.growTime}h)</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Número de Plotas</label>
              <input type="number" class="input" id="islandPlots" value="10" min="1" max="30" style="width:100%" />
            </div>
            <div>
              <label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:0.3rem">Nível de Focus</label>
              <select class="select" id="islandFocus" style="width:100%">
                <option value="0">Sem Focus</option>
                <option value="20">20% Focus</option>
                <option value="40">40% Focus</option>
                <option value="60">60% Focus</option>
                <option value="80">80% Focus</option>
                <option value="100">100% Focus</option>
              </select>
            </div>
            <button class="btn btn-gold" id="islandCalc" style="width:100%">Calcular</button>
          </div>
        </div>

        <div class="card">
          <div class="section-title">Resultado</div>
          <div id="islandResult" style="color:var(--text-dim);font-size:0.8rem;padding:1rem 0">
            Configure e clique em Calcular
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('islandCalc').addEventListener('click', () => {
    const cropName = document.getElementById('islandCrop').value;
    const plots = parseInt(document.getElementById('islandPlots').value) || 10;
    const focus = parseInt(document.getElementById('islandFocus').value) || 0;
    const crop = CROPS.find(c => c.name === cropName);
    if (!crop) return;

    const totalYield = plots * crop.yield;
    const boostedYield = Math.floor(totalYield * (1 + focus / 200));
    const dailyHarvests = Math.floor(24 / crop.growTime);
    const dailyYield = boostedYield * dailyHarvests;
    const dailyRevenue = dailyYield * 500;

    document.getElementById('islandResult').innerHTML = `
      <div class="grid-2" style="gap:0.8rem;margin-bottom:1rem">
        <div class="stat-box"><div class="value">${boostedYield}</div><div class="label">Produção/colheita</div></div>
        <div class="stat-box"><div class="value">${dailyHarvests}</div><div class="label">Colheitas/dia</div></div>
      </div>
      <div class="grid-2" style="gap:0.8rem">
        <div class="stat-box"><div class="value">${dailyYield}</div><div class="label">Total/dia</div></div>
        <div class="stat-box"><div class="value" style="color:var(--green)">${dailyRevenue.toLocaleString('pt-BR')}</div><div class="label">Revenue estimado</div></div>
      </div>
      <div style="margin-top:0.8rem;font-size:0.7rem;color:var(--text-dim)">
        ${crop.name} · ${plots} plotas · T${crop.tier} · ${crop.growTime}h de crescimento · Focus ${focus}%
      </div>
    `;
  });
});
