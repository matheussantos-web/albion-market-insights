const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

let cachedNews = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const description = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
    const contentMatch = block.match(/<media:content[^>]*url="([^"]*)"/);
    const contentUrl = contentMatch ? contentMatch[1] : '';
    const encMatch = block.match(/<enclosure[^>]*url="([^"]*)"/);
    const encUrl = encMatch ? encMatch[1] : '';

    items.push({
      title: title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
      url: link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
      date: pubDate ? new Date(pubDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      description: description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim(),
      source: source.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
      image: contentUrl || encUrl || ''
    });
  }
  return items;
}

async function fetchNews() {
  if (cachedNews && Date.now() - cacheTime < CACHE_TTL) return cachedNews;

  try {
    const res = await fetch(
      'https://news.google.com/rss/search?q=albion+online+update&hl=pt-BR&gl=BR&ceid=BR:pt-419',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const xml = await res.text();
    cachedNews = parseRSS(xml).slice(0, 12);
    cacheTime = Date.now();
    return cachedNews;
  } catch (err) {
    console.error('[news] erro ao buscar:', err.message);
    return cachedNews || [];
  }
}

router.get('/', async (req, res) => {
  const news = await fetchNews();
  res.json(news);
});

module.exports = router;
