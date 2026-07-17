const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

let cachedNews = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

async function fetchNews() {
  if (cachedNews && Date.now() - cacheTime < CACHE_TTL) return cachedNews;

  try {
    const res = await fetch('https://albiononline.com/news', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();

    const news = [];
    const regex = /<a\s+href="(\/news\/[^"]+)"\s+class="news-item[^"]*"[^>]*>[\s\S]*?<h3\s+class="news-item__headline">([\s\S]*?)<\/h3>[\s\S]*?src="([^"]*)"[^>]*>[\s\S]*?<span\s+class="news-item__date">([\s\S]*?)<\/span>[\s\S]*?<div\s+class="news-item__body">\s*<p>([\s\S]*?)<\/p>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      news.push({
        url: 'https://albiononline.com' + match[1],
        title: match[2].trim(),
        image: match[3].startsWith('//') ? 'https:' + match[3] : match[3],
        date: match[4].trim(),
        description: match[5].trim()
      });
    }

    cachedNews = news;
    cacheTime = Date.now();
    return news;
  } catch (err) {
    console.error('[news] erro ao buscar:', err.message);
    return cachedNews || [];
  }
}

router.get('/', async (req, res) => {
  const news = await fetchNews();
  res.json(news.slice(0, 10));
});

module.exports = router;
