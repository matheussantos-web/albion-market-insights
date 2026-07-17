Router.register('/contribuidores', async (app) => {
  app.innerHTML = `
    <div>
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Contribuidores</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Status dos colaboradores e dados coletados</span>
      </div>

      <div class="grid-4" style="margin-bottom:1rem" id="contStats"></div>

      <div class="grid-2" style="gap:1rem;margin-bottom:1rem">
        <div class="card">
          <div class="section-title">Estatísticas Gerais</div>
          <div id="contGeneral" style="padding:0.5rem 0;color:var(--text-dim);font-size:0.8rem">Carregando...</div>
        </div>
        <div class="card">
          <div class="section-title">Por Fonte de Dados</div>
          <div id="contSources" style="padding:0.5rem 0;color:var(--text-dim);font-size:0.8rem">Carregando...</div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">Contribuidores</div>
        <div id="contTable"></div>
      </div>
    </div>
  `;

  try {
    const [stats, contributors] = await Promise.all([
      apiGet('/api/stats'),
      apiGet('/api/contributors/stats'),
    ]);

    document.getElementById('contStats').innerHTML = `
      <div class="stat-box"><div class="value">${stats.totalItems || 0}</div><div class="label">Itens</div></div>
      <div class="stat-box"><div class="value">${stats.totalPrices || 0}</div><div class="label">Registros de preço</div></div>
      <div class="stat-box"><div class="value">${stats.privatePrices || 0}</div><div class="label">Privados</div></div>
      <div class="stat-box"><div class="value">${stats.publicPrices || 0}</div><div class="label">AODP</div></div>
    `;

    document.getElementById('contGeneral').innerHTML = `
      <p><strong>Itens:</strong> ${stats.totalItems || 0}</p>
      <p><strong>Preços totais:</strong> ${stats.totalPrices || 0}</p>
      <p><strong>Privados:</strong> ${stats.privatePrices || 0}</p>
      <p><strong>AODP:</strong> ${stats.publicPrices || 0}</p>
      <p><strong>Contribuidores ativos:</strong> ${stats.activeContributors || 0}</p>
      <p><strong>Última atualização:</strong> ${stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString('pt-BR') : 'N/A'}</p>
    `;

    document.getElementById('contSources').innerHTML = `
      <p><strong>Privado (contribuidores):</strong> <span class="source-badge private">Privado</span> ${stats.privatePrices || 0} registros</p>
      <p><strong>AODP (público):</strong> <span class="source-badge public_adp">AODP</span> ${stats.publicPrices || 0} registros</p>
    `;

    if (contributors.length) {
      document.getElementById('contTable').innerHTML = `
        <table class="data-table">
          <thead><tr><th>ID</th><th>Nome</th><th>Registros</th><th>Última Atividade</th><th>Status</th></tr></thead>
          <tbody>${contributors.map(c => `
            <tr>
              <td style="font-family:monospace;font-size:0.7rem">${c.id ? c.id.slice(0, 8) + '...' : '—'}</td>
              <td style="font-weight:600">${c.nickname || 'Anônimo'}</td>
              <td>${c.record_count || 0}</td>
              <td class="time-ago">${c.last_seen ? timeAgo(c.last_seen) : 'Nunca'}</td>
              <td><span class="status ${c.record_count > 0 ? 'online' : 'none'}">${c.record_count > 0 ? 'Ativo' : 'Inativo'}</span></td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    } else {
      document.getElementById('contTable').innerHTML = '<div class="empty-state"><p>Nenhum contribuidor registrado ainda</p></div>';
    }
  } catch (e) {
    app.innerHTML = `<div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${e.message}</p></div>`;
  }
});
