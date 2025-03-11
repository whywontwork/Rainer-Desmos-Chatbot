/**
 * This code updates the core/app.js file to use the enhanced search functionality
 * 
 * It needs to be added to the sendMessage method to properly structure search results
 * for Claude in the format requested by the user.
 */

// Add this code to the sendMessage method in the ClaudeChatbot class

/**
 * Handle web search with the new structured approach
 * @param {string} assistantMessage - Claude's response message
 * @param {string} userQuery - The original user query
 */
async handleWebSearch(assistantMessage, userQuery = '') {
    try {
        if (!this.webSearchIntegration) return;
        
        // Check for URL in the query 
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlMatch = userQuery ? userQuery.match(urlRegex) : null;
        const isUrl = urlMatch && urlMatch.length > 0;
        
        // For URLs or search queries, we should handle the search workflow differently
        const searchResults = await this.webSearchIntegration.handleSearchWorkflow(assistantMessage, userQuery);
        
        // If search wasn't performed, there's nothing more to do
        if (!searchResults.performed) {
            return;
        }
        
        // Show that search was performed
        this.showSystemMessage(`Web search performed for: "${searchResults.query}"`);
        
        // If we have a structured result and a prompt, use it to get an improved response
        if (searchResults.structured && searchResults.prompt) {
            // Get system prompt if expanded
            const systemPrompt = this.systemExpanded && this.systemInput ? 
                this.systemInput.value.trim() : this.config.SYSTEM_PROMPT;
            
            // Show thinking indicator
            if (this.thinkingIndicator) {
                this.thinkingIndicator.classList.add('active');
            }
            
            try {
                // Add the structured search results as a user message
                this.apiMessages.push({ role: 'user', content: searchResults.prompt });
                
                // Make API request with search results
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
        }
    } catch (error) {
        console.error('Error in web search handling:', error);
    }
}

// Inside sendMessage method, update the web search section to use the new approach

/**
 * Updated search integration code to add to sendMessage method
 */

// Check if this is a weather or real-time information query that should trigger a search
let didDirectSearch = false;

if (userInput && this.webSearchIntegration) {
    const userInputLower = userInput.toLowerCase();
    
    // Check for patterns that suggest real-time information needs
    if (userInputLower.includes('weather') || 
        userInputLower.includes('news') || 
        userInputLower.includes('current') || 
        userInputLower.includes('search') ||
        userInputLower.includes('latest') ||
        userInputLower.includes('today') ||
        /(https?:\/\/[^\s]+)/g.test(userInputLower)) {
        
        console.log("Real-time information query detected:", userInput);
        
        // Store that we're doing a search for this query to prevent loops
        this.lastSearchQuery = userInput;
        
        // Show thinking indicator
        if (this.thinkingIndicator) {
            this.thinkingIndicator.classList.add('active');
        }
        
        // Perform direct search with structured results
        try {
            // Handle the search workfow
            const searchResults = await this.webSearchIntegration.handleSearchWorkflow('', userInput);
            
            if (searchResults.performed) {
                // Show that search was performed
                this.showSystemMessage(`Web search performed for: "${searchResults.query}"`);
                
                // Add user message to API messages
                if (!this.apiMessages.some(msg => msg.role === 'user' && msg.content === userInput)) {
                    this.apiMessages.push({ role: 'user', content: userInput });
                }
                
                // Add search results to API messages with the structured format
                this.apiMessages.push({ role: 'user', content: searchResults.prompt });
                
                didDirectSearch = true;
            }
        } catch (error) {
            console.error("Error in direct search:", error);
            didDirectSearch = false;
        }
    }
}