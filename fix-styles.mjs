import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the styles.css file
const stylesPath = path.join(__dirname, 'ui', 'styles.css');
let stylesContent = fs.readFileSync(stylesPath, 'utf8');
// Create a backup
fs.writeFileSync(stylesPath + '.bak', stylesContent);

// Find the calculator-container.active rule
const activeRuleRegex = /\.calculator-container\.active\s*{[^}]*}/;
const activeRule = stylesContent.match(activeRuleRegex);

if (activeRule) {
    // Get the active rule content
    const activeRuleText = activeRule[0];
    // Create a visible rule with the same content
    const visibleRule = activeRuleText.replace('.calculator-container.active', '.calculator-container.visible');
    
    // Add the visible rule after the active rule
    const modifiedContent = stylesContent.replace(
        activeRuleText, 
        `${activeRuleText}\n\n/* Add visible class for desmos integration */\n${visibleRule}`
    );
    
    // Write the modified styles back to the file
    fs.writeFileSync(stylesPath, modifiedContent);
    console.log('Added .calculator-container.visible rule to styles.css');
} else {
    console.error('Could not find .calculator-container.active rule in styles.css');
}