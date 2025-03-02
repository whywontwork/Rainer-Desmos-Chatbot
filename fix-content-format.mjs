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
fs.writeFileSync(serverJsPath + '.bak3', serverJsContent);

// Update the response processing to handle the specific issue with content array
const contentProcessingCode = `            // Format the response - add error checking
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
            }`;

// Improved version that better handles the array format seen in the response
const fixedContentProcessing = `            // Format the response - add error checking
            let safeContent = message.content;
            
            // Handle potential null/undefined content
            if (\!safeContent) {
                console.warn('API returned empty content - using fallback');
                safeContent = 'The API is currently experiencing high traffic. Please try again later.';
            }
            
            // Handle array content format (new Claude API responses)
            if (typeof safeContent === 'object') {
                try {
                    // If it's a content array (Claude messages format)
                    if (Array.isArray(safeContent)) {
                        console.log('Detected array content format:', JSON.stringify(safeContent).substring(0, 200));
                        
                        // Extract text from each item in the array
                        const textParts = [];
                        for (const item of safeContent) {
                            if (item && typeof item === 'object' && item.type === 'text' && item.text) {
                                textParts.push(item.text);
                            }
                        }
                        
                        safeContent = textParts.join('');
                        
                        if (\!safeContent) {
                            safeContent = 'Received empty content from API. Please try again.';
                        }
                    } else if (safeContent.type === 'text' && safeContent.text) {
                        // Handle single content object
                        safeContent = safeContent.text;
                    } else {
                        // Unknown object format, just stringify it
                        safeContent = JSON.stringify(safeContent);
                    }
                } catch (e) {
                    console.error('Error processing content:', e);
                    safeContent = 'Error processing response. Please try again.';
                }
            }`;

serverJsContent = serverJsContent.replace(contentProcessingCode, fixedContentProcessing);

// Save the file with updates
fs.writeFileSync(serverJsPath, serverJsContent);
console.log('Updated server.mjs to better handle array content format');
