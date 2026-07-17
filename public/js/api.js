const API = '';

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(path) {
  const res = await fetch(`${API}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function searchItems(query, tier) {
  let url = `/api/items?search=${encodeURIComponent(query)}`;
  if (tier) url += `&tier=${tier}`;
  return apiGet(url);
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
