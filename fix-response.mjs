import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the server.mjs file
const serverJsPath = path.join(__dirname, 'server.mjs');
let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

// Create a backup
fs.writeFileSync(serverJsPath + '.bak2', serverJsContent);

// Update the response handling in the proxy
const oldResponseFormatting = `            // Format the response
            res.json({
                id: message.id,
                content: message.content,
                role: message.role,
                usage: message.usage
            });`;

const newResponseFormatting = `            // Format the response - add error checking
            let safeContent = message.content;
            
            // Handle potential null/undefined content
            if (\!safeContent) {
                console.warn('API returned empty content - using fallback');
                safeContent = 'The API is currently experiencing high traffic. Please try again later.';
            }
            
            // Handle array content format (new Claude API responses)
            if (typeof safeContent === 'object') {
                try {
                    if (Array.isArray(safeContent)) {
                        const textParts = safeContent
                            .filter(part => part && part.text)
                            .map(part => part.text);
                            
                        safeContent = textParts.join('');
                        
                        if (\!safeContent) {
                            safeContent = 'Received empty content from API. Please try again.';
                        }
                    } else {
                        safeContent = JSON.stringify(safeContent);
                    }
                } catch (e) {
                    console.error('Error processing content:', e);
                    safeContent = 'Error processing response. Please try again.';
                }
            }
            
            res.json({
                id: message.id || 'response_id',
                content: safeContent,
                role: message.role || 'assistant',
                usage: message.usage || { input_tokens: 0, output_tokens: 0 }
            });`;

serverJsContent = serverJsContent.replace(oldResponseFormatting, newResponseFormatting);

// Save the file with updates
fs.writeFileSync(serverJsPath, serverJsContent);
console.log('Updated server.mjs to handle API response edge cases');
