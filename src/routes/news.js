const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

let cachedNews = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function parseUpdates(html) {
  const updates = [];
  const sidebarRegex = /<li class="sidebar-item[^"]*">\s*<a href="\/update\/([^"]+)" class="sidebar-link">([\s\S]*?)<\/li>/g;
  let match;
  while ((match = sidebarRegex.exec(html)) !== null) {
    const slug = match[1];
    const block = match[2];
    const imgMatch = block.match(/src="([^"]+)"/);
    const textMatch = block.match(/<span class="sidebar-text">\s*([\s\S]*?)\s*<\/span>/);
    let title = '';
    let date = '';
    if (textMatch) {
      const parts = textMatch[1].split('<br>').map(s => s.trim()).filter(Boolean);
      title = (parts[0] || '').replace(/<[^>]*>/g, '').trim();
      date = (parts[1] || '').trim();
    }
    if (title) {
      updates.push({
        title,
        url: 'https://albiononline.com/update/' + slug,
        date,
        image: imgMatch ? (imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1]) : '',
        source: 'Sandbox Interactive'
      });
    }
  }
  return updates;
}

function parseChangelogs(html) {
  const logs = [];
  const clRegex = /<li class="sidebar-item">\s*<a href="\/changelog\/([^"]+)" class="sidebar-link">\s*<span class="sidebar-text sidebar-text--no-img">\s*([\s\S]*?)\s*<\/span>/g;
  let match;
  while ((match = clRegex.exec(html)) !== null) {
    const slug = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    const parts = text.split('|').map(s => s.trim());
    const title = (parts[0] || '').replace(/\n/g, ' ').trim();
    const date = (parts[1] || '').trim();
    if (title) {
      logs.push({
        title,
        url: 'https://albiononline.com/changelog/' + slug,
        date,
        image: '',
        source: 'Sandbox Interactive'
      });
    }
  }
  return logs;
}

async function fetchNews() {
  if (cachedNews && Date.now() - cacheTime < CACHE_TTL) return cachedNews;

  try {
    const res = await fetch('https://albiononline.com/update', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    if (html.includes('Just a moment') || html.includes('cf-browser-verification')) {
      console.error('[news] Cloudflare block');
      return cachedNews || [];
    }
    const updates = parseUpdates(html);
    const changelogs = parseChangelogs(html);
    cachedNews = { updates, changelogs };
    cacheTime = Date.now();
    return cachedNews;
  } catch (err) {
    console.error('[news] erro ao buscar:', err.message);
    return cachedNews || { updates: [], changelogs: [] };
  }
}

router.get('/', async (req, res) => {
  const news = await fetchNews();
  res.json(news);
});

module.exports = router;
