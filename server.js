const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

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

// Custom CSV Parser supporting quotes and multi-line values
function parseTimelineCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = {
      config: {},
      events: []
    };
    
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return data;
    const headers = rows[0];
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      if (row.Type === 'config') {
        // config rows: ID contains the config key, Year contains the config value
        data.config[row.ID] = row.Year;
      } else if (row.Type === 'event') {
        data.events.push({
          id: row.ID,
          year: row.Year, // Stored as raw string
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
    
    return data;
  } catch (error) {
    console.error('Error reading or parsing CSV file:', error);
    return { config: {}, events: [] };
  }
}

// API Endpoint to get the parsed timeline config and events
app.get('/api/timeline', (req, res) => {
  const csvPath = path.join(__dirname, 'timeline.csv');
  const parsedData = parseTimelineCSV(csvPath);
  res.json(parsedData);
});

// Start server
app.listen(PORT, () => {
  console.log(`Timeline Server is running on http://localhost:${PORT}`);
});
