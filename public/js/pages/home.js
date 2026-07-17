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

    const CITIES = ['Todas', 'Caerleon', 'Martlock', 'Lymhurst', 'Bridgewatch', 'Fort Sterling', 'Thetford'];
    let selectedCity = 'Todas';

    let marketData = { gainers: [], losers: [], mostTraded: [] };
    let trendData = [];
    let news = { updates: [], changelogs: [] };

    try {
      [marketData, trendData, news] = await Promise.all([
        apiGet('/api/market/summary'),
        apiGet('/api/market/trend'),
        apiGet('/api/news')
      ]);
    } catch (e) {}

    function itemIcon(name) {
      const clean = name.replace(/_/g, '.');
      return `https://albiononline2d.b-cdn.net/thumbnail/80x80/${clean}.png`;
    }

    function formatPrice(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return n.toLocaleString('pt-BR');
    }

    function formatDelta(d) {
      const sign = d > 0 ? '+' : '';
      if (Math.abs(d) >= 100) return sign + Math.round(d) + '%';
      return sign + d.toFixed(1) + '%';
    }

    function renderMarketItem(item, color) {
      return `
        <a href="#/itens?item=${encodeURIComponent(item.item)}" class="market-item">
          <div class="market-item-left">
            <img src="${itemIcon(item.item)}" alt="" class="market-item-icon" loading="lazy"
                 onerror="this.style.display='none'" />
            <div class="market-item-info">
              <div class="market-item-name">${item.name}</div>
              <div class="market-item-city">${item.city} · T${item.tier || '?'} · ${item.volume}x</div>
            </div>
          </div>
          <div class="market-item-right">
            <div class="market-item-price">${formatPrice(item.price)}</div>
            <div class="market-item-delta" style="color:${color}">${formatDelta(item.delta)}</div>
          </div>
        </a>`;
    }

    function renderMarketSection() {
      const g = marketData.gainers.length
        ? marketData.gainers.map(i => renderMarketItem(i, '#4ade80')).join('')
        : '<div class="market-empty">Sem dados suficientes</div>';
      const l = marketData.losers.length
        ? marketData.losers.map(i => renderMarketItem(i, '#f87171')).join('')
        : '<div class="market-empty">Sem dados suficientes</div>';
      const m = marketData.mostTraded.length
        ? marketData.mostTraded.map(i => renderMarketItem(i, 'var(--text-dim)')).join('')
        : '<div class="market-empty">Sem dados suficientes</div>';
      return `
        <div class="market-grid">
          <div class="market-col">
            <div class="market-col-header market-col-header--green">
              <span>📈 Maiores Altas</span><span class="market-col-sub">24h</span>
            </div>
            <div class="market-col-body">${g}</div>
          </div>
          <div class="market-col">
            <div class="market-col-header market-col-header--red">
              <span>📉 Maiores Baixas</span><span class="market-col-sub">24h</span>
            </div>
            <div class="market-col-body">${l}</div>
          </div>
          <div class="market-col">
            <div class="market-col-header market-col-header--blue">
              <span>🔥 Mais Negociados</span><span class="market-col-sub">volume</span>
            </div>
            <div class="market-col-body">${m}</div>
          </div>
        </div>`;
    }

    function renderTrendChart() {
      if (!trendData.length) return '<div class="market-empty">Sem dados de tendência</div>';
      const prices = trendData.map(t => t.avg_price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = max - min || 1;
      const current = prices[prices.length - 1];
      const first = prices[0];
      const changePercent = first > 0 ? ((current - first) / first * 100) : 0;
      const changeColor = changePercent >= 0 ? '#4ade80' : '#f87171';
      const changeSign = changePercent >= 0 ? '+' : '';
      const w = 300;
      const h = 60;
      const step = w / (prices.length - 1 || 1);
      const points = prices.map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / range) * (h - 10) - 5).toFixed(1)}`).join(' ');

      const circles = prices.map((p, i) => {
        const x = (i * step).toFixed(1);
        const y = (h - ((p - min) / range) * (h - 10) - 5).toFixed(1);
        const d = trendData[i];
        const label = d ? `${d.hour} — ${Math.round(p).toLocaleString('pt-BR')} pts (${d.item_count} itens)` : '';
        return `<circle cx="${x}" cy="${y}" r="3" fill="var(--gold)" opacity="0"
          data-tip="${label}"
          onmouseover="this.setAttribute('opacity','1');var t=document.getElementById('chartTip');t.textContent=this.dataset.tip;t.style.display='block'"
          onmouseout="this.setAttribute('opacity','0');document.getElementById('chartTip').style.display='none'"
        />`;
      }).join('');

      const scope = selectedCity === 'Todas' ? 'Todas as cidades' : selectedCity;

      return `
        <div class="trend-chart">
          <div class="trend-header">
            <div>
              <div class="trend-title">Índice de Preços</div>
              <div class="trend-scope">${scope} · ${trendData.length} pontos</div>
            </div>
            <div class="trend-current">
              <span class="trend-value">${Math.round(current).toLocaleString('pt-BR')}</span>
              <span class="trend-change" style="color:${changeColor}">${changeSign}${changePercent.toFixed(1)}%</span>
            </div>
          </div>
          <div class="trend-svg-wrap">
            <svg viewBox="0 0 ${w} ${h}" class="trend-svg">
              <polyline fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linejoin="round" points="${points}"/>
              ${circles}
            </svg>
            <div class="chart-tooltip" id="chartTip"></div>
          </div>
        </div>`;
    }

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

        <div class="market-section">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.8rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">💹</span>
            <h3 style="font-size:0.85rem;font-weight:700;color:var(--text)">Resumo de Mercado</h3>
            <div class="city-selector" id="citySelector">
              ${CITIES.map(c => `<button class="city-tab${c === selectedCity ? ' active' : ''}" data-city="${c}">${c}</button>`).join('')}
            </div>
          </div>
          <div id="marketSummary">${renderMarketSection()}</div>
          <div id="trendChart">${renderTrendChart()}</div>
        </div>

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

    document.querySelectorAll('.city-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        selectedCity = tab.dataset.city;
        document.querySelectorAll('.city-tab').forEach(t => t.classList.toggle('active', t.dataset.city === selectedCity));
        document.getElementById('marketSummary').innerHTML = '<div class="market-loading">Carregando...</div>';
        const params = selectedCity === 'Todas' ? '' : `?city=${encodeURIComponent(selectedCity)}`;
        try {
          [marketData, trendData] = await Promise.all([
            apiGet('/api/market/summary' + params),
            apiGet('/api/market/trend' + params)
          ]);
        } catch (e) {}
        document.getElementById('marketSummary').innerHTML = renderMarketSection();
        document.getElementById('trendChart').innerHTML = renderTrendChart();
      });
    });

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
