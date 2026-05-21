// netlify/functions/timeline.js
// Netlify Function to serve timeline data as JSON
// Reads the CSV file from the repository and parses it using the exact same logic as server.js.

const fs = require('fs');
const path = require('path');

// Helper to parse standard CSV line with quotes support
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper to convert date keys (e.g., 2018, 2026-06, "June 2026") into numeric value for sorting
function getNumericValue(key) {
  if (!key) return 0;
  const str = key.toString().trim();
  
  // Standard YYYY-MM
  const matchYM = str.match(/^(\d{4})-(\d{2})$/);
  if (matchYM) {
    return parseInt(matchYM[1], 10) + (parseInt(matchYM[2], 10) - 1) / 12;
  }
  
  // Standard YYYY
  const matchY = str.match(/^(\d{4})$/);
  if (matchY) {
    return parseInt(matchY, 10);
  }
  
  // English Month/Year e.g., "June 2026"
  const dateParsed = Date.parse(str);
  if (!isNaN(dateParsed)) {
    const dateObj = new Date(dateParsed);
    return dateObj.getFullYear() + dateObj.getMonth() / 12;
  }
  
  return parseFloat(str) || 0;
}

exports.handler = async function(event, context) {
  try {
    const csvPath = path.resolve(__dirname, '../../timeline.csv');
    const content = await fs.promises.readFile(csvPath, 'utf8');
    
    const lines = content.split(/\r?\n/);
    const data = {
      config: {},
      events: []
    };
    
    if (lines.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }
    
    const headers = parseCSVLine(lines[0]);
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      if (row.Type === 'config') {
        data.config[row.ID] = row.Year;
      } else if (row.Type === 'event') {
        data.events.push({
          id: row.ID,
          year: row.Year,
          track: parseInt(row.Track, 10),
          title: row.Title,
          dateLabel: row['Date Label'] || row.DateLabel,
          description: row.Description
        });
      }
    }
    
    // Sort events chronologically by year/date, and then by ID
    data.events.sort((a, b) => {
      const valA = getNumericValue(a.year);
      const valB = getNumericValue(b.year);
      if (valA !== valB) return valA - valB;
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('Error reading or parsing CSV file:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to load timeline data' })
    };
  }
};
