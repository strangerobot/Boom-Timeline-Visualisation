// netlify/functions/timeline.js
// Netlify Function to serve timeline data as JSON
// Reads the CSV file from the repository and returns JSON in the same shape as the original API.

const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
  try {
    const csvPath = path.resolve(__dirname, '../../timeline.csv');
    const csvData = await fs.promises.readFile(csvPath, 'utf8');

    // Simple CSV parser (expects header row and quoted fields)
    const lines = csvData.split(/\r?\n/).filter(l => l.trim().length > 0);
    const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const events = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const obj = {};
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = cols[j] ? cols[j].replace(/^"|"$/g, '').trim() : '';
      }
      events.push(obj);
    }

    // You may have a config object elsewhere; for now return empty config.
    const response = {
      config: {},
      events
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    console.error('Error reading timeline.csv:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load timeline data' }) };
  }
};
