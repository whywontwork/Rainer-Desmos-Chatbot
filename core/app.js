import { ClaudeAPI, ChatStorage, FileHandler } from '../api/api.js';




import { Config, ApiUsageTracker, CLAUDE_MODELS, THEMES } from '../config/config.js';




import { DesmosIntegration } from '../desmos/desmos-core.js';




import { EquationProcessor, DirectPlotHandler, AutoPlotHandler } from '../desmos/equation-processor.js';




import { WebSearchIntegration } from '../websearchjs.js';









// Simple text formatting function until we implement the full TextFormatter




const TextFormatter = {




    formatText: function(text) {




        if (!text) return '';




        // Simple conversion of newlines to <br> tags




        return text.replace(/\n/g, '<br>');




    }




};









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









        // Initialize Web Search Integration




        this.webSearchIntegration = new WebSearchIntegration(this);




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




        if (this.sendButton) {




            this.sendButton.addEventListener('click', () => this.sendMessage());




        }




        if (this.textInput) {




            this.textInput.addEventListener('keydown', (e) => {




                if (e.key === 'Enter' && !e.shiftKey) {




                    e.preventDefault();




                    this.sendMessage();




                }




            });




        }




        




        // Set event listeners for file handling




        if (this.fileButton) {




            this.fileButton.addEventListener('click', () => this.fileInput.click());




        }




        if (this.fileInput) {




            this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));




        }




        




        // Use event delegation for clear button to avoid duplicate listeners




        if (this.clearButton) {




            // Remove any existing listeners first




            this.clearButton.replaceWith(this.clearButton.cloneNode(true));




            // Get the fresh reference and add listener




            this.clearButton = document.getElementById('clear-button');




            if (this.clearButton) {




                this.clearButton.addEventListener('click', () => this.clearChat());




            }




        }




        




        // Set event listeners for system prompt




        if (this.systemToggle) {




            // Remove any existing listeners first




            this.systemToggle.replaceWith(this.systemToggle.cloneNode(true));




            // Get the fresh reference and add listener




            this.systemToggle = document.getElementById('system-toggle');




            if (this.systemToggle) {




                this.systemToggle.addEventListener('click', () => this.toggleSystemPrompt());




            }




        }




        




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




            Array.from(modelSelector.options || []).forEach(option => {




                if (optionValues.has(option.value)) {




                    modelSelector.removeChild(option);




                } else {




                    optionValues.add(option.value);




                }




            });




        }









        // Setup menu item click events




        if (this.menuItems) {




            this.menuItems.forEach(item => {




                if (item.nextElementSibling && item.nextElementSibling.classList.contains('dropdown-menu')) {




                    // Remove any existing listeners by cloning the element




                    const newItem = item.cloneNode(true);




                    item.parentNode.replaceChild(newItem, item);




                    




                    // Use click to toggle dropdown visibility




                    newItem.addEventListener('click', (e) => {




                        e.preventDefault();




                        e.stopPropagation();




                        // Get the dropdown again since we replaced the element




                        const dropdown = newItem.nextElementSibling;




                        if (dropdown) {




                            this.toggleDropdown(dropdown);




                        }




                    });




                    




                    // Handle clicks on dropdown items (need to get fresh references)




                    const dropdown = newItem.nextElementSibling;




                    if (dropdown) {




                        const dropdownItems = dropdown.querySelectorAll('.dropdown-item');




                        dropdownItems.forEach(dropdownItem => {




                            // Clone to remove existing listeners




                            const newDropdownItem = dropdownItem.cloneNode(true);




                            dropdownItem.parentNode.replaceChild(newDropdownItem, dropdownItem);




                            




                            newDropdownItem.addEventListener('click', (e) => {




                                e.stopPropagation();




                                this.handleMenuItemClick(newDropdownItem.id);




                                this.closeAllDropdowns();




                            });




                        });




                    }




                }




            });




        }




        




        // Close dropdowns when clicking outside




        document.addEventListener('click', (e) => {




            // Check if click is on a menu item or inside a dropdown




            let isMenuClick = false;




            




            // Check menu items




            if (this.menuItems) {




                this.menuItems.forEach(item => {




                    if (item.contains(e.target)) {




                        isMenuClick = true;




                    }




                });




            }




            




            // Check dropdown menus




            if (this.dropdownMenus) {




                this.dropdownMenus.forEach(dropdown => {




                    if (dropdown.contains(e.target)) {




                        isMenuClick = true;




                    }




                });




            }




            




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




            case 'save-chat':




                this.exportChat();




                break;




            case 'export-chat':




                this.exportChat();




                break;




                




            // Edit menu




            case 'copy-last':




            case 'copy-last-response':




                this.copyLastResponse();




                break;




            case 'copy-all':




                this.copyAllMessages();




                break;




            case 'clear-chat':




                this.clearChat();




                break;




                




            // Settings menu




            case 'api-settings':




                this.showAPISettings();




                break;




            case 'search-settings':




                this.webSearchIntegration.showSearchSettings();




                break;




            case 'theme-settings':




            case 'interface-settings':




                this.showInterfaceSettings();




                break;




            case 'chat-settings':




                this.showChatSettings();




                break;




                




            // Help menu




            case 'about':




                this.showAbout();




                break;




            case 'keyboard-shortcuts':




                this.showKeyboardShortcuts();




                break;




            case 'documentation':




                window.open('https://github.com/anthropics/claude-code');




                break;




                




            // Theme toggle




            case 'toggle-theme':




                this.toggleTheme();




                break;




                




            default:




                console.log(`No handler for menu item: ${itemId}`);




        }




    }




    




    /**




     * Copy all messages to clipboard




     */




    copyAllMessages() {




        const allText = this.conversationHistory.map(msg => 




            `[${msg.timestamp}] ${msg.sender}: ${msg.message}`




        ).join('\n\n');




        




        navigator.clipboard.writeText(allText)




            .then(() => {




                this.updateStatusBar('All messages copied to clipboard');




            })




            .catch(err => {




                console.error('Failed to copy text: ', err);




                this.updateStatusBar('Failed to copy text: ' + err.message);




            });




    }




    




    /**




     * Show chat settings




     */




    showChatSettings() {




        this.showInterfaceSettings();




    }




    




    /**




     * Toggle dropdown menu visibility




     * @param {Element} dropdown - The dropdown to toggle




     */




    toggleDropdown(dropdown) {




        // Close all other dropdowns first




        if (this.dropdownMenus) {




            this.dropdownMenus.forEach(menu => {




                if (menu !== dropdown) {




                    menu.classList.remove('show');




                }




            });




        }




        




        // Toggle the current dropdown




        dropdown.classList.toggle('show');




    }




    




    /**




     * Close all dropdown menus




     */




    closeAllDropdowns() {




        if (this.dropdownMenus) {




            this.dropdownMenus.forEach(dropdown => {




                dropdown.classList.remove('show');




            });




        }




    }




    




    /**




     * Initialize the model selector dropdown




     */




    initializeModelSelector() {




        const modelSelector = document.getElementById('model-selector');




        if (!modelSelector) return;




        




        // Clear existing options




        modelSelector.innerHTML = '';




        




        // Add supported models - convert object to array of entries




        Object.entries(CLAUDE_MODELS).forEach(([name, model]) => {




            const option = document.createElement('option');




            option.value = model.id;




            option.textContent = name;




            




            if (model.id === this.currentModel) {




                option.selected = true;




            }




            




            modelSelector.appendChild(option);




        });




        




        // Set change event




        modelSelector.addEventListener('change', () => {




            this.currentModel = modelSelector.value;




            this.updateStatusBar(`Model changed to ${this.currentModel}`);




        });




    }




    




    /**




     * Initialize the theme selector




     */




    initializeThemeSelector() {




        const themeToggle = document.getElementById('theme-toggle');




        if (!themeToggle) return;




        




        // Set initial icon based on current theme




        themeToggle.textContent = this.config.THEME === 'dark' ? '☀️' : '🌙';




        




        // Set click event




        themeToggle.addEventListener('click', () => this.toggleTheme());




    }




    




    /**




     * Toggle between light and dark themes




     */




    toggleTheme() {




        const newTheme = this.config.THEME === 'dark' ? 'light' : 'dark';




        this.config.THEME = newTheme;




        Config.save(this.config);




        Config.applyTheme(newTheme);




        




        // Update toggle icon




        const themeToggle = document.getElementById('theme-toggle');




        if (themeToggle) {




            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';




        }




        




        // Update Desmos theme if available




        if (this.desmosIntegration && typeof this.desmosIntegration.applyTheme === 'function') {




            this.desmosIntegration.applyTheme(newTheme);




        }




        




        this.updateStatusBar(`Theme changed to ${newTheme}`);




    }




    




    /**




     * Toggle the system prompt input visibility




     */




    toggleSystemPrompt() {




        this.systemExpanded = !this.systemExpanded;




        




        const systemContainer = document.getElementById('system-container');




        if (systemContainer) {




            systemContainer.classList.toggle('expanded', this.systemExpanded);




        }




        




        if (this.systemExpanded && this.systemInput) {




            this.systemInput.focus();




        }




    }




    




    /**




     * Initialize Desmos graphing calculator integration




     */




    initializeDesmosIntegration() {




        // Check if the Desmos calculator element exists




        const desmosElement = document.getElementById('desmos-calculator');




        if (!desmosElement) {




            console.warn('Desmos calculator element not found, skipping integration');




            return;




        }




        




        try {




            // Clear any existing global handlers to prevent duplicates




            if (window._autoPlotHandlerInitialized) {




                console.log('Clearing previous Desmos initialization');




                if (this.observer) {




                    this.observer.disconnect();




                    this.observer = null;




                }




            }




            




            // Initialize Desmos integration




            this.desmosIntegration = new DesmosIntegration(this);




            




            // Set up equation processor




            this.equationProcessor = new EquationProcessor(this.desmosIntegration);




            




            // Fix: Make sure desmosIntegration is set up correctly before creating handlers




            if (!this.desmosIntegration || !this.desmosIntegration.calculator) {




                throw new Error('Desmos calculator not properly initialized');




            }




            




            // Set up direct plot handler with clean event setup




            if (window._directPlotHandler) {




                delete window._directPlotHandler;




            }




            this.directPlotHandler = new DirectPlotHandler(this.desmosIntegration);




            window._directPlotHandler = this.directPlotHandler;




            




            // Set up auto plot handler (only one instance should exist)




            if (window._autoPlotHandler) {




                delete window._autoPlotHandler;




            }




            this.autoPlotHandler = new AutoPlotHandler(this.equationProcessor, this.desmosIntegration);




            window._autoPlotHandler = this.autoPlotHandler;




            




            // Make integration globally available




            window.desmosIntegration = this.desmosIntegration;




            




            this.updateStatusBar('Desmos integration initialized');




        } catch (error) {




            console.error('Failed to initialize Desmos integration:', error);




            throw error; // Re-throw to allow the constructor to catch it




        }




    }




    




    /**




     * Set up autosave functionality




     */




    setupAutosave() {




        // Clear any existing autosave interval




        if (this.autosaveInterval) {




            clearInterval(this.autosaveInterval);




        }




        




        // Set up new interval




        this.autosaveInterval = setInterval(() => {




            if (this.conversationHistory.length > 0) {




                ChatStorage.autosaveChat(this.conversationHistory);




                this.updateStatusBar('Chat autosaved');




            }




        }, this.config.AUTO_SAVE_INTERVAL * 1000);




    }




    




    /**




     * Update the status bar with a message




     * @param {string} message - The message to display




     */




    updateStatusBar(message) {




        if (!this.statusBar) return;




        




        const timestamp = new Date().toLocaleTimeString();




        this.statusBar.textContent = `[${timestamp}] ${message}`;




        




        // Clear status after a delay




        setTimeout(() => {




            if (this.statusBar.textContent.includes(message)) {




                this.statusBar.textContent = '';




            }




        }, 5000);




    }




    




    /**




     * Show a system message in the chat area




     * @param {string} text - The message text




     */




    showSystemMessage(text) {




        const timestamp = new Date().toLocaleTimeString();




        




        const messageContainer = document.createElement('div');




        messageContainer.className = 'message-container system-message';




        




        const messageHeader = document.createElement('div');




        messageHeader.className = 'message-header';




        




        const messageTimestamp = document.createElement('span');




        messageTimestamp.className = 'message-timestamp';




        messageTimestamp.textContent = `[${timestamp}]`;




        messageHeader.appendChild(messageTimestamp);




        




        const messageSender = document.createElement('span');




        messageSender.className = 'message-sender system-label';




        messageSender.textContent = 'System: ';




        messageHeader.appendChild(messageSender);




        messageContainer.appendChild(messageHeader);




        




        const messageContent = document.createElement('div');




        messageContent.className = 'message-content';




        messageContent.textContent = text;




        messageContainer.appendChild(messageContent);




        




        if (this.chatArea) {




            this.chatArea.appendChild(messageContainer);




            this.chatArea.scrollTop = this.chatArea.scrollHeight;




        }




        




        // Add to conversation history




        this.conversationHistory.push({




            timestamp,




            sender: 'System',




            message: text,




            type: 'system'




        });




    }




    




    /**




     * Show a user message in the chat area




     * @param {string} text - The message text




     */




    showUserMessage(text) {




        const timestamp = new Date().toLocaleTimeString();




        




        const messageContainer = document.createElement('div');




        messageContainer.className = 'message-container user-message';




        




        const messageHeader = document.createElement('div');




        messageHeader.className = 'message-header';




        




        const messageTimestamp = document.createElement('span');




        messageTimestamp.className = 'message-timestamp';




        messageTimestamp.textContent = `[${timestamp}]`;




        messageHeader.appendChild(messageTimestamp);




        




        const messageSender = document.createElement('span');




        messageSender.className = 'message-sender user-label';




        messageSender.textContent = 'You: ';




        messageHeader.appendChild(messageSender);




        messageContainer.appendChild(messageHeader);




        




        const messageContent = document.createElement('div');




        messageContent.className = 'message-content';




        




        // Format the message text




        const formattedText = TextFormatter.formatText(text);




        messageContent.innerHTML = formattedText;




        




        messageContainer.appendChild(messageContent);




        if (this.chatArea) {




            this.chatArea.appendChild(messageContainer);




            this.chatArea.scrollTop = this.chatArea.scrollHeight;




        }




        




        // Add to conversation history




        this.conversationHistory.push({




            timestamp,




            sender: 'You',




            message: text,




            type: 'user'




        });




    }




    




    /**




     * Show an assistant message in the chat area




     * @param {string} text - The message text




     */




    showAssistantMessage(text) {




        const timestamp = new Date().toLocaleTimeString();




        




        const messageContainer = document.createElement('div');




        messageContainer.className = 'message-container claude-message';




        




        const messageHeader = document.createElement('div');




        messageHeader.className = 'message-header';




        




        const messageTimestamp = document.createElement('span');




        messageTimestamp.className = 'message-timestamp';




        messageTimestamp.textContent = `[${timestamp}]`;




        messageHeader.appendChild(messageTimestamp);




        




        const messageSender = document.createElement('span');




        messageSender.className = 'message-sender claude-label';




        messageSender.textContent = 'Rainer_Smart: ';




        messageHeader.appendChild(messageSender);




        messageContainer.appendChild(messageHeader);




        




        const messageContent = document.createElement('div');




        messageContent.className = 'message-content';




        




        // Format the message text




        const formattedText = TextFormatter.formatText(text);




        messageContent.innerHTML = formattedText;




        




        messageContainer.appendChild(messageContent);




        if (this.chatArea) {




            this.chatArea.appendChild(messageContainer);




            this.chatArea.scrollTop = this.chatArea.scrollHeight;




        }




        




        // Add to conversation history




        this.conversationHistory.push({




            timestamp,




            sender: 'Rainer_Smart',




            message: text,




            type: 'assistant'




        });




        




        // Process for equation plotting if Desmos is enabled




        if (this.equationProcessor && this.desmosIntegration) {




            // We'll handle equations through the AutoPlotHandler now




            // The text is available in the DOM




        }




    }




    




    /**




     * Send a message to the API




     */




    async sendMessage() {




        if (!this.textInput) return;




        




        const userInput = this.textInput.value.trim();




        if (!userInput && this.fileAttachments.length === 0 && this.imageAttachments.length === 0) {




            this.updateStatusBar('Please enter a message or attach a file');




            return;




        }




        




        // Check if API key is configured




        if (!this.config.API_KEY) {




            this.showAPISettings();




            return;




        }




        




        // Show user message in chat




        if (userInput) {




            this.showUserMessage(userInput);




        } else {




            this.showUserMessage('[File(s) attached]');




        }




        




        // Show file attachments in chat if present




        if (this.fileAttachments.length > 0 || this.imageAttachments.length > 0) {




            const fileNames = [...this.fileAttachments.map(f => f.name), 




                              ...this.imageAttachments.map((_, i) => `Image ${i+1}`)];




            this.showSystemMessage(`Attached files: ${fileNames.join(', ')}`);




        }




        




        // Clear input




        this.textInput.value = '';




        




        // Clear attachments UI




        if (this.filePreview) {




            this.filePreview.innerHTML = '';




            this.filePreview.classList.add('hidden');




        }




        if (this.fileInput) {




            this.fileInput.value = '';




        }




        




        // Update last interaction time




        this.lastInteractionTime = Date.now();




        




        // Show thinking indicator




        if (this.thinkingIndicator) {




            this.thinkingIndicator.classList.add('active');




        }




        




            // Check for graph query commands first


            console.log(`User input: "${userInput}", Checking for graph queries`);


            if (userInput && userInput.toLowerCase().match(/what[']?s on the graph|show me the graph|what is on the graph|what did you plot|what equation|what function/)) {


                console.log("Graph query detected!");


                if (this.desmosIntegration) {


                    console.log("Desmos integration available, getting graph message");


                    const graphDescription = this.desmosIntegration.getCurrentGraphAsMessage();


                    console.log("Graph description:", graphDescription);


                    if (graphDescription) {


                        this.showSystemMessage(graphDescription);


                        


                        // Hide thinking indicator and return


                        if (this.thinkingIndicator) {


                            this.thinkingIndicator.classList.remove('active');


                        }


                        return;


                    }


                }


            }






        try {




            // Get system prompt if expanded




            const systemPrompt = this.systemExpanded && this.systemInput ? 




                this.systemInput.value.trim() : this.config.SYSTEM_PROMPT;




            




            // Build API messages array




            // Add current message to array




            if (userInput) {




            // Get system prompt if expanded


            const systemPrompt = this.systemExpanded && this.systemInput ? 


                this.systemInput.value.trim() : this.config.SYSTEM_PROMPT;


                


            // Check if this is a weather or real-time information query that should trigger a search


            let didDirectSearch = false;


            if (userInput && this.webSearchIntegration) {


                const userInputLower = userInput.toLowerCase();


                if (userInputLower.includes('weather') || 


                    userInputLower.includes('news') || 


                    userInputLower.includes('current') || 

                  
                    userInputLower.includes('search') ||


                    userInputLower.includes('latest') ||


                    userInputLower.includes('today')) {


                    


                    console.log("Real-time information query detected:", userInput);


                    


                    // Store that we're doing a search for this query to prevent loops


                    this.lastSearchQuery = userInput;


                    


                    // Show thinking indicator


                    if (this.thinkingIndicator) {


                        this.thinkingIndicator.classList.add('active');


                    }


                    


                    // Perform direct search


                    try {


                        const searchResults = await this.webSearchIntegration.performSearch(userInput);


                        const formattedResults = this.webSearchIntegration.formatSearchResults(searchResults, userInput);


                        


                        // Show search results first


                        this.showSystemMessage(`Web search performed for: "${userInput}"`);


                        


                        // Add user message to API messages


                        if (!this.apiMessages.some(msg => msg.role === 'user' && msg.content === userInput)) {


                            this.apiMessages.push({ role: 'user', content: userInput });


                        }


                        


                        // Add search results to API messages


                        const searchPrompt = `I need information about "${userInput}". Here are web search results:\n\n${formattedResults}\n\nPlease provide a comprehensive answer based on these search results. Feel free to use the information from the search results to give a complete answer, but be clear about which parts may be uncertain or where you need more information. IMPORTANT: At the end of your response, include a "Sources" section that lists all the web sources you used, including their titles and URLs.`;
                        this.apiMessages.push({ role: 'user', content: searchPrompt });


                        


                        didDirectSearch = true;


                    } catch (error) {


                        console.error("Error in direct search:", error);


                        didDirectSearch = false;


                    }


                }


            }





            // Build API messages array if we haven't done a direct search


            if (!didDirectSearch) {


                // Add current message to array


                if (userInput) {


                    this.apiMessages.push({ role: 'user', content: userInput });


                } else if (this.fileAttachments.length > 0 || this.imageAttachments.length > 0) {


                    this.apiMessages.push({ role: 'user', content: '[File(s) attached]' });


                }


            }


            }




            




            // Prepare request to send to proxy server




            const apiRequest = {




                model: this.currentModel,




                messages: this.apiMessages,




                system: systemPrompt,




                max_tokens: this.config.MAX_TOKENS,




                temperature: this.config.TEMPERATURE




            };




            




            // Make API request using proxy server




            const response = await this.client.createMessage(apiRequest);




            




            // Add assistant response to API messages for context




            this.apiMessages.push({ role: 'assistant', content: response.content });




            




            // Trim history if too long




            while (this.apiMessages.length > 10 * 2) {




                this.apiMessages.shift();




            }




            




            // Check if query contains a URL
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urlMatch = userInput ? userInput.match(urlRegex) : null;
            const isUrl = urlMatch && urlMatch.length > 0;
            
            if (isUrl && this.webSearchIntegration) {
                console.log("URL detected in query, will process URL content first");
                // For URL queries, process URL content first, then show response
                await this.handleWebSearch(response.content, userInput || "");
                // Now show assistant message in chat after URL processing
                this.showAssistantMessage(response.content);
            } else {
                // For non-URL queries, show assistant message first
                this.showAssistantMessage(response.content);
                
                // Then check if web search is needed based on the response
                if (this.webSearchIntegration) {
                    this.handleWebSearch(response.content, userInput || "");
                }
            }
            




            // Check for equations in the response and plot them




            if (this.desmosIntegration && this.equationProcessor && userInput && 




                userInput.toLowerCase().match(/plot|graph|derivative/)) {




                const result = this.equationProcessor.processMessageForEquations(response.content);




                if (result && result.success) {




                    // Plotting will be handled by the AutoPlotHandler




                }




            }




            




        } catch (error) {




            console.error('API request failed:', error);




            this.showSystemMessage(`Error: ${error.message}`);




        } finally {




            // Clear file attachments




            this.fileAttachments = [];




            this.imageAttachments = [];




            




            // Hide thinking indicator




            if (this.thinkingIndicator) {




                this.thinkingIndicator.classList.remove('active');




            }




        }




    }




    




    /**




     * Clear the chat history




     */




    clearChat() {




        // Ask for confirmation




        if (this.conversationHistory.length > 0 && this.config.CONFIRM_CLEAR_CHAT) {




            if (!confirm('Are you sure you want to clear the chat history?')) {




                return;




            }




        }




        




        // Clear chat area




        if (this.chatArea) {




            this.chatArea.innerHTML = '';




        }




        




        // Clear history




        this.conversationHistory = [];




        this.apiMessages = [];




        




        // Clear current chat file




        this.currentChatFile = null;




        




        // Show welcome message




        if (this.config.SHOW_WELCOME_MESSAGE) {




            this.showSystemMessage('Chat history cleared. Ready for a new conversation.');




        }




        




        this.updateStatusBar('Chat cleared');




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




            if (this.filePreview) {




                this.filePreview.innerHTML = '';




                this.filePreview.classList.remove('hidden');




            }




            




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




                    




                    const nameLabel = document.createElement('div');




                    nameLabel.className = 'file-name';




                    nameLabel.textContent = file.name;




                    previewItem.appendChild(nameLabel);




                    




                    if (this.filePreview) {




                        this.filePreview.appendChild(previewItem);




                    }




                    




                    // Add to image attachments




                    this.imageAttachments.push({




                        type: file.mediaType,




                        data: file.data




                    });




                } else {




                    // Add file preview




                    const previewItem = document.createElement('div');




                    previewItem.className = 'file-preview-item';




                    




                    const fileIcon = document.createElement('div');




                    fileIcon.className = 'file-icon';




                    fileIcon.textContent = '📄';




                    previewItem.appendChild(fileIcon);




                    




                    const nameLabel = document.createElement('div');




                    nameLabel.className = 'file-name';




                    nameLabel.textContent = file.name;




                    previewItem.appendChild(nameLabel);




                    




                    if (this.filePreview) {




                        this.filePreview.appendChild(previewItem);




                    }




                    




                    // Add to file attachments




                    this.fileAttachments.push({




                        name: file.name,




                        content: file.data




                    });




                }




            }




            




            // Add remove button




            if (this.filePreview) {




                const removeBtn = document.createElement('button');




                removeBtn.className = 'remove-attachments';




                removeBtn.textContent = 'Clear Attachments';




                removeBtn.addEventListener('click', () => {




                    if (this.filePreview) {




                        this.filePreview.innerHTML = '';




                        this.filePreview.classList.add('hidden');




                    }




                    this.fileAttachments = [];




                    this.imageAttachments = [];




                    if (this.fileInput) {




                        this.fileInput.value = '';




                    }




                });




                




                this.filePreview.appendChild(removeBtn);




            }




            




            this.updateStatusBar(`${files.length} file(s) attached`);




        } catch (error) {




            console.error('Error processing files:', error);




            this.updateStatusBar('Error processing files: ' + error.message);




        }




    }




    




    /**




     * Copy the last assistant response to clipboard




     */




    copyLastResponse() {




        // Find the last assistant message




        const assistantMessages = Array.from(document.querySelectorAll('.claude-message'));




        if (assistantMessages.length === 0) {




            this.updateStatusBar('No assistant messages to copy');




            return;




        }




        




        const lastMessage = assistantMessages[assistantMessages.length - 1];




        const messageContent = lastMessage.querySelector('.message-content');




        




        if (!messageContent) {




            this.updateStatusBar('Could not find message content');




            return;




        }




        




        // Get the text content




        const textContent = messageContent.innerText;




        




        // Copy to clipboard




        navigator.clipboard.writeText(textContent)




            .then(() => {




                this.updateStatusBar('Last response copied to clipboard');




            })




            .catch(err => {




                console.error('Failed to copy text: ', err);




                this.updateStatusBar('Failed to copy text: ' + err.message);




            });




    }




    




    /**




     * Show About dialog




     */




    showAbout() {




        const content = `




            <div class="about-dialog">




                <h2>Rainer_Smart Assistant</h2>




                <p>Version 1.0.0</p>




                <p>A web-based interface for the Claude AI model.</p>




                <p>Built with JavaScript, HTML, and CSS.</p>




                <p>&copy; ${new Date().getFullYear()} Anthropic</p>




                <p><a href="https://github.com/anthropics/claude-code" target="_blank">GitHub Repository</a></p>




                <p>Claude is a trademark of Anthropic, PBC.</p>




            </div>




        `;




        




        this.showModal('About', content, [




            {




                text: 'Close'




            }




        ]);




    }




    




    /**




     * Show keyboard shortcuts dialog




     */




    showKeyboardShortcuts() {




        const content = `




            <div class="shortcuts-dialog">




                <table>




                    <tr>




                        <th>Shortcut</th>




                        <th>Action</th>




                    </tr>




                    <tr>




                        <td><kbd>Enter</kbd></td>




                        <td>Send message</td>




                    </tr>




                    <tr>




                        <td><kbd>Shift</kbd> + <kbd>Enter</kbd></td>




                        <td>New line in message</td>




                    </tr>




                    <tr>




                        <td><kbd>Ctrl</kbd> + <kbd>L</kbd></td>




                        <td>Clear chat</td>




                    </tr>




                    <tr>




                        <td><kbd>Ctrl</kbd> + <kbd>S</kbd></td>




                        <td>Save chat</td>




                    </tr>




                    <tr>




                        <td><kbd>Ctrl</kbd> + <kbd>O</kbd></td>




                        <td>Load chat</td>




                    </tr>




                    <tr>




                        <td><kbd>Ctrl</kbd> + <kbd>C</kbd></td>




                        <td>Copy selected text</td>




                    </tr>




                    <tr>




                        <td><kbd>Esc</kbd></td>




                        <td>Close modal dialogs</td>




                    </tr>




                </table>




            </div>




        `;




        




        this.showModal('Keyboard Shortcuts', content, [




            {




                text: 'Close'




            }




        ]);




    }




    




    /**




     * Export chat history as a file




     */




    exportChat() {




        if (this.conversationHistory.length === 0) {




            this.updateStatusBar('No chat history to export');




            return;




        }




        




        const content = document.createElement('div');




        




        // Export options




        const optionsContainer = document.createElement('div');




        optionsContainer.className = 'export-options';




        




        const formatLabel = document.createElement('label');




        formatLabel.textContent = 'Export Format:';




        optionsContainer.appendChild(formatLabel);




        




        const formatSelect = document.createElement('select');




        formatSelect.className = 'settings-input';




        




        const formats = [




            { id: 'json', name: 'JSON' },




            { id: 'text', name: 'Plain Text' },




            { id: 'markdown', name: 'Markdown' },




            { id: 'html', name: 'HTML' }




        ];




        




        formats.forEach(format => {




            const option = document.createElement('option');




            option.value = format.id;




            option.textContent = format.name;




            formatSelect.appendChild(option);




        });




        




        optionsContainer.appendChild(formatSelect);




        




        // Filename input




        const filenameLabel = document.createElement('label');




        filenameLabel.textContent = 'Filename:';




        optionsContainer.appendChild(filenameLabel);




        




        const filenameInput = document.createElement('input');




        filenameInput.type = 'text';




        filenameInput.className = 'settings-input';




        filenameInput.value = `chat_export_${new Date().toISOString().split('T')[0]}`;




        optionsContainer.appendChild(filenameInput);




        




        content.appendChild(optionsContainer);




        




        // Show the modal




        this.showModal('Export Chat', content, [




            {




                text: 'Export',




                primary: true,




                callback: () => {




                    const format = formatSelect.value;




                    const filename = filenameInput.value.trim() || 'chat_export';




                    




                    switch (format) {




                        case 'json':




                            ChatStorage.saveChatHistory(this.conversationHistory, `${filename}.json`);




                            break;




                        case 'text':




                            this.exportAsText(filename);




                            break;




                        case 'markdown':




                            this.exportAsMarkdown(filename);




                            break;




                        case 'html':




                            this.exportAsHTML(filename);




                            break;




                    }




                    




                    this.updateStatusBar(`Chat exported as ${format.toUpperCase()}`);




                }




            },




            {




                text: 'Cancel'




            }




        ]);




    }




    




    /**




     * Export chat as plain text




     * @param {string} filename - The filename to use




     */




    exportAsText(filename = 'chat_export') {




        let text = '';




        




        for (const message of this.conversationHistory) {




            text += `[${message.timestamp}] ${message.sender}: ${message.message}\n\n`;




        }




        




        const blob = new Blob([text], { type: 'text/plain' });




        this.downloadFile(blob, `${filename}.txt`);




    }




    




    /**




     * Export chat as Markdown




     * @param {string} filename - The filename to use




     */




    exportAsMarkdown(filename = 'chat_export') {




        let markdown = `# Chat Export (${new Date().toLocaleString()})\n\n`;




        




        for (const message of this.conversationHistory) {




            markdown += `## ${message.sender} (${message.timestamp})\n\n`;




            markdown += `${message.message}\n\n`;




        }




        




        const blob = new Blob([markdown], { type: 'text/markdown' });




        this.downloadFile(blob, `${filename}.md`);




    }




    




    /**




     * Export chat as HTML




     * @param {string} filename - The filename to use




     */




    exportAsHTML(filename = 'chat_export') {




        let html = `<!DOCTYPE html>




<html>




<head>




    <meta charset="UTF-8">




    <title>Chat Export</title>




    <style>




        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }




        .message { margin-bottom: 20px; padding: 10px; border-radius: 5px; }




        .user { background-color: #f0f0f0; }




        .assistant { background-color: #e6f7ff; }




        .system { background-color: #f0f0ff; font-style: italic; }




        .header { font-weight: bold; margin-bottom: 5px; }




        .timestamp { color: #666; font-size: 0.8em; }




    </style>




</head>




<body>




    <h1>Chat Export (${new Date().toLocaleString()})</h1>




`;




        




        for (const message of this.conversationHistory) {




            let className = 'message';




            




            if (message.type === 'user') {




                className += ' user';




            } else if (message.type === 'assistant') {




                className += ' assistant';




            } else if (message.type === 'system') {




                className += ' system';




            }




            




            html += `




    <div class="${className}">




        <div class="header">




            <span class="sender">${message.sender}</span>




            <span class="timestamp">[${message.timestamp}]</span>




        </div>




        <div class="content">




            ${message.message.replace(/\n/g, '<br>')}




        </div>




    </div>




`;




        }




        




        html += `




</body>




</html>`;




        




        const blob = new Blob([html], { type: 'text/html' });




        this.downloadFile(blob, `${filename}.html`);




    }




    




    /**




     * Download a file to the user's device




     * @param {Blob} blob - The file content as a Blob




     * @param {string} filename - The filename




     */




    downloadFile(blob, filename) {




        const url = URL.createObjectURL(blob);




        




        const a = document.createElement('a');




        a.style.display = 'none';




        a.href = url;




        a.download = filename;




        




        document.body.appendChild(a);




        a.click();




        




        URL.revokeObjectURL(url);




        document.body.removeChild(a);




    }




    




    /**




     * Show a modal dialog




     * @param {string} title - The dialog title




     * @param {HTMLElement|string} content - The dialog content




     * @param {Array<Object>} buttons - Array of button objects with text and callback properties




     * @returns {HTMLElement} - The created dialog element




     */




    showModal(title, content, buttons = []) {




        // Create the modal container




        const modalContainer = document.createElement('div');




        modalContainer.className = 'modal-container';




        




        // Create the modal dialog




        const modalDialog = document.createElement('div');




        modalDialog.className = 'modal-dialog';




        




        // Create the title bar




        const titleBar = document.createElement('div');




        titleBar.className = 'modal-title';




        titleBar.textContent = title;




        




        // Create close button




        const closeButton = document.createElement('button');




        closeButton.className = 'modal-close';




        closeButton.textContent = '×';




        closeButton.addEventListener('click', () => {




            document.body.removeChild(modalContainer);




        });




        




        titleBar.appendChild(closeButton);




        modalDialog.appendChild(titleBar);




        




        // Create content area




        const contentArea = document.createElement('div');




        contentArea.className = 'modal-content';




        




        if (typeof content === 'string') {




            contentArea.innerHTML = content;




        } else {




            contentArea.appendChild(content);




        }




        




        modalDialog.appendChild(contentArea);




        




        // Create button area




        if (buttons.length > 0) {




            const buttonArea = document.createElement('div');




            buttonArea.className = 'modal-buttons';




            




            buttons.forEach(btn => {




                const button = document.createElement('button');




                button.textContent = btn.text;




                button.className = 'modal-button';




                




                if (btn.primary) {




                    button.classList.add('primary');




                }




                




                button.addEventListener('click', () => {




                    if (btn.callback) {




                        btn.callback();




                    }




                    document.body.removeChild(modalContainer);




                });




                




                buttonArea.appendChild(button);




            });




            




            modalDialog.appendChild(buttonArea);




        }




        




        modalContainer.appendChild(modalDialog);




        document.body.appendChild(modalContainer);




        




        // Close when clicking outside




        modalContainer.addEventListener('click', (e) => {




            if (e.target === modalContainer) {




                document.body.removeChild(modalContainer);




            }




        });




        




        return modalDialog;




    }




    




    /**




     * Show API settings dialog




     */




    showAPISettings() {




        const content = document.createElement('div');




        




        // API Key input




        const apiKeyLabel = document.createElement('label');




        apiKeyLabel.textContent = 'API Key:';




        content.appendChild(apiKeyLabel);




        




        const apiKeyInput = document.createElement('input');




        apiKeyInput.type = 'password';




        apiKeyInput.className = 'settings-input';




        apiKeyInput.value = this.config.API_KEY || '';




        apiKeyInput.placeholder = 'Enter your API key here';




        content.appendChild(apiKeyInput);




        




        // Show the modal




        this.showModal('API Settings', content, [




            {




                text: 'Save',




                primary: true,




                callback: () => {




                    // Save settings




                    this.config.API_KEY = apiKeyInput.value.trim();




                    




                    // Reinitialize the client with new API key




                    this.initializeClient();




                    




                    // Save to storage




                    Config.save(this.config);




                    




                    this.updateStatusBar('API settings saved');




                }




            },




            {




                text: 'Cancel'




            }




        ]);




    }




    




    /**




     * Show interface settings dialog




     */




    showInterfaceSettings() {




        const content = document.createElement('div');




        




        // Theme selector




        const themeLabel = document.createElement('label');




        themeLabel.textContent = 'Theme:';




        content.appendChild(themeLabel);




        




        const themeSelect = document.createElement('select');




        themeSelect.className = 'settings-input';




        




        const themes = [
            { id: 'light', name: 'Light' },
            { id: 'dark', name: 'Dark' },
            { id: 'sepia', name: 'Sepia' },
            { id: 'ocean', name: 'Ocean'},
            { id: 'forest', name: 'Forest'},
            { id: 'lavender', name: 'Lavender'},
            { id: 'nord', name: 'Nord'},
            { id: 'sunset', name: 'Sunset'},
            { id: 'green_muted', name: 'Green Muted'},
            { id: 'cyberpunk', name: 'Cyberpunk'}
        ];

        themes.forEach(theme => {




            const option = document.createElement('option');




            option.value = theme.id;




            option.textContent = theme.name;




            




            if (theme.id === this.config.THEME) {




                option.selected = true;




            }




            




            themeSelect.appendChild(option);




        });




        




        content.appendChild(themeSelect);




        




        // Show the modal




        this.showModal('Interface Settings', content, [




            {




                text: 'Save',




                primary: true,




                callback: () => {




                    // Save settings




                    this.config.THEME = themeSelect.value;




                    




                    // Apply theme




                    Config.applyTheme(this.config.THEME);




                    




                    // Update theme toggle icon




                    const themeToggle = document.getElementById('theme-toggle');




                    if (themeToggle) {




                        themeToggle.textContent = this.config.THEME === 'dark' ? '☀️' : '🌙';




                    }




                    




                    // Save to storage




                    Config.save(this.config);




                    




                    this.updateStatusBar('Interface settings saved');




                }




            },




            {




                text: 'Cancel'




            }




        ]);




    }



















    /**




     * Handle web search if needed based on assistant's response




     * @param {string} assistantMessage - The message from the assistant that might need search




     */




    async handleWebSearch(assistantMessage, userQuery = '"') {

        try {

            // Check if the user query is a URL first

            const urlRegex = /(https?:\/\/[^\s]+)/g;

            const urlMatch = userQuery ? userQuery.match(urlRegex) : null;

            const isUrl = urlMatch && urlMatch.length > 0;

            

            // Skip if we already did a search for this query, but don't skip URLs

            if (!isUrl && this.lastSearchQuery && userQuery && this.lastSearchQuery.toLowerCase() === userQuery.toLowerCase()) {

                console.log(`Skipping duplicate search for "${userQuery}"`);

                return;

            }

            

            if (urlMatch && urlMatch.length > 0) {

                const url = urlMatch[0];

                console.log(`URL detected: ${url}, attempting to scrape content`);

                

                try {

                    // Show thinking indicator

                    if (this.thinkingIndicator) {

                        this.thinkingIndicator.classList.add('active');

                    }

                    

                    // Use the webcrawler to get content from the URL

                    const pageContent = await this.webSearchIntegration.scrapeWebpage(url);

                    

                    if (pageContent) {

                        // Store that we're doing a search to prevent loops

                        this.lastSearchQuery = url;

                        

                        // Show that we accessed the webpage

                        this.showSystemMessage(`Retrieved content from URL: ${url}`);

                        

                        // Add search results to API messages

                        const urlPrompt = `I need to analyze the content of this webpage: ${url}\n\nHere is the content:\n\n${pageContent}\n\nPlease provide a comprehensive summary and analysis of this content. Focus on the main points and key information. IMPORTANT: At the end of your response, include a "Source" section with the URL you analyzed.`;
                        this.apiMessages.push({ role: 'user', content: urlPrompt });

                        

                        // Make a new request to Claude with the URL content

                        const systemPrompt = this.systemExpanded && this.systemInput ? 

                            this.systemInput.value.trim() : this.config.SYSTEM_PROMPT;

                        

                        const apiRequest = {

                            model: this.currentModel,

                            messages: this.apiMessages,

                            system: systemPrompt,

                            max_tokens: this.config.MAX_TOKENS,

                            temperature: this.config.TEMPERATURE

                        };

                        

                        // Make API request

                        const response = await this.client.createMessage(apiRequest);

                        

                        // Add assistant response to API messages

                        this.apiMessages.push({ role: 'assistant', content: response.content });

                        

                        // Show improved response in chat

                        this.showAssistantMessage(response.content);

                        

                        // Hide thinking indicator

                        if (this.thinkingIndicator) {

                            this.thinkingIndicator.classList.remove('active');

                        }

                        

                        return;

                    }

                } catch (error) {

                    console.error(`Error scraping URL ${url}:`, error);

                    this.showSystemMessage(`Error retrieving content from URL: ${error.message}`);

                    

                    // Hide thinking indicator

                    if (this.thinkingIndicator) {

                        this.thinkingIndicator.classList.remove('active');

                    }

                }

            }

            

            // Use the web search integration to decide if search is needed

            const searchResult = await this.webSearchIntegration.handleSearchWorkflow(assistantMessage, userQuery);

            

            // If search was performed and successful, send the results

            if (searchResult.performed) {

                // Show the search results to the user

                this.showSystemMessage(`Web search performed for: "${searchResult.query}"`);

                

                // Store that we're doing a search for this query to prevent loops

                this.lastSearchQuery = searchResult.query;

                

                // Send the search results as a new message to Claude

                const searchPrompt = `I previously indicated I didn't have information about "${searchResult.query}". Here are web search results to help answer the question:\n\n${searchResult.formatted}\n\nBased on these search results, please provide an updated response about ${searchResult.query}. IMPORTANT: At the end of your response, include a "Sources" section that lists all the web sources you used, including their titles and URLs.`;
                




                // Add message to API messages array




                this.apiMessages.push({ role: 'user', content: searchPrompt });




                




                // Show thinking indicator




                if (this.thinkingIndicator) {




                    this.thinkingIndicator.classList.add('active');




                }




                




                try {




                    // Make API request with search results




                    const systemPrompt = this.systemExpanded && this.systemInput ? 




                        this.systemInput.value.trim() : this.config.SYSTEM_PROMPT;




                    




                    const apiRequest = {




                        model: this.currentModel,




                        messages: this.apiMessages,




                        system: systemPrompt,




                        max_tokens: this.config.MAX_TOKENS,




                        temperature: this.config.TEMPERATURE




                    };




                    




                    // Make API request




                    const response = await this.client.createMessage(apiRequest);




                    




                    // Add assistant response to API messages




                    this.apiMessages.push({ role: 'assistant', content: response.content });
                    // Show improved response in chat
                    this.showAssistantMessage(response.content);
                } catch (error) {
                    console.error('Error getting improved response from search:', error);
                    this.showSystemMessage(`Error processing search results: ${error.message}`);
                } finally {
                    // Hide thinking indicator
                    if (this.thinkingIndicator) {
                        this.thinkingIndicator.classList.remove('active');
                    }
                }
            } else if (searchResult.shouldConfigure) {
                // Suggest configuring search
                this.showSystemMessage('Web search is not configured. Would you like to set it up now?');
                this.webSearchIntegration.showSearchSettings();
            }
        } catch (error) {
            console.error('Error in web search handling:', error);
        }
    }
}
// Export the ClaudeChatbot class
export { ClaudeChatbot };