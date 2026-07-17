const CATEGORY_TREE = [
  { label: '⚔ Armas Corpo a Corpo', children: ['Espadas', 'Machados', 'Macas', 'Lancas', 'Martelos', 'Luvas de Guerra'] },
  { label: '🏹 Armas a Distância', children: ['Arcos', 'Bestas', 'Adagas'] },
  { label: '🔮 Cajados', children: ['Cajados de Fogo', 'Cajados de Gelo', 'Cajados Sagrados', 'Cajados Arcanos', 'Cajados Amaldicoados', 'Cajados da Natureza'] },
  { label: '🛡 Off-hand', children: ['Escudos', 'Tochas', 'Livros', 'Chifres', 'Totens', 'Orbes', 'Runas', 'Pergaminhos'] },
  { label: '🛡 Armaduras de Placa', children: ['Capacete de Placa', 'Armadura de Placa', 'Botas de Placa'] },
  { label: '🧥 Armaduras de Couro', children: ['Capacete de Couro', 'Armadura de Couro', 'Botas de Couro'] },
  { label: '👘 Armaduras de Tecido', children: ['Capacete de Tecido', 'Armadura de Tecido', 'Botas de Tecido'] },
  { label: '👑 Outras Armaduras', children: ['Capacetes', 'Armaduras', 'Botas'] },
  { label: '🎒 Acessórios', children: ['Capas', 'Bolsas'] },
  { label: '🐴 Montarias', children: ['Montarias'] },
  { label: '🧪 Consumíveis', children: ['Pocoes', 'Comida', 'Pesca'] },
  { label: '⛏ Recursos Brutos', children: ['Minerio', 'Madeira', 'Fibra', 'Couro Bruto', 'Pedra'] },
  { label: '🔨 Recursos Refinados', children: ['Barra de Metal', 'Prancha', 'Tecido', 'Couro', 'Bloco de Pedra'] },
  { label: '🔧 Ferramentas', children: ['Ferramentas'] },
  { label: '🏠 Outros', children: ['Gemas', 'Mobilha', 'Decoracao', 'Itens Unicos'] }
];

Router.register('/itens', async (app, params) => {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  let activeCategory = urlParams.get('cat') || '';
  let activeTier = '';
  let categories = [];

  app.innerHTML = `
    <div class="page-layout">
      <aside class="page-sidebar">
        <div class="card" style="padding:0.6rem">
          <div class="sidebar-search">
            <input type="text" class="input" id="catSearch" placeholder="Filtrar categoria..." style="width:100%;font-size:0.75rem;padding:0.4rem 0.6rem" />
          </div>
          <div id="categoryTree"></div>
        </div>
      </aside>
      <div class="page-content">
        <div class="tier-bar" id="tierBar">
          <span class="label">Tier:</span>
          <button data-tier="" class="active">Todos</button>
          <button data-tier="3">T3</button>
          <button data-tier="4">T4</button>
          <button data-tier="5">T5</button>
          <button data-tier="6">T6</button>
          <button data-tier="7">T7</button>
          <button data-tier="8">T8</button>
        </div>
        <div style="position:relative;margin-bottom:0.8rem">
          <input type="text" class="input" id="itemSearch" placeholder="Buscar item..." style="width:100%;font-size:0.85rem" autocomplete="off" />
          <div class="search-results" id="itemResults"></div>
        </div>
        <div id="itemList" class="card"></div>
      </div>
    </div>
  `;

  const catMap = {};
  try {
    categories = await getCategories();
    categories.forEach(c => catMap[c.category] = c.count);
  } catch (e) {}

  function renderTree(filter = '') {
    const tree = document.getElementById('categoryTree');
    let html = `<div class="cat-child${activeCategory === '' ? ' active' : ''}" data-cat="" style="font-weight:600;color:var(--text);padding-left:0.6rem;border-bottom:1px solid var(--border)">
      <span>Todos</span><span class="cc-count">${categories.reduce((s, c) => s + c.count, 0)}</span>
    </div>`;

    CATEGORY_TREE.forEach(group => {
      const kids = group.children.filter(c => catMap[c] && (!filter || c.toLowerCase().includes(filter)));
      if (!kids.length) return;
      const isOpen = kids.some(c => c === activeCategory) || filter;
      const total = kids.reduce((s, c) => s + (catMap[c] || 0), 0);
      html += `<div class="cat-group${isOpen ? ' open' : ''}">`;
      html += `<div class="cat-group-header"><span class="cat-arrow">▶</span><span>${group.label}</span><span class="cc-count" style="margin-left:auto;font-size:0.55rem;opacity:0.5">${total}</span></div>`;
      html += `<div class="cat-group-children">`;
      kids.forEach(cat => {
        html += `<div class="cat-child${activeCategory === cat ? ' active' : ''}" data-cat="${cat}"><span>${cat}</span><span class="cc-count">${catMap[cat]}</span></div>`;
      });
      html += `</div></div>`;
    });

    tree.innerHTML = html;

    tree.querySelectorAll('.cat-group-header').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        el.parentElement.classList.toggle('open');
      });
    });

    tree.querySelectorAll('.cat-child[data-cat]').forEach(el => {
      el.addEventListener('click', () => {
        activeCategory = el.dataset.cat;
        renderTree(document.getElementById('catSearch').value.trim().toLowerCase());
        loadItems();
      });
    });
  }

  async function loadItems() {
    const list = document.getElementById('itemList');
    list.innerHTML = '<div class="loading">Carregando...</div>';
    try {
      const items = await searchItems('', activeTier || undefined, activeCategory || undefined);
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>Nenhum item encontrado</p></div>';
        return;
      }
      list.innerHTML = `<table class="data-table">
        <thead><tr><th>Nome</th><th>ID</th><th>Tier</th><th>Enc</th><th>Categoria</th></tr></thead>
        <tbody>${items.map(it => `
          <tr style="cursor:pointer" onclick="Router.navigate('/historico/${it.unique_name}')">
            <td style="font-weight:600">${it.name_ptbr || it.unique_name}</td>
            <td style="font-family:monospace;font-size:0.7rem;color:var(--text-dim)">${it.unique_name}</td>
            <td><span class="badge badge-gold">T${it.tier || '?'}</span></td>
            <td>${it.enchantment > 0 ? `<span class="badge badge-purple">@${it.enchantment}</span>` : ''}</td>
            <td><span class="badge badge-surface">${it.category || ''}</span></td>
          </tr>
        `).join('')}</tbody>
      </table>`;
    } catch (e) {
      list.innerHTML = `<div class="empty-state"><p>Erro: ${e.message}</p></div>`;
    }
  }

  document.getElementById('catSearch').addEventListener('input', (e) => {
    renderTree(e.target.value.trim().toLowerCase());
  });

  document.getElementById('tierBar').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    activeTier = btn.dataset.tier;
    document.getElementById('tierBar').querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.tier === activeTier)
    );
    loadItems();
  });

  const itemSearch = document.getElementById('itemSearch');
  const itemResults = document.getElementById('itemResults');
  let timeout;
  itemSearch.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = itemSearch.value.trim();
    if (q.length < 2) { itemResults.classList.remove('active'); return; }
    timeout = setTimeout(async () => {
      const items = await searchItems(q, activeTier || undefined, activeCategory || undefined);
      if (!items.length) {
        itemResults.innerHTML = '<div class="sr-item" style="cursor:default;color:var(--text-dim)">Nenhum encontrado</div>';
        itemResults.classList.add('active');
        return;
      }
      itemResults.innerHTML = items.slice(0, 20).map(it => `
        <div class="sr-item" data-id="${it.unique_name}">
          <span class="sr-name">${it.name_ptbr || it.unique_name}</span>
          <span class="sr-meta">
            <span class="badge badge-gold">T${it.tier || '?'}</span>
            ${it.enchantment > 0 ? `<span class="badge badge-purple">@${it.enchantment}</span>` : ''}
          </span>
        </div>
      `).join('');
      itemResults.classList.add('active');
      itemResults.querySelectorAll('.sr-item[data-id]').forEach(el => {
        el.addEventListener('click', () => {
          Router.navigate('/historico/' + el.dataset.id);
        });
      });
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#itemSearch')) itemResults.classList.remove('active');
  });

  renderTree();
  loadItems();
});
