import { ClaudeAPI, ChatStorage, FileHandler, TextFormatter } from '../api/api.js';
import { Config, ApiUsageTracker, CLAUDE_MODELS } from '../config/config.js';
import { DesmosIntegration } from '../desmos/desmos-core.js';
import { EquationProcessor, DirectPlotHandler, AutoPlotHandler } from '../desmos/equation-processor.js';

class ClaudeChatbot {
    /**
     * Create a new Claude chatbot instance
     */
    constructor() {
        // Load configuration
        this.config = Config.load();
        
        // Initialize API client
        this.client = new ClaudeAPI(this.config.API_KEY);
        
        // Set up state
        this.currentModel = this.config.DEFAULT_MODEL;
        this.conversationHistory = [];
        this.currentChatFile = null;
        this.apiUsageTracker = new ApiUsageTracker();
        this.fileAttachments = [];
        this.imageAttachments = [];
        this.systemExpanded = false;
        this.autosaveInterval = null;
        
        // Session tracking
        this.sessionId = this.generateSessionId();
        this.lastInteractionTime = Date.now();
        
        // Messages for API
        this.apiMessages = [];
        
        // Initialize UI and components
        this.initializeUI();
        
        // Initialize Desmos integration after UI is set up
        try {
            this.initializeDesmosIntegration();
        } catch (error) {
            console.error('Failed to initialize Desmos integration:', error);
            this.updateStatusBar('Desmos initialization failed: ' + error.message);
        }
        
        // Set up autosave if enabled
        if (this.config.AUTO_SAVE_CHAT) {
            this.setupAutosave();
        }
        
        // Apply current theme
        Config.applyTheme(this.config.THEME);
    }
    
    /**
     * Generate a unique session ID
     * @returns {string} The generated session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    }
    
    /**
     * Initialize the API client
     */
    initializeClient() {
        if (this.config.API_KEY) {
            try {
                this.client = new ClaudeAPI(this.config.API_KEY);
                this.updateStatusBar('API client initialized');
            } catch (error) {
                this.updateStatusBar('Failed to initialize API client: ' + error.message);
            }
        } else {
            this.updateStatusBar('API key not configured');
        }
    }
    
    /**
     * Initialize the UI elements and event handlers
     */
    initializeUI() {
        // Get DOM elements
        this.chatArea = document.getElementById('chat-area');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        this.statusBar = document.getElementById('status-bar');
        this.fileInput = document.getElementById('file-input');
        this.fileButton = document.getElementById('file-button');
        this.clearButton = document.getElementById('clear-button');
        this.filePreview = document.getElementById('file-preview');
        this.systemInput = document.getElementById('system-input');
        this.systemToggle = document.getElementById('system-toggle');
        this.thinkingIndicator = document.getElementById('thinking-indicator');
        this.menuItems = document.querySelectorAll('.menu-item');
        this.dropdownMenus = document.querySelectorAll('.dropdown-menu');
        
        // Set event listeners for message sending
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Set event listeners for file handling
        this.fileButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.clearButton.addEventListener('click', () => this.clearChat());
        
        // Set event listeners for system prompt
        this.systemToggle.addEventListener('click', () => this.toggleSystemPrompt());
        
        // Initialize dropdown menus
        this.initializeDropdownMenus();
        
        // Set up the model dropdown
        this.initializeModelSelector();
        
        // Set up theme switcher
        this.initializeThemeSelector();
        
        // Set initial status
        this.updateStatusBar('Ready');
    }
    
    /**
     * Initialize dropdown menus with proper event handlers
     */
    initializeDropdownMenus() {
        // First remove duplicate model entries if present
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector) {
            // Remove duplicate entries
            const optionValues = new Set();
            Array.from(modelSelector.options).forEach(option => {
                if (optionValues.has(option.value)) {
                    modelSelector.removeChild(option);
                } else {
                    optionValues.add(option.value);
                }
            });
        }

        // Setup menu item click events
        this.menuItems.forEach(item => {
            if (item.nextElementSibling && item.nextElementSibling.classList.contains('dropdown-menu')) {
                // Use click to toggle dropdown visibility
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleDropdown(item.nextElementSibling);
                });
                
                // Handle clicks on dropdown items
                const dropdownItems = item.nextElementSibling.querySelectorAll('.dropdown-item');
                dropdownItems.forEach(dropdownItem => {
                    dropdownItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handleMenuItemClick(dropdownItem.id);
                        this.closeAllDropdowns();
                    });
                });
            }
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            // Check if click is on a menu item or inside a dropdown
            let isMenuClick = false;
            
            // Check menu items
            this.menuItems.forEach(item => {
                if (item.contains(e.target)) {
                    isMenuClick = true;
                }
            });
            
            // Check dropdown menus
            this.dropdownMenus.forEach(dropdown => {
                if (dropdown.contains(e.target)) {
                    isMenuClick = true;
                }
            });
            
            if (!isMenuClick) {
                this.closeAllDropdowns();
            }
        });
    }
    
    /**
     * Handle clicks on dropdown menu items
     * @param {string} itemId - The ID of the clicked menu item
     */
    handleMenuItemClick(itemId) {
        console.log(`Menu item clicked: ${itemId}`);
        
        switch (itemId) {
            // File menu
            case 'new-chat':
                this.clearChat();
                break;
            case 'open-chat':
                // Show file picker to load chat
                this.showFilePicker();
                break;
            case 'save-chat':
                this.saveChat();
                break;
            case 'export-chat':
                this.exportChat();
                break;
                
            // Edit menu
            case 'clear-chat':
                this.clearChat();
                break;
            case 'copy-last':
                this.copyLastMessage();
                break;
            case 'copy-all':
                this.copyAllMessages();
                break;
                
            // Settings menu
            case 'api-settings':
                this.showSettings('api');
                break;
            case 'theme-settings':
                this.showSettings('theme');
                break;
            case 'chat-settings':
                this.showSettings('chat');
                break;
                
            // Help menu
            case 'about':
                this.showAboutDialog();
                break;
            case 'keyboard-shortcuts':
                this.showKeyboardShortcuts();
                break;
            case 'documentation':
                this.showDocumentation();
                break;
                
            default:
                console.log(`No handler for menu item: ${itemId}`);
        }
    }
    
    /**
     * Initialize model selector dropdown
     */
    initializeModelSelector() {
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector) {
            // Clear existing options
            modelSelector.innerHTML = '';
            
            // Add model options
            for (const model in CLAUDE_MODELS) {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                if (model === this.config.DEFAULT_MODEL) {
                    option.selected = true;
                }
                modelSelector.appendChild(option);
            }
            
            modelSelector.addEventListener('change', (e) => {
                this.currentModel = e.target.value;
                const modelConfig = CLAUDE_MODELS[this.currentModel];
                this.updateStatusBar(`Model changed to ${this.currentModel}`);
            });
        }
    }
    
    /**
     * Initialize theme selector
     */
    initializeThemeSelector() {
        const themeSelector = document.getElementById('theme-selector');
        if (themeSelector) {
            themeSelector.value = this.config.THEME;
            themeSelector.addEventListener('change', (e) => {
                this.config.THEME = e.target.value;
                Config.applyTheme(this.config.THEME);
                Config.save(this.config);
                this.updateStatusBar(`Theme changed to ${this.config.THEME}`);
            });
        }
        
        // Apply initial font size
        document.documentElement.style.setProperty('--base-font-size', `${this.config.FONT_SIZE}px`);
    }
    
    /**
     * Toggle dropdown menu
     * @param {HTMLElement} dropdown - The dropdown element to toggle
     */
    toggleDropdown(dropdown) {
        this.closeAllDropdowns();
        dropdown.classList.toggle('active');
        dropdown.style.display = dropdown.classList.contains('active') ? 'block' : 'none';
    }
    
    /**
     * Close all dropdown menus
     */
    closeAllDropdowns() {
        this.dropdownMenus.forEach(dropdown => {
            dropdown.classList.remove('active');
            dropdown.style.display = 'none';
        });
    }
    
    /**
     * Initialize Desmos integration
     */
    initializeDesmosIntegration() {
        // Check if the Desmos calculator element exists
        const desmosElement = document.getElementById('desmos-calculator');
        if (!desmosElement) {
            console.warn('Desmos calculator element not found, skipping integration');
            return;
        }
        
        try {
            // Initialize Desmos integration
            this.desmosIntegration = new DesmosIntegration(this);
            
            // Set up equation processor
            this.equationProcessor = new EquationProcessor(this.desmosIntegration);
            
            // Fix: Make sure desmosIntegration is set up correctly before creating handlers
            if (!this.desmosIntegration || !this.desmosIntegration.calculator) {
                throw new Error('Desmos calculator not properly initialized');
            }
            
            // Set up direct plot handler
            this.directPlotHandler = new DirectPlotHandler(this.desmosIntegration);
            
            // Set up auto plot handler
            this.autoPlotHandler = new AutoPlotHandler(this.equationProcessor, this.desmosIntegration);
            
            // Make integration globally available
            window.desmosIntegration = this.desmosIntegration;
            
            this.updateStatusBar('Desmos integration initialized');
        } catch (error) {
            console.error('Failed to initialize Desmos integration:', error);
            throw error; // Re-throw to allow the constructor to catch it
        }
    }
    
    /**
     * Get the current state of the graph for a message
     * @returns {string|null} The graph state message or null if no graph
     */
    getCurrentGraphState() {
        if (this.desmosIntegration) {
            return this.desmosIntegration.getCurrentGraphAsMessage();
        }
        return null;
    }
    
    /**
     * Toggle the system prompt visibility
     */
    toggleSystemPrompt() {
        this.systemExpanded = !this.systemExpanded;
        const systemContainer = document.getElementById('system-container');
        
        if (this.systemExpanded) {
            systemContainer.classList.remove('hidden');
            this.systemToggle.textContent = '▼ System Prompt';
        } else {
            systemContainer.classList.add('hidden');
            this.systemToggle.textContent = '► System Prompt';
        }
    }
    
    /**
     * Detect ASCII art that might be graphs
     * @param {string} text - The text to check for ASCII art
     * @returns {boolean} - Whether ASCII art was detected
     */
    detectAsciiArt(text) {
        // Patterns that often appear in ASCII art graphs
        const asciiPatterns = [
            // Axes and grid lines
            /[+\-|\\\/\*]{10,}/,  // Repeated symbols like -------- or ||||||
            /\|\s*[-=]+\s*>/,     // Axis with arrow: |---->
            /[0-9]+\s*\|\s*[0-9]+/, // Numbered axis: 10 | 20
            
            // Box drawing characters
            /[│┃┆┇┊┋╵╷┌┐└┘├┤┬┴┼╌╍═━]{3,}/,
            
            // ASCII chart patterns
            /[\(\)\[\]\{\}][_\-\s]+[\(\)\[\]\{\}]/,
            /\+[-+]+\+/,         // Grid pattern: +---+---+
            
            // Common ASCII plotting patterns
            /\*\s+\*\s+\*/,       // Stars used for plotting
            /[\.o\*+#@]\s+[\.o\*+#@]/, // Various plot symbols
            
            // ASCII function plotting
            /y\s*\|\s*[\*\.o+#]/,  // y-axis with plot points
        ];
        
        // Check each pattern
        for (const pattern of asciiPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        
        // Look for multiple lines with similar structures (common in ASCII art)
        const lines = text.split('\n');
        if (lines.length > 3) {
            let similarStructureLines = 0;
            
            for (let i = 0; i < lines.length - 1; i++) {
                // Compare consecutive lines for similar structure
                if (lines[i].length > 5 && 
                    lines[i+1].length > 5 && 
                    Math.abs(lines[i].length - lines[i+1].length) < 3 &&
                    /[+\-|\\\/\*\.o#]/.test(lines[i]) &&
                    /[+\-|\\\/\*\.o#]/.test(lines[i+1])) {
                    similarStructureLines++;
                    
                    // If we find enough similar lines, it's likely ASCII art
                    if (similarStructureLines >= 2) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Send a message to Rainer_Smart
     */
    async sendMessage() {
        const userInput = this.textInput.value.trim();
        let systemPrompt = this.systemInput ? this.systemInput.value.trim() : '';
        
        // Always add instructions about avoiding ASCII art for graphs
        const noAsciiArtInstruction = "IMPORTANT: When asked to plot, graph, or visualize mathematical functions or data, NEVER use ASCII art. Always use the integrated Desmos graphing calculator. The Desmos calculator can plot functions like y=x^2 or y=sin(x) or f(x)=e^x.";
        
        // If there's already a system prompt, append to it; otherwise use as the prompt
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${noAsciiArtInstruction}` : noAsciiArtInstruction;
        
        if (!userInput) return;
        
        // Reset input and attachments
        this.textInput.value = '';
        
        // Add user message to chat
        this.addMessageToChat('You', userInput);
        
        // If it's a "what's on the graph" query, provide current graph state directly
        if (/what('s| is) on the graph|what equations? (are|is) (shown|displayed|plotted)/i.test(userInput)) {
            const graphState = this.getCurrentGraphState();
            if (graphState) {
                this.addMessageToChat('Rainer_Smart', graphState, true);
                return;
            }
        }
        
        // Show thinking indicator
        this.setThinkingIndicator(true);
        
        try {
            // Calculate window size
            const contextWindow = CLAUDE_MODELS[this.currentModel]?.CONTEXT_WINDOW_SIZE || 
                                this.config.CONTEXT_WINDOW_SIZE;
            
            // Prepare messages for API
            const messageHistory = this.prepareMessageHistory(contextWindow);
            
            // Add the new user message
            messageHistory.push({
                role: 'user',
                content: userInput
            });
            
            // Process attached files if any
            if (this.fileAttachments.length > 0 || this.imageAttachments.length > 0) {
                // Get the last message which is the user message we just added
                const lastMessage = messageHistory[messageHistory.length - 1];
                
                // Convert message content to an array if it's not already
                if (typeof lastMessage.content === 'string') {
                    lastMessage.content = [{ type: 'text', text: lastMessage.content }];
                }
                
                // Add file content
                for (const file of this.fileAttachments) {
                    lastMessage.content.push({
                        type: 'text',
                        text: `File: ${file.name}\n\n${file.data}`
                    });
                }
                
                // Add image content
                for (const image of this.imageAttachments) {
                    lastMessage.content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: image.mediaType,
                            data: image.data
                        }
                    });
                }
            }
            
            // Prepare API request parameters
            const params = {
                model: CLAUDE_MODELS[this.currentModel]?.id || 'claude-3-7-sonnet-20250219',
                messages: messageHistory,
                max_tokens: this.config.MAX_TOKENS
            };
            
            // Add system prompt if provided
            if (systemPrompt) {
                params.system = systemPrompt;
            }
            
            // Send to API
            const response = await this.client.createMessage(params);
            
            // Record API usage if enabled
            if (this.config.SAVE_API_USAGE) {
                this.apiUsageTracker.recordUsage(
                    params.model,
                    response.usage?.input_tokens || 0,
                    response.usage?.output_tokens || 0
                );
            }
            
            // Process and add Rainer_Smart's response to chat
            const claudeMessage = response.content[0].text;
            const formattedMessage = TextFormatter.formatMessageContent(claudeMessage);
            this.addMessageToChat('Rainer_Smart', formattedMessage, true);
            
            // Process equations if available without modifying the message content
            if (this.desmosIntegration && this.equationProcessor) {
                // Look for equations in the last message and plot them
                setTimeout(() => {
                    const lastMessageElement = this.chatArea.lastElementChild;
                    if (lastMessageElement) {
                        const messageContent = lastMessageElement.querySelector('.message-content');
                        if (messageContent) {
                            // Check if message contains ASCII art that might be a graph attempt
                            const hasAsciiArt = this.detectAsciiArt(messageContent.textContent);
                            const isGraphRequest = userInput.toLowerCase().match(/plot|graph|draw|show|visualize|create a graph/);
                            
                            // If it's a graph request and we found ASCII art, show a warning and ensure Desmos is visible
                            if (isGraphRequest && hasAsciiArt) {
                                // Force Desmos to be visible
                                if (this.desmosIntegration && !this.desmosIntegration.isActive) {
                                    this.desmosIntegration.toggleCalculator();
                                }
                                
                                // Add a system message warning about ASCII art
                                this.addMessageToChat('System', 'ASCII art detected in the response. Using Desmos for proper mathematical visualization instead.', true, 'warning');
                            }
                            
                            // Process for equations regardless
                            const result = this.equationProcessor.processMessageForEquations(messageContent.textContent);
                            
                            // Only update the status bar with the result
                            if (result && typeof result === 'object' && result.success) {
                                this.updateStatusBar(`Plotted ${result.equations.length} equation(s): ${result.equations.join(', ')}`);
                            } 
                            // If we have a graph request but no equations were found, and there's ASCII art,
                            // add a message suggesting the user try again with a more specific request
                            else if (isGraphRequest && hasAsciiArt && (!result || !result.success)) {
                                this.addMessageToChat('System', 'No valid equations were found to plot in Desmos. Try asking for a specific equation, like "plot y=x²".', true, 'warning');
                            }
                        }
                    }
                }, 100);
            }
            
            // Update conversation history
            this.conversationHistory.push({
                timestamp: new Date().toLocaleTimeString(),
                sender: 'You',
                message: userInput,
                attachments: [...this.fileAttachments, ...this.imageAttachments]
            });
            
            this.conversationHistory.push({
                timestamp: new Date().toLocaleTimeString(),
                sender: 'Rainer_Smart',
                message: claudeMessage
            });
            
            // Store API format messages for context
            this.apiMessages.push({
                role: 'user',
                content: userInput
            });
            
            this.apiMessages.push({
                role: 'assistant',
                content: claudeMessage
            });
            
            // Reset attachments
            this.clearAttachments();
            
            // Update last interaction time
            this.lastInteractionTime = Date.now();
            
            // Update status
            this.updateStatusBar('Message sent and response received');
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessageToChat('System', `Error: ${error.message}`, true, 'error');
            this.updateStatusBar('Error: ' + error.message);
        } finally {
            // Hide thinking indicator
            this.setThinkingIndicator(false);
        }
    }
    
    /**
     * Show file picker for loading chats
     */
    showFilePicker() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadChat(e.target.files[0]);
            }
        });
        fileInput.click();
    }
    
    /**
     * Copy the last message to clipboard
     */
    copyLastMessage() {
        if (this.conversationHistory.length > 0) {
            const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
            navigator.clipboard.writeText(lastMessage.message)
                .then(() => this.updateStatusBar('Last message copied to clipboard'))
                .catch(err => this.updateStatusBar('Failed to copy: ' + err.message));
        } else {
            this.updateStatusBar('No messages to copy');
        }
    }
    
    /**
     * Copy all messages to clipboard
     */
    copyAllMessages() {
        if (this.conversationHistory.length > 0) {
            const text = this.conversationHistory.map(msg => 
                `[${msg.timestamp}] ${msg.sender}: ${msg.message}`
            ).join('\n\n');
            
            navigator.clipboard.writeText(text)
                .then(() => this.updateStatusBar('All messages copied to clipboard'))
                .catch(err => this.updateStatusBar('Failed to copy: ' + err.message));
        } else {
            this.updateStatusBar('No messages to copy');
        }
    }
    
    /**
     * Export the chat to a file
     */
    exportChat() {
        try {
            const format = prompt('Export format (text, html, json):', 'text');
            if (!format) return;
            
            const filename = prompt('Enter a filename:', 'chat_export_' + new Date().toISOString().slice(0,19).replace(/:/g,'-'));
            if (!filename) return;
            
            let content = '';
            let mimeType = '';
            let extension = '';
            
            switch (format.toLowerCase()) {
                case 'text':
                    content = this.conversationHistory.map(msg => 
                        `[${msg.timestamp}] ${msg.sender}: ${msg.message}`
                    ).join('\n\n');
                    mimeType = 'text/plain';
                    extension = '.txt';
                    break;
                    
                case 'html':
                    content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Chat Export</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin-bottom: 20px; padding: 10px; border-radius: 5px; }
        .user-message { background-color: #f0f0f0; }
        .claude-message { background-color: #e6f7ff; }
        .timestamp { color: #666; font-size: 0.8em; }
        .sender { font-weight: bold; }
    </style>
</head>
<body>
    <h1>Chat Export</h1>
    ${this.conversationHistory.map(msg => `
    <div class="message ${msg.sender === 'You' ? 'user-message' : 'claude-message'}">
        <div class="timestamp">${msg.timestamp}</div>
        <div class="sender">${msg.sender}</div>
        <div class="content">${msg.message}</div>
    </div>
    `).join('')}
</body>
</html>`;
                    mimeType = 'text/html';
                    extension = '.html';
                    break;
                    
                case 'json':
                    content = JSON.stringify({
                        id: this.sessionId,
                        timestamp: new Date().toISOString(),
                        model: this.currentModel,
                        history: this.conversationHistory
                    }, null, 2);
                    mimeType = 'application/json';
                    extension = '.json';
                    break;
                    
                default:
                    this.updateStatusBar('Unsupported format');
                    return;
            }
            
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.download = filename + extension;
            link.href = url;
            link.click();
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.updateStatusBar(`Chat exported as ${filename}${extension}`);
        } catch (error) {
            console.error('Error exporting chat:', error);
            this.updateStatusBar('Error exporting chat: ' + error.message);
        }
    }
    
    /**
     * Show about dialog
     */
    showAboutDialog() {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="about-dialog">
                <h2>Rainer_Smart Chat Interface</h2>
                <p>Version: 1.0.0</p>
                <p>A web interface for Anthropic's Rainer_Smart AI assistant.</p>
                <p>Built with: HTML, CSS, JavaScript, and the Claude API</p>
                <p>&copy; 2025 Anthropic PBC</p>
            </div>
        `;
        
        this.showModal('About', content, [
            {
                text: 'Close',
                primary: true
            }
        ]);
    }
    
    /**
     * Show keyboard shortcuts dialog
     */
    showKeyboardShortcuts() {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="shortcuts-dialog">
                <h2>Keyboard Shortcuts</h2>
                <table class="shortcuts-table">
                    <tr>
                        <td>Enter</td>
                        <td>Send message</td>
                    </tr>
                    <tr>
                        <td>Shift + Enter</td>
                        <td>Insert line break</td>
                    </tr>
                    <tr>
                        <td>Ctrl + L</td>
                        <td>Clear chat</td>
                    </tr>
                    <tr>
                        <td>Ctrl + S</td>
                        <td>Save chat</td>
                    </tr>
                    <tr>
                        <td>Ctrl + O</td>
                        <td>Open chat</td>
                    </tr>
                    <tr>
                        <td>Ctrl + E</td>
                        <td>Export chat</td>
                    </tr>
                </table>
            </div>
        `;
        
        this.showModal('Keyboard Shortcuts', content, [
            {
                text: 'Close',
                primary: true
            }
        ]);
    }
    
    /**
     * Show documentation
     */
    showDocumentation() {
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="documentation-dialog">
                <h2>Documentation</h2>
                <h3>Getting Started</h3>
                <p>This interface allows you to chat with Rainer_Smart, Anthropic's AI assistant. Just type your message in the input box and hit Enter or click the Send button.</p>
                
                <h3>Key Features</h3>
                <ul>
                    <li><strong>System Prompt</strong>: You can set a system prompt to guide Rainer_Smart's behavior.</li>
                    <li><strong>File Attachments</strong>: Upload files to share them with Rainer_Smart.</li>
                    <li><strong>Desmos Integration</strong>: Mathematical expressions are automatically plotted.</li>
                    <li><strong>History Management</strong>: Save, load, and export your chat history.</li>
                </ul>
                
                <h3>Model Selection</h3>
                <p>You can choose between different Claude models using the dropdown selector.</p>
                
                <h3>Settings</h3>
                <p>Configure API settings, appearance, and chat options in the Settings menu.</p>
            </div>
        `;
        
        this.showModal('Documentation', content, [
            {
                text: 'Close',
                primary: true
            }
        ]);
    }
    
    /**
     * Prepare message history for API request
     * @param {number} contextWindow - The context window size
     * @returns {Array} - The prepared message history
     */
    prepareMessageHistory(contextWindow) {
        if (this.apiMessages.length === 0) {
            return [];
        }
        
        const strategy = this.config.CONTEXT_STRATEGY || 'sliding';
        
        if (strategy === 'sliding') {
            // Use the most recent N message pairs (user + assistant)
            const windowSize = contextWindow || 5;
            const windowPairs = Math.min(Math.floor(windowSize / 2), this.apiMessages.length / 2);
            return this.apiMessages.slice(-windowPairs * 2);
        } else if (strategy === 'summary') {
            // Not implemented yet - future feature
            return this.apiMessages;
        } else {
            // Default to full history up to limit
            return this.apiMessages.slice(-contextWindow * 2);
        }
    }
    
    /**
     * Add a message to the chat display
     * @param {string} sender - The sender of the message
     * @param {string} message - The message content
     * @param {boolean} isHtml - Whether the message contains HTML
     * @param {string} type - The message type (normal, error, etc.)
     */
    addMessageToChat(sender, message, isHtml = false, type = 'normal') {
        const timestamp = new Date().toLocaleTimeString();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        if (type === 'error') {
            messageContainer.classList.add('error-message');
        }
        if (type === 'warning') {
            messageContainer.classList.add('warning-message');
        }
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const messageTimestamp = document.createElement('span');
        messageTimestamp.className = 'message-timestamp';
        messageTimestamp.textContent = `[${timestamp}]`;
        messageHeader.appendChild(messageTimestamp);
        
        const messageSender = document.createElement('span');
        messageSender.className = 'message-sender';
        if (sender === 'Rainer_Smart') {
            messageSender.classList.add('claude-label');
            messageContainer.classList.add('claude-message');
        } else if (sender === 'You') {
            messageSender.classList.add('user-label');
        } else {
            messageSender.classList.add('system-label');
        }
        messageSender.textContent = `${sender}: `;
        messageHeader.appendChild(messageSender);
        
        messageContainer.appendChild(messageHeader);
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (isHtml) {
            messageContent.innerHTML = message;
            
            // Find and set up code blocks
            setTimeout(() => {
                const codeBlocks = messageContent.querySelectorAll('pre code');
                codeBlocks.forEach(block => {
                    // Add copy button for each code block if not already present
                    const parentDiv = block.closest('.code-block');
                    if (parentDiv && !parentDiv.querySelector('.code-copy-button')) {
                        const header = parentDiv.querySelector('.code-header');
                        if (header) {
                            const copyButton = document.createElement('button');
                            copyButton.className = 'code-copy-button';
                            copyButton.textContent = 'Copy';
                            copyButton.addEventListener('click', () => {
                                navigator.clipboard.writeText(block.textContent)
                                    .then(() => {
                                        copyButton.textContent = 'Copied!';
                                        setTimeout(() => {
                                            copyButton.textContent = 'Copy';
                                        }, 2000);
                                    })
                                    .catch(err => {
                                        console.error('Failed to copy code:', err);
                                    });
                            });
                            header.appendChild(copyButton);
                        }
                    }
                    
                    // Apply syntax highlighting if hljs is available
                    if (window.hljs) {
                        window.hljs.highlightElement(block);
                    }
                });
            }, 0);
        } else {
            messageContent.textContent = message;
        }
        
        messageContainer.appendChild(messageContent);
        this.chatArea.appendChild(messageContainer);
        this.chatArea.scrollTop = this.chatArea.scrollHeight;
    }
    
    /**
     * Handle file upload
     * @param {Event} event - The file input change event
     */
    async handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        try {
            const fileData = await FileHandler.readMultipleFiles(files);
            
            // Clear existing previews
            this.filePreview.innerHTML = '';
            this.filePreview.classList.remove('hidden');
            
            // Reset attachments
            this.fileAttachments = [];
            this.imageAttachments = [];
            
            // Process each file
            for (const file of fileData) {
                if (file.type === 'image') {
                    // Add image preview
                    const previewItem = document.createElement('div');
                    previewItem.className = 'file-preview-item';
                    
                    const img = document.createElement('img');
                    img.src = `data:${file.mediaType};base64,${file.data}`;
                    previewItem.appendChild(img);
                    
                    const removeButton = document.createElement('span');
                    removeButton.className = 'file-preview-remove';
                    removeButton.textContent = '×';
                    removeButton.addEventListener('click', () => {
                        this.removeAttachment(file);
                        previewItem.remove();
                        if (this.filePreview.children.length === 0) {
                            this.filePreview.classList.add('hidden');
                        }
                    });
                    
                    previewItem.appendChild(removeButton);
                    this.filePreview.appendChild(previewItem);
                    
                    // Add to image attachments
                    this.imageAttachments.push(file);
                } else {
                    // Add text file preview
                    const previewItem = document.createElement('div');
                    previewItem.className = 'file-preview-item';
                    
                    const fileIcon = document.createElement('div');
                    fileIcon.className = 'file-icon';
                    fileIcon.textContent = '📄';
                    
                    const fileName = document.createElement('div');
                    fileName.className = 'file-name';
                    fileName.textContent = file.name;
                    
                    previewItem.appendChild(fileIcon);
                    previewItem.appendChild(fileName);
                    
                    const removeButton = document.createElement('span');
                    removeButton.className = 'file-preview-remove';
                    removeButton.textContent = '×';
                    removeButton.addEventListener('click', () => {
                        this.removeAttachment(file);
                        previewItem.remove();
                        if (this.filePreview.children.length === 0) {
                            this.filePreview.classList.add('hidden');
                        }
                    });
                    
                    previewItem.appendChild(removeButton);
                    this.filePreview.appendChild(previewItem);
                    
                    // Add to file attachments
                    this.fileAttachments.push(file);
                }
            }
            
            // Reset file input
            event.target.value = '';
            
            this.updateStatusBar(`Attached ${fileData.length} file(s)`);
        } catch (error) {
            console.error('Error processing files:', error);
            this.updateStatusBar('Error processing files: ' + error.message);
        }
    }
    
    /**
     * Remove an attachment
     * @param {Object} file - The file to remove
     */
    removeAttachment(file) {
        if (file.type === 'image') {
            this.imageAttachments = this.imageAttachments.filter(img => img.name !== file.name);
        } else {
            this.fileAttachments = this.fileAttachments.filter(f => f.name !== file.name);
        }
    }
    
    /**
     * Clear all attachments
     */
    clearAttachments() {
        this.fileAttachments = [];
        this.imageAttachments = [];
        this.filePreview.innerHTML = '';
        this.filePreview.classList.add('hidden');
    }
    
    /**
     * Clear the chat
     */
    clearChat() {
        if (confirm('Are you sure you want to clear the chat?')) {
            this.chatArea.innerHTML = '';
            this.conversationHistory = [];
            this.apiMessages = [];
            this.clearAttachments();
            this.currentChatFile = null;
            
            this.updateStatusBar('Chat cleared');
            
            // Add a new session ID
            this.sessionId = this.generateSessionId();
            this.lastInteractionTime = Date.now();
            
            // Reset Desmos calculator if available
            if (this.desmosIntegration && this.desmosIntegration.calculator) {
                this.desmosIntegration.calculator.setBlank();
            }
        }
    }
    
    /**
     * Save the chat history
     */
    saveChat() {
        try {
            const filename = prompt('Enter a filename for this chat:', 'chat_' + new Date().toISOString().slice(0,19).replace(/:/g,'-'));
            if (!filename) return;
            
            const chatData = {
                id: this.sessionId,
                timestamp: new Date().toISOString(),
                model: this.currentModel,
                history: this.conversationHistory
            };
            
            ChatStorage.saveChatHistory(chatData, filename + '.json');
            
            // Add to recent chats
            ChatStorage.addRecentChat({
                id: this.sessionId,
                name: filename,
                timestamp: new Date().toISOString(),
                model: this.currentModel,
                preview: this.conversationHistory.length > 0 ? 
                    this.conversationHistory[0].message.substring(0, 50) + '...' : 
                    'Empty chat'
            });
            
            this.currentChatFile = filename;
            this.updateStatusBar(`Chat saved as ${filename}.json`);
        } catch (error) {
            console.error('Error saving chat:', error);
            this.updateStatusBar('Error saving chat: ' + error.message);
        }
    }
    
    /**
     * Load a chat history
     * @param {File} file - The chat file to load
     */
    async loadChat(file) {
        try {
            const chatData = await ChatStorage.loadChatHistory(file);
            
            // Confirm if current chat is not empty
            if (this.conversationHistory.length > 0) {
                if (!confirm('Loading a chat will replace your current conversation. Continue?')) {
                    return;
                }
            }
            
            // Clear current chat
            this.chatArea.innerHTML = '';
            this.conversationHistory = [];
            this.apiMessages = [];
            
            // Set session info
            this.sessionId = chatData.id || this.generateSessionId();
            this.currentModel = chatData.model || this.currentModel;
            this.currentChatFile = file.name.replace('.json', '');
            
            // Populate the chat
            chatData.history.forEach(msg => {
                if (msg.sender === 'You') {
                    this.addMessageToChat('You', msg.message);
                    
                    // Add to API messages
                    this.apiMessages.push({
                        role: 'user',
                        content: msg.message
                    });
                } else if (msg.sender === 'Rainer_Smart') {
                    const formattedMessage = TextFormatter.formatMessageContent(msg.message);
                    this.addMessageToChat('Rainer_Smart', formattedMessage, true);
                    
                    // Add to API messages
                    this.apiMessages.push({
                        role: 'assistant',
                        content: msg.message
                    });
                }
            });
            
            // Restore history
            this.conversationHistory = chatData.history;
            
            // Add to recent chats
            ChatStorage.addRecentChat({
                id: this.sessionId,
                name: this.currentChatFile,
                timestamp: new Date().toISOString(),
                model: this.currentModel,
                preview: this.conversationHistory.length > 0 ? 
                    this.conversationHistory[0].message.substring(0, 50) + '...' : 
                    'Empty chat'
            });
            
            this.updateStatusBar(`Chat "${this.currentChatFile}" loaded`);
        } catch (error) {
            console.error('Error loading chat:', error);
            this.updateStatusBar('Error loading chat: ' + error.message);
        }
    }
    
    /**
     * Set up autosave functionality
     */
    setupAutosave() {
        const interval = this.config.AUTOSAVE_INTERVAL || 60000; // Default to 1 minute
        
        if (this.autosaveInterval) {
            clearInterval(this.autosaveInterval);
        }
        
        this.autosaveInterval = setInterval(() => {
            if (this.conversationHistory.length > 0) {
                // Only save if there have been changes
                const lastSaveTime = localStorage.getItem('last_autosave_time');
                if (!lastSaveTime || this.lastInteractionTime > parseInt(lastSaveTime)) {
                    const filename = this.currentChatFile || 'autosave_' + this.sessionId;
                    
                    const chatData = {
                        id: this.sessionId,
                        timestamp: new Date().toISOString(),
                        model: this.currentModel,
                        history: this.conversationHistory
                    };
                    
                    // Save to localStorage instead of file
                    localStorage.setItem('autosave_chat', JSON.stringify(chatData));
                    localStorage.setItem('last_autosave_time', Date.now().toString());
                    
                    this.updateStatusBar('Chat autosaved');
                }
            }
        }, interval);
    }
    
    /**
     * Set the thinking indicator visibility
     * @param {boolean} isThinking - Whether the assistant is thinking
     */
    setThinkingIndicator(isThinking) {
        if (this.thinkingIndicator) {
            if (isThinking) {
                this.thinkingIndicator.classList.remove('hidden');
                this.thinkingIndicator.textContent = 'Rainer_Smart is thinking...';
            } else {
                this.thinkingIndicator.classList.add('hidden');
            }
        }
    }
    
    /**
     * Update the status bar text
     * @param {string} message - The status message
     */
    updateStatusBar(message) {
        if (this.statusBar) {
            this.statusBar.textContent = message;
            
            // Clear status after a few seconds
            setTimeout(() => {
                if (this.statusBar.textContent === message) {
                    this.statusBar.textContent = 'Ready';
                }
            }, 5000);
        }
    }
    
    /**
     * Show settings modal
     * @param {string} tab - The tab to show (api, theme, chat)
     */
    showSettings(tab = 'api') {
        // Create modal
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        
        const modalTitle = document.createElement('div');
        modalTitle.className = 'modal-title';
        modalTitle.textContent = 'Settings';
        
        const modalClose = document.createElement('button');
        modalClose.className = 'modal-close';
        modalClose.textContent = '×';
        modalClose.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(modalClose);
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        // API section
        const apiSection = document.createElement('div');
        apiSection.className = 'settings-section';
        apiSection.style.display = tab === 'api' ? 'block' : 'none';
        
        const apiTitle = document.createElement('div');
        apiTitle.className = 'settings-title';
        apiTitle.textContent = 'API Configuration';
        
        const apiKeyGroup = document.createElement('div');
        apiKeyGroup.className = 'settings-group';
        
        const apiKeyLabel = document.createElement('label');
        apiKeyLabel.className = 'settings-label';
        apiKeyLabel.textContent = 'API Key';
        
        const apiKeyInput = document.createElement('input');
        apiKeyInput.className = 'settings-input';
        apiKeyInput.type = 'password';
        apiKeyInput.value = this.config.API_KEY || '';
        
        apiKeyGroup.appendChild(apiKeyLabel);
        apiKeyGroup.appendChild(apiKeyInput);
        
        apiSection.appendChild(apiTitle);
        apiSection.appendChild(apiKeyGroup);
        
        // UI section
        const uiSection = document.createElement('div');
        uiSection.className = 'settings-section';
        uiSection.style.display = tab === 'theme' ? 'block' : 'none';
        
        const uiTitle = document.createElement('div');
        uiTitle.className = 'settings-title';
        uiTitle.textContent = 'UI Settings';
        
        const themeGroup = document.createElement('div');
        themeGroup.className = 'settings-group';
        
        const themeLabel = document.createElement('label');
        themeLabel.className = 'settings-label';
        themeLabel.textContent = 'Theme';
        
        const themeSelect = document.createElement('select');
        themeSelect.className = 'settings-select';
        
        // Add theme options
        const themes = ['light', 'dark', 'sepia', 'ocean', 'forest', 'lavender', 'nord', 'sunset', 'green_muted', 'cyberpunk'];
        themes.forEach(theme => {
            const option = document.createElement('option');
            option.value = theme;
            option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1).replace('_', ' ');
            if (theme === this.config.THEME) {
                option.selected = true;
            }
            themeSelect.appendChild(option);
        });
        
        themeGroup.appendChild(themeLabel);
        themeGroup.appendChild(themeSelect);
        
        const fontSizeGroup = document.createElement('div');
        fontSizeGroup.className = 'settings-group';
        
        const fontSizeLabel = document.createElement('label');
        fontSizeLabel.className = 'settings-label';
        fontSizeLabel.textContent = 'Font Size';
        
        const fontSizeInput = document.createElement('input');
        fontSizeInput.className = 'settings-input';
        fontSizeInput.type = 'number';
        fontSizeInput.min = '10';
        fontSizeInput.max = '24';
        fontSizeInput.value = this.config.FONT_SIZE || '16';
        
        fontSizeGroup.appendChild(fontSizeLabel);
        fontSizeGroup.appendChild(fontSizeInput);
        
        uiSection.appendChild(uiTitle);
        uiSection.appendChild(themeGroup);
        uiSection.appendChild(fontSizeGroup);
        
        // Chat settings section
        const chatSection = document.createElement('div');
        chatSection.className = 'settings-section';
        chatSection.style.display = tab === 'chat' ? 'block' : 'none';
        
        const chatTitle = document.createElement('div');
        chatTitle.className = 'settings-title';
        chatTitle.textContent = 'Chat Settings';
        
        const autosaveGroup = document.createElement('div');
        autosaveGroup.className = 'settings-group';
        
        const autosaveLabel = document.createElement('label');
        autosaveLabel.className = 'settings-label';
        autosaveLabel.textContent = 'Auto-save Chat';
        
        const autosaveCheckbox = document.createElement('input');
        autosaveCheckbox.type = 'checkbox';
        autosaveCheckbox.checked = this.config.AUTO_SAVE_CHAT || false;
        
        autosaveGroup.appendChild(autosaveLabel);
        autosaveGroup.appendChild(autosaveCheckbox);
        
        chatSection.appendChild(chatTitle);
        chatSection.appendChild(autosaveGroup);
        
        // Tab navigation
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'settings-tabs';
        
        const apiTab = document.createElement('div');
        apiTab.className = 'settings-tab';
        apiTab.classList.toggle('active', tab === 'api');
        apiTab.textContent = 'API';
        apiTab.addEventListener('click', () => {
            apiSection.style.display = 'block';
            uiSection.style.display = 'none';
            chatSection.style.display = 'none';
            apiTab.classList.add('active');
            uiTab.classList.remove('active');
            chatTab.classList.remove('active');
        });
        
        const uiTab = document.createElement('div');
        uiTab.className = 'settings-tab';
        uiTab.classList.toggle('active', tab === 'theme');
        uiTab.textContent = 'Appearance';
        uiTab.addEventListener('click', () => {
            apiSection.style.display = 'none';
            uiSection.style.display = 'block';
            chatSection.style.display = 'none';
            apiTab.classList.remove('active');
            uiTab.classList.add('active');
            chatTab.classList.remove('active');
        });
        
        const chatTab = document.createElement('div');
        chatTab.className = 'settings-tab';
        chatTab.classList.toggle('active', tab === 'chat');
        chatTab.textContent = 'Chat';
        chatTab.addEventListener('click', () => {
            apiSection.style.display = 'none';
            uiSection.style.display = 'none';
            chatSection.style.display = 'block';
            apiTab.classList.remove('active');
            uiTab.classList.remove('active');
            chatTab.classList.add('active');
        });
        
        tabsContainer.appendChild(apiTab);
        tabsContainer.appendChild(uiTab);
        tabsContainer.appendChild(chatTab);
        
        // Add sections to content
        modalContent.appendChild(tabsContainer);
        modalContent.appendChild(apiSection);
        modalContent.appendChild(uiSection);
        modalContent.appendChild(chatSection);
        
        // Add buttons
        const modalButtons = document.createElement('div');
        modalButtons.className = 'modal-buttons';
        
        const saveButton = document.createElement('button');
        saveButton.className = 'modal-button modal-button-primary';
        saveButton.textContent = 'Save';
        saveButton.addEventListener('click', () => {
            // Update config
            this.config.API_KEY = apiKeyInput.value;
            this.config.THEME = themeSelect.value;
            this.config.FONT_SIZE = parseInt(fontSizeInput.value);
            this.config.AUTO_SAVE_CHAT = autosaveCheckbox.checked;
            
            // Apply changes
            Config.save(this.config);
            Config.applyTheme(this.config.THEME);
            document.documentElement.style.setProperty('--base-font-size', `${this.config.FONT_SIZE}px`);
            
            // Update autosave
            if (this.config.AUTO_SAVE_CHAT) {
                this.setupAutosave();
            } else if (this.autosaveInterval) {
                clearInterval(this.autosaveInterval);
            }
            
            // Reinitialize client if API key changed
            this.initializeClient();
            
            document.body.removeChild(modalOverlay);
            this.updateStatusBar('Settings saved');
        });
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'modal-button modal-button-secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
        
        modalButtons.appendChild(cancelButton);
        modalButtons.appendChild(saveButton);
        
        // Assemble modal
        modal.appendChild(modalHeader);
        modal.appendChild(modalContent);
        modal.appendChild(modalButtons);
        
        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);
    }
    
    /**
     * Show a modal dialog
     * @param {string} title - The modal title
     * @param {HTMLElement} content - The modal content
     * @param {Array} buttons - Array of button configs
     */
    showModal(title, content, buttons = []) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        
        const modalTitle = document.createElement('div');
        modalTitle.className = 'modal-title';
        modalTitle.textContent = title;
        
        const modalClose = document.createElement('button');
        modalClose.className = 'modal-close';
        modalClose.textContent = '×';
        modalClose.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
        
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(modalClose);
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.appendChild(content);
        
        const modalButtons = document.createElement('div');
        modalButtons.className = 'modal-buttons';
        
        // Add buttons
        buttons.forEach(buttonConfig => {
            const button = document.createElement('button');
            button.className = 'modal-button';
            button.classList.add(buttonConfig.primary ? 'modal-button-primary' : 'modal-button-secondary');
            button.textContent = buttonConfig.text;
            
            button.addEventListener('click', () => {
                if (buttonConfig.callback) {
                    buttonConfig.callback();
                }
                document.body.removeChild(modalOverlay);
            });
            
            modalButtons.appendChild(button);
        });
        
        modal.appendChild(modalHeader);
        modal.appendChild(modalContent);
        modal.appendChild(modalButtons);
        
        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);
    }
}

// Create and initialize the chatbot when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ClaudeChatbot();
    
    // Add CSS for dropdown display
    const style = document.createElement('style');
    style.textContent = `
        .dropdown-menu {
            display: none;
            position: absolute;
            background-color: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-width: 180px;
        }
        
        .dropdown-menu.active {
            display: block;
        }
        
        .dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
        }
        
        .dropdown-item:hover {
            background-color: #f5f5f5;
        }
        
        .menu-item {
            cursor: pointer;
            position: relative;
            padding: 0 10px;
        }
        
        .menu-item:hover {
            background-color: rgba(0,0,0,0.05);
        }
        
        /* Fix model selector duplicates */
        #model-selector option:nth-child(n+7) {
            display: none;
        }
        
        /* Warning message styling */
        .warning-message {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
        }
    `;
    document.head.appendChild(style);
});

export { ClaudeChatbot };