Router.register('/', async (app) => {
  app.innerHTML = `<div class="loading">Carregando...</div>`;

  try {
    const categories = await getCategories();
    const totalItems = categories.reduce((s, c) => s + c.count, 0);

    const SLIDES = [
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
    ];

    app.innerHTML = `
      <div class="carousel" id="carousel">
        <div class="carousel-track" id="carouselTrack">
          ${SLIDES.map((s, i) => `
            <div class="carousel-slide">
              <div class="carousel-slide-content">
                ${s.title ? `<h2>${s.title}</h2>` : ''}
                ${s.subtitle ? `<p>${s.subtitle}</p>` : ''}
                ${s.cta ? `<a href="${s.cta.href}" class="btn btn-gold" style="margin-top:0.8rem">${s.cta.label}</a>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button class="carousel-btn carousel-prev" id="carouselPrev">‹</button>
        <button class="carousel-btn carousel-next" id="carouselNext">›</button>
        <div class="carousel-dots" id="carouselDots">
          ${SLIDES.map((_, i) => `<span class="carousel-dot${i === 0 ? ' active' : ''}" data-slide="${i}"></span>`).join('')}
        </div>
      </div>

      <div style="max-width:1200px;margin:0 auto;padding:0 1.5rem">

        <div class="grid-4" style="margin:1.5rem 0 2rem">
          <div class="stat-box">
            <div class="value">${totalItems.toLocaleString('pt-BR')}</div>
            <div class="label">Itens Cadastrados</div>
          </div>
          <div class="stat-box">
            <div class="value">${categories.length}</div>
            <div class="label">Categorias</div>
          </div>
          <div class="stat-box">
            <div class="value">7</div>
            <div class="label">Cidades</div>
          </div>
          <div class="stat-box">
            <div class="value">235</div>
            <div class="label">Watchlist AODP</div>
          </div>
        </div>

        <div class="search-hero" style="margin-bottom:2rem">
          <div style="text-align:center;margin-bottom:1rem">
            <h3 style="font-size:0.9rem;font-weight:700;color:var(--text)">🔍 Buscar Item</h3>
            <p style="font-size:0.7rem;color:var(--text-dim)">Pesquise por qualquer item do Albion Online</p>
          </div>
          <div style="position:relative;max-width:500px;margin:0 auto">
            <input type="text" class="input" id="homeSearch" placeholder="Buscar item (ex: espada, capuz, poção...)" style="width:100%;padding:0.7rem 1rem;font-size:0.85rem" autocomplete="off" />
            <div class="search-results" id="homeSearchResults"></div>
          </div>
        </div>

        <div style="margin-bottom:2rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">⚙</span>
            <h3 style="font-size:0.8rem;font-weight:700;color:var(--text)">Como Funciona</h3>
          </div>
          <div class="how-it-works">
            <div class="hiw-card">
              <div class="hiw-icon">📊</div>
              <h4>Dados Privados</h4>
              <p>Contribuidores enviam dados de preço em tempo real via API, criando uma rede de informações confiáveis da comunidade.</p>
            </div>
            <div class="hiw-card">
              <div class="hiw-icon">🔄</div>
              <h4>Sync Automático</h4>
              <p>Dados públicos do AODP são sincronizados a cada 30 minutos como baseline, cobrindo 235 itens populares em 6 cidades.</p>
            </div>
            <div class="hiw-card">
              <div class="hiw-icon">📈</div>
              <h4>Análise Completa</h4>
              <p>Histórico de preços, comparação entre cidades, calculadora de craft e insights para maximizar seus lucros.</p>
            </div>
          </div>
        </div>

      </div>
    `;

    let currentSlide = 0;
    const totalSlides = SLIDES.length;
    const track = document.getElementById('carouselTrack');
    const dots = document.querySelectorAll('.carousel-dot');

    function goToSlide(n) {
      currentSlide = ((n % totalSlides) + totalSlides) % totalSlides;
      track.style.transform = `translateX(-${currentSlide * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    }

    document.getElementById('carouselPrev').addEventListener('click', () => goToSlide(currentSlide - 1));
    document.getElementById('carouselNext').addEventListener('click', () => goToSlide(currentSlide + 1));
    dots.forEach(d => d.addEventListener('click', () => goToSlide(parseInt(d.dataset.slide))));

    let autoTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
    document.getElementById('carousel').addEventListener('mouseenter', () => clearInterval(autoTimer));
    document.getElementById('carousel').addEventListener('mouseleave', () => {
      autoTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
    });

    const homeSearch = document.getElementById('homeSearch');
    const homeResults = document.getElementById('homeSearchResults');
    let timeout;

    homeSearch.addEventListener('input', () => {
      clearTimeout(timeout);
      const q = homeSearch.value.trim();
      if (q.length < 2) { homeResults.classList.remove('active'); return; }
      timeout = setTimeout(async () => {
        const items = await searchItems(q);
        if (!items.length) {
          homeResults.innerHTML = '<div class="sr-item" style="cursor:default;color:var(--text-dim)">Nenhum encontrado</div>';
          homeResults.classList.add('active');
          return;
        }
        homeResults.innerHTML = items.slice(0, 15).map(it => `
          <div class="sr-item" data-id="${it.unique_name}">
            <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
            <span class="sr-meta">
              <span class="badge badge-surface">${it.category || ''}</span>
              <span class="badge badge-gold">T${it.tier || '?'}</span>
            </span>
          </div>
        `).join('');
        homeResults.classList.add('active');
        homeResults.querySelectorAll('.sr-item[data-id]').forEach(el => {
          el.addEventListener('click', () => {
            Router.navigate('/itens?item=' + el.dataset.id);
          });
        });
      }, 250);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-hero')) homeResults.classList.remove('active');
    });

  } catch (e) {
    app.innerHTML = `<div style="max-width:1200px;margin:0 auto;padding:0 1.5rem"><div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${e.message}</p></div></div>`;
  }
});
