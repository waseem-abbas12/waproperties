const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dataPath = path.join(__dirname, '..', 'properties_dataset.json');
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load properties", details: err.message });
  }
};
