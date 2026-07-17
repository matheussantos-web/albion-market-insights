const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../data');
const UPDATES_FILE = path.join(DATA_DIR, 'official-updates.json');
const CHANGELOGS_FILE = path.join(DATA_DIR, 'official-changelogs.json');

router.get('/', (req, res) => {
  try {
    const updates = JSON.parse(fs.readFileSync(UPDATES_FILE, 'utf-8'));
    const changelogs = JSON.parse(fs.readFileSync(CHANGELOGS_FILE, 'utf-8'));
    res.json({ updates, changelogs });
  } catch (err) {
    console.error('[news] erro ao ler arquivos:', err.message);
    res.json({ updates: [], changelogs: [] });
  }
});

module.exports = router;
