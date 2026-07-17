const {init} = require('../src/db/init');
const db = init();
const rows = db.prepare("SELECT unique_name, name_ptbr FROM items WHERE unique_name IN ('T7_MAIN_SWORD', 'T8_MAIN_SWORD')").all();
rows.forEach(r => console.log(r.unique_name, '->', r.name_ptbr));
