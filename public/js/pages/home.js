Router.register('/', async (app) => {
  app.innerHTML = `<div class="loading">Carregando...</div>`;

  try {
    const SLIDES = [
      { img: '/img/slides/anuncie aqui.png', title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
      { title: '', subtitle: '', cta: '' },
    ];

    let news = { updates: [], changelogs: [] };
    try { news = await apiGet('/api/news'); } catch (e) {}

    app.innerHTML = `
      <div class="carousel" id="carousel">
        <div class="carousel-track" id="carouselTrack">
          ${SLIDES.map((s, i) => `
            <div class="carousel-slide">
              ${s.img ? `<img src="${s.img}" alt="Slide ${i+1}" style="width:100%;height:100%;object-fit:cover" />` : ''}
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

      <div style="max-width:1200px;margin:0 auto;padding:1.5rem">

        <div style="margin-bottom:2rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">🎮</span>
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--text)">Atualizações Oficiais</h3>
            <a href="https://albiononline.com/update" target="_blank" style="font-size:0.65rem;color:var(--text-dim);margin-left:auto">Ver tudo →</a>
          </div>
          ${news.updates.length ? `
            <div class="news-featured">
              <a href="https://albiononline.com/update/${news.updates[0].slug}" target="_blank" class="news-card news-card-featured">
                ${news.updates[0].image ? `<div class="news-card-img news-card-img-lg"><img src="${news.updates[0].image}" alt="${news.updates[0].title}" loading="lazy" /></div>` : ''}
                <div class="news-card-body">
                  <div class="news-card-title news-card-title-lg">${news.updates[0].title}</div>
                  ${news.updates[0].description ? `<div class="news-card-desc">${news.updates[0].description}</div>` : ''}
                  <div class="news-card-footer">
                    <span class="news-card-date">${news.updates[0].date}</span>
                    <span class="news-card-cta">Leia Mais →</span>
                  </div>
                </div>
              </a>
            </div>
            <div class="news-grid">
              ${news.updates.slice(1, 7).map(n => `
                <a href="https://albiononline.com/update/${n.slug}" target="_blank" class="news-card">
                  ${n.image ? `<div class="news-card-img"><img src="${n.image}" alt="${n.title}" loading="lazy" /></div>` : ''}
                  <div class="news-card-body">
                    <div class="news-card-title">${n.title}</div>
                    <div class="news-card-footer">
                      <span class="news-card-date">${n.date}</span>
                    </div>
                  </div>
                </a>
              `).join('')}
            </div>
          ` : '<div style="text-align:center;color:var(--text-dim);font-size:0.8rem;padding:2rem">Carregando atualizações...</div>'}
        </div>

        ${news.changelogs.length ? `
        <div style="margin-bottom:2rem">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">📋</span>
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--text)">Changelogs Recentes</h3>
            <a href="https://albiononline.com/update" target="_blank" style="font-size:0.65rem;color:var(--text-dim);margin-left:auto">Ver tudo →</a>
          </div>
          <div class="changelog-list">
            ${news.changelogs.map(c => `
              <a href="https://albiononline.com/changelog/${c.slug}" target="_blank" class="changelog-item">
                <span class="changelog-title">${c.title}</span>
                <span class="changelog-date">${c.date}</span>
              </a>
            `).join('')}
          </div>
        </div>
        ` : ''}

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

  } catch (e) {
    app.innerHTML = `<div style="max-width:1200px;margin:0 auto;padding:0 1.5rem"><div class="empty-state"><div class="icon">⚠</div><p>Erro ao carregar: ${e.message}</p></div></div>`;
  }
});
