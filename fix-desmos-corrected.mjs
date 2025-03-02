import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the files
const appJsPath = path.join(__dirname, 'core', 'app.js');
const desmosCoreJsPath = path.join(__dirname, 'desmos', 'desmos-core.js');

// Read app.js content
let appJsContent = fs.readFileSync(appJsPath, 'utf8');
// Create a backup
fs.writeFileSync(appJsPath + '.desmosfix.bak2', appJsContent);

// Read desmos-core.js content
let desmosCoreJsContent = fs.readFileSync(desmosCoreJsPath, 'utf8');
// Create a backup
fs.writeFileSync(desmosCoreJsPath + '.desmosfix.bak2', desmosCoreJsContent);

// Fix 1: Update the setupToggleButton method in desmos-core.js to use the correct ID
console.log('Updating setupToggleButton method in desmos-core.js...');

// Replace the button ID reference
let updatedDesmosCoreJsContent = desmosCoreJsContent.replace(
    /const toggleButton = document\.getElementById\('desmos-toggle'\);/g,
    "const toggleButton = document.getElementById('toggle-graph-btn');"
);

// Write the updated files
fs.writeFileSync(desmosCoreJsPath, updatedDesmosCoreJsContent);

// Fix 2: Update all instances of direct visibility manipulation in app.js
console.log('Updating direct Desmos container visibility calls in app.js...');

// Pattern to replace: document.getElementById('desmos-container').classList.add('visible');
let updatedAppJsContent = appJsContent.replace(
    /document\.getElementById\('desmos-container'\)\.classList\.add\('visible'\)/g,
    "const desmosContainer = document.getElementById('desmos-container'); if (desmosContainer) { desmosContainer.classList.add('visible'); }"
);

// Write the updated app.js file
fs.writeFileSync(appJsPath, updatedAppJsContent);

console.log('Fix completed successfully.');