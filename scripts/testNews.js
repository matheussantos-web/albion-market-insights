const f = require('node-fetch');
f('https://albiononline.com/news', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(html => {
    console.log('html length:', html.length);
    const re = /news-item__headline/g;
    const all = html.match(re);
    console.log('headlines in html:', all ? all.length : 0);

    const re2 = /class="news-item"/g;
    const items = html.match(re2);
    console.log('news-item class count:', items ? items.length : 0);

    const snippet = html.substring(html.indexOf('news-item__headline'), html.indexOf('news-item__headline') + 300);
    console.log('snippet:', snippet);
  })
  .catch(e => console.error(e.message));
