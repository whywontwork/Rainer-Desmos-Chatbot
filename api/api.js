/**
 * Claude API Integration Module
 * 
 * This module provides classes for interacting with the Claude API, managing chat storage,
 * handling file uploads, and formatting text responses.
 * 
 * @version 1.0.0
 */

class ClaudeAPI {
    /**
     * Create a new Claude API client
     * @param {string} apiKey - The API key for authentication
     */
    constructor(apiKey) {
        this.apiKey = apiKey;
        
        // Always use a proxy server to avoid CORS issues
        // For local development, use localhost
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Get base URL for the proxy
        const port = isLocalhost ? ':10000' : '';
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        // Build complete proxy URL
        this.baseUrl = `${protocol}//${hostname}${port}/proxy/claude`;
    }

    /**
     * Send a message to the Claude API
     * @param {Object} params - The parameters for the API request
     * @returns {Promise<Object>} - The API response
     */
    async createMessage(params) {
        try {
            // Send request to our proxy
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const apiResponse = await response.json();
            return apiResponse;
        } catch (error) {
            console.error('Error calling Claude API:', error);
            throw error;
        }
    }
}

class ChatStorage {
    /**
     * Save chat history to a file
     * @param {Array} history - The chat history to save
     * @param {string} filename - The name to use for the saved file
     */
    static saveChatHistory(history, filename) {
        const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `chat_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    /**
     * Load chat history from a file
     * @param {File} file - The file containing chat history
     * @returns {Promise<Array>} - The parsed chat history
     */
    static loadChatHistory(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const history = JSON.parse(event.target.result);
                    resolve(history);
                } catch (e) {
                    reject(new Error('Invalid chat history file'));
                }
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    /**
     * Get recent chats from local storage
     * @returns {Array} - Array of recent chat information
     */
    static getRecentChats() {
        const recentChats = localStorage.getItem('recent_chats');
        return recentChats ? JSON.parse(recentChats) : [];
    }

    /**
     * Add a chat to the recent chats list
     * @param {Object} chatInfo - Information about the chat to add
     */
    static addRecentChat(chatInfo) {
        let recentChats = ChatStorage.getRecentChats();
        recentChats.unshift(chatInfo);
        recentChats = recentChats.slice(0, 10);
        localStorage.setItem('recent_chats', JSON.stringify(recentChats));
    }
}

class FileHandler {
    /**
     * Read multiple files and convert them to appropriate format for Claude API
     * @param {FileList} files - The files to read
     * @returns {Promise<Array>} - Array of file information objects
     */
    static async readMultipleFiles(files) {
        const filePromises = Array.from(files).map(async file => {
            if (file.type.startsWith('image/')) {
                const base64Data = await FileHandler.readImageAsBase64(file);
                return {
                    type: 'image',
                    name: file.name,
                    data: base64Data,
                    mediaType: file.type
                };
            } else {
                const textData = await FileHandler.readTextFile(file);
                return {
                    type: 'text',
                    name: file.name,
                    data: textData,
                    mediaType: file.type
                };
            }
        });

        return Promise.all(filePromises);
    }

    /**
     * Read an image file as base64
     * @param {File} file - The image file to read
     * @returns {Promise<string>} - Base64 encoded image data
     */
    static async readImageAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Read a text file
     * @param {File} file - The text file to read
     * @returns {Promise<string>} - The file contents
     */
    static async readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Paste images from clipboard
     * @returns {Promise<Array|null>} - Array of image objects or null if no images
     */
    static async pasteFromClipboard() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            const images = [];

            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const base64Data = await FileHandler.readImageAsBase64(blob);
                        images.push({
                            type: 'image',
                            name: 'Pasted Image',
                            data: base64Data,
                            mediaType: type
                        });
                    }
                }
            }

            return images.length ? images : null;
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            throw err;
        }
    }
}

class TextFormatter {
    /**
     * Format message content with special handling for code blocks, equations, and markdown
     * @param {string} message - The message to format
     * @returns {string} - The formatted message
     */
    static formatMessageContent(message) {
        if (!message) return '';
        
        // First clean up any timestamp markers
        message = message.replace(/^\[\d{2}:\d{2}:\d{2}\s*[ap]m\]\s*/gm, '');
        
        // Split message into code and non-code parts to avoid formatting inside code blocks
        const segments = [];
        let lastIndex = 0;
        let match;
        
        // Extract code blocks
        const codeBlockRegex = /```(.*?)\n([\s\S]*?)```/g;
        while ((match = codeBlockRegex.exec(message)) !== null) {
            // Add the text before this code block
            if (match.index > lastIndex) {
                segments.push({
                    type: 'text',
                    content: message.substring(lastIndex, match.index)
                });
            }
            
            // Add the code block
            segments.push({
                type: 'code',
                language: match[1],
                content: match[2]
            });
            
            lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text after the last code block
        if (lastIndex < message.length) {
            segments.push({
                type: 'text',
                content: message.substring(lastIndex)
            });
        }
        
        // If no code blocks were found, treat the entire message as text
        if (segments.length === 0) {
            segments.push({
                type: 'text',
                content: message
            });
        }
        
        // Process each segment
        const processedSegments = segments.map(segment => {
            if (segment.type === 'code') {
                // Format code blocks
                const code = segment.content
                    .replace(/^python\s*\n/gm, '')
                    .replace(/^python\s*def/gm, 'def')
                    .replace(/^plaintext/gm, '')
                    .trim();
                
                return `<div class="code-block">
                    <div class="code-header">
                        <span class="code-language">${segment.language}</span>
                    </div>
                    <pre><code class="language-${segment.language}">${code}</code></pre>
                </div>`;
            } else {
                // Process text segments
                let text = segment.content;
                
                // Process markdown syntax
                text = this.processMarkdownSyntax(text);
                
                // Process math expressions
                text = this.processLatexMath(text);
                
                // Process equations
                text = this.processEquations(text);
                
                return text;
            }
        });
        
        // Join all segments back together
        message = processedSegments.join('');
        
        // Process Python code snippets that should be in code blocks but aren't
        if (!message.includes('<pre><code')) {
            message = this.processPythonSnippets(message);
        }

        return message;
    }
    
    /**
     * Process LaTeX math expressions within $ delimiters
     * @param {string} text - The text to process
     * @returns {string} - The text with math expressions processed
     */
    static processLatexMath(text) {
        // Handle double $$ first as block math
        text = text.replace(/\$\$(.*?)\$\$/g, (match, content) => {
            return `<div class="math-block">${content}</div>`;
        });
        
        // Process single $ as inline math (paired delimiters)
        let result = '';
        let inMath = false;
        let mathContent = '';
        let currentPos = 0;
        
        while (currentPos < text.length) {
            const dollarPos = text.indexOf('$', currentPos);
            
            if (dollarPos === -1) {
                // No more $ symbols, add the rest of the text
                result += text.substring(currentPos);
                break;
            }
            
            if (inMath) {
                // We're in math mode, so this is a closing $
                mathContent += text.substring(currentPos, dollarPos);
                result += `<span class="math-inline">${mathContent}</span>`;
                inMath = false;
                currentPos = dollarPos + 1;
                mathContent = '';
            } else {
                // We're not in math mode, so this is an opening $
                result += text.substring(currentPos, dollarPos);
                inMath = true;
                currentPos = dollarPos + 1;
            }
        }
        
        // If we ended with an unclosed math expression, add it as text
        if (inMath) {
            result += '$' + mathContent;
        }
        
        return result;
    }
    
    /**
     * Process markdown syntax for headings and bold text
     * @param {string} text - The text to process
     * @returns {string} - The text with markdown syntax processed
     */
    static processMarkdownSyntax(text) {
        // Process ## as headings (only at the start of a line or after newline)
        text = text.replace(/(^|\n)##\s+(.*?)(\n|$)/g, (match, start, content, end) => {
            return `${start}<h2>${content}</h2>${end}`;
        });
        
        // Process # as bold text (only at the start of a line or after newline)
        text = text.replace(/(^|\n)#\s+([^#\n]+)(\n|$)/g, (match, start, content, end) => {
            return `${start}<strong>${content}</strong>${end}`;
        });
        
        // Process # in middle of text as bold (not at the start of a line)
        text = text.replace(/(?<![#\n])#\s+([^#\n]+)(?!\n|$)/g, (match, content) => {
            return `<strong>${content}</strong>`;
        });
        
        return text;
    }
    
    /**
     * Process equations for display
     * @param {string} text - The text to process
     * @returns {string} - The text with equations processed
     */
    static processEquations(text) {
        // Don't process if already processed
        if (text.includes('<span class="equation-block">')) {
            return text;
        }
        
        // Pattern to find equations
        const equationPattern = /([a-z])(?:\s*)(=)(?:\s*)([^<>\n]+?)(?=\s*$|\n|<br>|<div>|<p>)/gim;
        
        return text.replace(equationPattern, (match, variable, equals, expression) => {
            // Don't process if already in HTML tags or inside code
            if (match.includes('<span') || match.includes('</span') || 
                match.includes('<pre') || match.includes('</pre')) {
                return match;
            }
            
            // Clean and normalize the expression
            let cleanExpression = expression.trim();
            
            // Check if this looks like a real equation (contains math operators or variable references)
            if (!/[-+*/^√∫()=≠≤≥<>\[\]{}∂∇·×÷²³]/.test(cleanExpression) && 
                !/[a-z][a-z0-9_]*/.test(cleanExpression)) {
                return match; // Not a math equation
            }
            
            return `<span class="equation-block math-styled">${variable}${equals}${cleanExpression}</span>`;
        });
    }
    
    /**
     * Process Python code snippets
     * @param {string} text - The text to process
     * @returns {string} - The text with Python snippets processed
     */
    static processPythonSnippets(text) {
        // Check for obvious Python code patterns
        const pythonPatterns = [
            /^import\s+[a-zA-Z0-9_.]+/m,
            /^from\s+[a-zA-Z0-9_.]+\s+import/m,
            /^def\s+[a-zA-Z0-9_]+\s*\(/m,
            /^plt\.[a-zA-Z0-9_]+\s*\(/m,
            /^fig.*=\s*plt\.figure\(/m,
            /^x\s*=\s*np\./m
        ];
        
        let hasPythonCode = false;
        for (const pattern of pythonPatterns) {
            if (pattern.test(text)) {
                hasPythonCode = true;
                break;
            }
        }
        
        if (hasPythonCode) {
            // Look for blocks of lines that might be code
            const lines = text.split('\n');
            let inCodeBlock = false;
            let codeBlockStart = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Skip empty lines
                if (!line) continue;
                
                // Check if this line looks like Python code
                const isPythonCodeLine = 
                    /^import\s+/.test(line) || 
                    /^from\s+.+\s+import/.test(line) ||
                    /^def\s+/.test(line) ||
                    /^plt\./.test(line) ||
                    /^fig.*=/.test(line) || 
                    /^x\s*=\s*np\./.test(line) ||
                    /^y\s*=/.test(line) ||
                    /^ax\./.test(line) ||
                    (inCodeBlock && line.startsWith('    '));
                
                if (isPythonCodeLine && !inCodeBlock) {
                    // Start a new code block
                    inCodeBlock = true;
                    codeBlockStart = i;
                } else if (!isPythonCodeLine && inCodeBlock) {
                    // End the code block
                    const codeLines = lines.slice(codeBlockStart, i);
                    const codeBlock = `<pre><code class="language-python">${codeLines.join('\n')}</code></pre>`;
                    lines.splice(codeBlockStart, i - codeBlockStart, codeBlock);
                    i = codeBlockStart + 1;
                    inCodeBlock = false;
                }
            }
            
            // Handle code block at the end of the text
            if (inCodeBlock) {
                const codeLines = lines.slice(codeBlockStart);
                const codeBlock = `<pre><code class="language-python">${codeLines.join('\n')}</code></pre>`;
                lines.splice(codeBlockStart, lines.length - codeBlockStart, codeBlock);
            }
            
            text = lines.join('\n');
        }
        
        return text;
    }
}

// Export all classes for use in other modules
export { ClaudeAPI, ChatStorage, FileHandler, TextFormatter };