const fs = require('fs');
const path = require('path');

// Read the app.js file
const appJsPath = path.join(__dirname, 'core', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Create a backup
fs.writeFileSync(appJsPath + '.bak2', appJsContent);

// Update the TextFormatter
const oldTextFormatter = `const TextFormatter = {
    formatText: function(text) {
        if (\!text) return '';
        // Simple conversion of newlines to <br> tags
        return text.replace(/\\n/g, '<br>');
    }
};`;

const newTextFormatter = `const TextFormatter = {
    formatText: function(text) {
        if (\!text) return '';
        if (typeof text \!== 'string') {
            console.warn('TextFormatter received non-string input:', text);
            return String(text || '');
        }
        // Simple conversion of newlines to <br> tags
        return text.replace(/\\n/g, '<br>');
    }
};`;

appJsContent = appJsContent.replace(oldTextFormatter, newTextFormatter);

// Save the file with updates
fs.writeFileSync(appJsPath, appJsContent);
console.log('Updated TextFormatter to handle non-string inputs');
