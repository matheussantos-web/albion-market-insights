const API = '';

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

async function getLatestPrices(itemId) {
  return apiGet(`/api/prices/${itemId}/latest`);
}

async function getPriceHistory(itemId, limit = 200) {
  return apiGet(`/api/prices/${itemId}?limit=${limit}`);
}

async function fetchFromAodp(itemId) {
  return apiPost(`/api/sync/${itemId}/fetch`);
}

async function syncWatchlist() {
  return apiPost('/api/sync/watchlist-sync');
}
