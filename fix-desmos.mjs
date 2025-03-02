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
fs.writeFileSync(appJsPath + '.desmosfix.bak', appJsContent);

// Read desmos-core.js content
let desmosCoreJsContent = fs.readFileSync(desmosCoreJsPath, 'utf8');
// Create a backup
fs.writeFileSync(desmosCoreJsPath + '.desmosfix.bak', desmosCoreJsContent);

// Fix 1: Update the initializeDesmosIntegration method in app.js to check for the container
console.log('Updating initializeDesmosIntegration method in app.js...');

// Replace the method with updated version
if (appJsContent.includes('initializeDesmosIntegration()')) {
    console.log('Found initializeDesmosIntegration method');
    
    // Find the location after the calculator element check
    const insertPos = appJsContent.indexOf('const desmosElement = document.getElementById(\'desmos-calculator\');');
    if (insertPos !== -1) {
        const nextIfStatementPos = appJsContent.indexOf('if (!desmosElement)', insertPos);
        const nextIfStatementEndPos = appJsContent.indexOf('return;', nextIfStatementPos) + 7;
        
        if (nextIfStatementEndPos !== -1) {
            // Insert our container check code after the desmosElement check
            const containerCheckCode = `
        
        // Ensure the container exists
        const desmosContainer = document.getElementById('desmos-container');
        if (!desmosContainer) {
            console.error('Desmos container not found');
            return;
        }
        
        // Ensure the toggle button exists
        const toggleButton = document.getElementById('toggle-graph-btn');
        if (!toggleButton) {
            console.warn('Desmos toggle button not found');
            // Continue anyway since we have fallback in DesmosIntegration
        } else {
            // Connect the toggle button to the desmos container visibility
            toggleButton.addEventListener('click', () => {
                desmosContainer.classList.toggle('visible');
                const isVisible = desmosContainer.classList.contains('visible');
                toggleButton.textContent = isVisible ? 'Hide Graph' : '📊 Graph';
            });
        }`;
            
            // Splice the code into the content
            appJsContent = appJsContent.slice(0, nextIfStatementEndPos) + containerCheckCode + appJsContent.slice(nextIfStatementEndPos);
            console.log('Added Desmos container checks');
        } else {
            console.error('Could not find end of desmosElement check');
        }
    } else {
        console.error('Could not find desmosElement check');
    }
} else {
    console.error('Could not find initializeDesmosIntegration method');
}

// Fix 2: Update all instances of direct visibility manipulation in app.js
console.log('Updating direct Desmos container visibility calls...');

// Pattern to replace: document.getElementById('desmos-container').classList.add('visible');
let updatedAppJsContent = appJsContent.replace(
    /document\.getElementById\('desmos-container'\)\.classList\.add\('visible'\)/g,
    "const desmosContainer = document.getElementById('desmos-container'); if (desmosContainer) { desmosContainer.classList.add('visible'); }"
);

// Fix 3: Update the setupToggleButton method in desmos-core.js to use the correct ID
console.log('Updating setupToggleButton method in desmos-core.js...');

// Replace the button ID reference
let updatedDesmosCoreJsContent = desmosCoreJsContent.replace(
    /const toggleButton = document\.getElementById\('desmos-toggle'\);/g,
    "const toggleButton = document.getElementById('toggle-graph-btn');"
);

// Write the updated files
fs.writeFileSync(appJsPath, updatedAppJsContent);
fs.writeFileSync(desmosCoreJsPath, updatedDesmosCoreJsContent);

console.log('Fix completed successfully.');