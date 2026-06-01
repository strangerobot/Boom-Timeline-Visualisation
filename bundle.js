const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// 1. Load Favicon as Base64 Data URI
const faviconPath = path.join(publicDir, 'favicon.svg');
let faviconDataUri = '';
if (fs.existsSync(faviconPath)) {
  const content = fs.readFileSync(faviconPath);
  const base64 = content.toString('base64');
  faviconDataUri = `data:image/svg+xml;base64,${base64}`;
}

// 2. Load CSV file
const timelineCsv = fs.readFileSync(path.join(publicDir, 'timeline.csv'), 'utf8');

// 3. Load CSS
const cssContent = fs.readFileSync(path.join(publicDir, 'style.css'), 'utf8');

// 4. Load & patch JS
let jsContent = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

// Prepend the CSV data declaration
const csvDeclarations = `const csvText = ${JSON.stringify(timelineCsv)};\n`;
jsContent = csvDeclarations + jsContent;

// Replace fetch block with local execution block
const targetFetchBlock = `  // Fetch timeline.csv directly (works on Netlify static hosting and local Express)
  fetch('/timeline.csv')
    .then(response => response.text())
    .then(csvText => {
      const data = parseTimelineCSV(csvText);
      cachedTimelineData = data;
      renderTimeline(data);
    })
    .catch(error => {
      console.error('Error fetching timeline data:', error);
    });`;

const replacementFetchBlock = `  // Loaded inline from bundled csv content
  (function() {
    const data = parseTimelineCSV(csvText);
    cachedTimelineData = data;
    renderTimeline(data);
  })();`;

if (!jsContent.includes(targetFetchBlock)) {
  console.error("Warning: Target fetch block not found exactly in app.js. Please verify replacement.");
} else {
  jsContent = jsContent.replace(targetFetchBlock, replacementFetchBlock);
}

// 5. Load and compile HTML
let htmlContent = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

// Replace favicon
if (faviconDataUri) {
  htmlContent = htmlContent.replace('href="favicon.svg"', `href="${faviconDataUri}"`);
}

// Inline CSS
const cssTagPattern = '<link rel="stylesheet" href="style.css">';
const inlineCssTag = `<style>\n${cssContent}\n</style>`;
htmlContent = htmlContent.replace(cssTagPattern, inlineCssTag);

// Inline JS
const jsTagPattern = '<script src="app.js"></script>';
const inlineJsTag = `<script>\n${jsContent}\n</script>`;
htmlContent = htmlContent.replace(jsTagPattern, inlineJsTag);

// Write output file
const outputFilePath = path.join(__dirname, 'timeline_visualisation_package.html');
fs.writeFileSync(outputFilePath, htmlContent, 'utf8');
console.log(`Successfully compiled self-contained HTML file: ${outputFilePath}`);
