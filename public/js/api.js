const API = '';

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR');
}

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  const headers = {};
  if (token) headers['x-session-token'] = token;
  return headers;
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(path) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function searchItems(query, tier, category) {
  let url = `/api/items?search=${encodeURIComponent(query)}`;
  if (tier) url += `&tier=${tier}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  return apiGet(url);
}

async function getCategories() {
  return apiGet('/api/items/categories');
}

async function getLatestPrices(itemId, quality) {
  const q = quality ? `?quality=${quality}` : '';
  const res = await apiGet(`/api/prices/${itemId}/latest${q}`);
  const arr = res.data || res;
  arr.low_confidence = res.low_confidence || false;
  return arr;
}

async function getPriceHistory(itemId, limit = 200, quality) {
  const params = new URLSearchParams({ limit });
  if (quality) params.set('quality', quality);
  const res = await apiGet(`/api/prices/${itemId}?${params}`);
  const arr = res.data || res;
  arr.low_confidence = res.low_confidence || false;
  return arr;
}

async function fetchFromAodp(itemId) {
  return apiPost(`/api/sync/${itemId}/fetch`);
}

async function syncWatchlist() {
  return apiPost('/api/sync/watchlist-sync');
}

async function getItemBases(category, search) {
  let url = '/api/items/bases';
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (params.toString()) url += `?${params}`;
  return apiGet(url);
}

async function getItemVariants(base) {
  return apiGet(`/api/items/variants?base=${encodeURIComponent(base)}`);
}

async function getRecipe(uniqueName) {
  return apiGet(`/api/craft/recipe/${encodeURIComponent(uniqueName)}`);
}

async function searchRecipes(q) {
  return apiGet(`/api/craft/search?q=${encodeURIComponent(q)}`);
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return min + 'min';
  const h = Math.floor(min / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

async function hasRecipe(uniqueName) {
  try {
    return await apiGet(`/api/craft/has-recipe/${encodeURIComponent(uniqueName)}`);
  } catch (e) {
    return { has_recipe: false, level: null };
  }
}

async function getFlipperForItem(uniqueName) {
  try {
    const data = await apiGet(`/api/flipper?itemFilter=${encodeURIComponent(uniqueName)}`);
    return data.opportunities && data.opportunities.length ? data.opportunities[0] : null;
  } catch (e) {
    return null;
  }
}
