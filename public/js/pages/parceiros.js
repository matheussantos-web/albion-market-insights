Router.register('/parceiros', async (app) => {
  app.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:1.5rem">
      <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap">
        <h2 style="font-size:1.1rem;font-weight:700">Parceiros</h2>
        <span style="font-size:0.7rem;color:var(--text-dim)">Canais de YouTube e criadores de conteúdo parceiros</span>
      </div>

      <div id="partnerList">
        <div class="empty-state">
          <div class="icon">📺</div>
          <p>Nenhum parceiro cadastrado ainda</p>
          <p style="font-size:0.65rem;color:var(--text-muted);margin-top:0.3rem">Em breve, canais parceiros serão exibidos aqui</p>
        </div>
      </div>
    </div>
  `;
});
