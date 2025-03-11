/**
 * Web Search Integration Module
 * 
 * This module provides functionality for performing web searches
 * when the AI model doesn't have the information needed.
 * 
 * @version 1.0.0
 */

class WebSearchIntegration {
    /**
     * Create a new Web Search integration instance
     * @param {Object} chatApp - Reference to the main chat application
     */
    constructor(chatApp) {
        this.chatApp = chatApp;
        
        // These patterns help identify when a search might be needed
        this.searchIndicatorPatterns = [
            /I don't have (up-to-date|current|recent|the latest) information/i,
            /I don't have information (about|on|regarding)/i,
            /I don't have access to (real-time|current|up-to-date) data/i,
            /my knowledge (is limited to|only goes up to|cuts off at)/i,
            /I don't have the ability to search/i,
            /I can't browse the internet/i,
            /As an AI assistant, I don't have access to/i,
            /I don't have real-time access/i,
            /I cannot provide information about events after/i,
            /My training data only goes up to/i,
            /I'm not able to search the web/i,
            /I cannot access current information/i,
            /I apologize, but I cannot provide/i,
            /To get the current|latest|up-to-date/i,
            /For the most recent information/i,
            /I recommend checking/i,
            /I don't know the current/i,
            /I'm not sure about the current/i,
            /I'm not able to provide current/i,
            /I can't tell you the current/i,
            /I'm unable to access/i,
            /I lack information about/i,
            /I'm not updated on/i,
            /I wasn't trained on/i
        ];
        
        // Patterns for real-time information in user queries
        this.realTimeQueryPatterns = [
            /weather in|weather for|weather at|what's the weather|how's the weather/i,
            /news about|latest news|recent news|what's happening/i,
            /stock price|stock market|how is the market|market data/i,
            /score|who won|game result|match result|live game/i,
            /current time in|time in|current time at|time zone/i,
            /traffic in|traffic at|traffic conditions/i,
            /price of|how much does|current price/i,
            /when is|opening hours|closing time/i,
            /population of|how many people|current population/i,
            /address of|where is|location of/i,
            /search for|search the web|look up|find information|google|search online/i
        ];
        
        // Last user query - will be set in handleSearchWorkflow
        this.lastUserQuery = '';
        
        // Random user agents to rotate through
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        ];
    }

    /**
     * Show search configuration dialog
     */
    showSearchSettings() {
        if (!this.chatApp) return;
        
        const content = document.createElement('div');
        
        const infoText = document.createElement('p');
        infoText.className = 'settings-info';
        infoText.innerHTML = 'Web search is integrated using direct web scraping through our proxy server. No configuration needed!';
        content.appendChild(infoText);
        
        // Search behavior options
        const behaviorLabel = document.createElement('h3');
        behaviorLabel.textContent = 'Search Behavior:';
        content.appendChild(behaviorLabel);
        
        // Automatic search checkbox
        const autoSearchContainer = document.createElement('div');
        autoSearchContainer.className = 'settings-checkbox-container';
        
        const autoSearchCheckbox = document.createElement('input');
        autoSearchCheckbox.type = 'checkbox';
        autoSearchCheckbox.id = 'auto-search-checkbox';
        autoSearchCheckbox.checked = this.getAutoSearchEnabled();
        autoSearchContainer.appendChild(autoSearchCheckbox);
        
        const autoSearchLabel = document.createElement('label');
        autoSearchLabel.textContent = 'Automatically search when Claude indicates limited knowledge';
        autoSearchLabel.htmlFor = 'auto-search-checkbox';
        autoSearchContainer.appendChild(autoSearchLabel);
        
        content.appendChild(autoSearchContainer);
        
        // Show modal
        this.chatApp.showModal('Web Search Settings', content, [
            {
                text: 'Save',
                primary: true,
                callback: () => {
                    this.saveAutoSearchSetting(autoSearchCheckbox.checked);
                    this.chatApp.updateStatusBar('Web search settings saved');
                }
            },
            {
                text: 'Cancel'
            }
        ]);
    }
    
    /**
     * Save auto-search setting
     * @param {boolean} enabled - Whether auto-search is enabled
     */
    saveAutoSearchSetting(enabled) {
        try {
            const config = JSON.parse(localStorage.getItem('claude_config')) || {};
            config.AUTO_SEARCH_ENABLED = enabled;
            localStorage.setItem('claude_config', JSON.stringify(config));
        } catch (e) {
            console.error('Error saving auto-search setting:', e);
        }
    }
    
    /**
     * Get auto-search enabled setting
     * @returns {boolean} Whether auto-search is enabled
     */
    getAutoSearchEnabled() {
        try {
            const config = JSON.parse(localStorage.getItem('claude_config')) || {};
            // Default to true if not set
            return config.AUTO_SEARCH_ENABLED !== false;
        } catch (e) {
            console.error('Error loading auto-search setting:', e);
            return true;
        }
    }

    /**
     * Generate an effective search query based on user's question
     * @param {string} query - The search query base
     * @returns {string} - Optimized search query
     */
    generateSearchQuery(query) {
        // For very short queries, don't modify them
        if (query.length <= 3) {
            return query;
        }
        
        // Remove question words and common stop words
        let searchQuery = query.replace(/^(who|what|where|when|why|how|can|do|does|is|are|will|should|could|would)\s+/i, '');
        
        // Remove question marks and other punctuation
        searchQuery = searchQuery.replace(/[?!.,;:]/g, '');
        
        // Get key terms (longer words are likely more significant)
        const words = searchQuery.split(' ');
        const keyTerms = words.filter(word => word.length > 3);
        
        // If we have enough key terms, use those, otherwise use the modified query
        if (keyTerms.length >= 3) {
            return keyTerms.join(' ');
        } else {
            return searchQuery;
        }
    }
    
    /**
     * Get a random user agent
     * @returns {string} A random user agent string
     */
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Perform a search using web search API
     * @param {string} query - The search query
     * @returns {Promise<Array>} Array of search results
     */
    async performSearch(query) {
        try {
            console.log("Performing search for:", query);
            
            // Skip extremely short queries
            if (!query || query.trim().length <= 1) {
                console.log("Query too short, skipping search:", query);
                return [
                    {
                        title: "Search query too short",
                        url: "https://example.com/error",
                        snippet: "Please provide a more specific search query.",
                        content: "The search query provided is too short or unclear. Please try again with a more specific question or topic. For best results, use complete questions or phrases that clearly describe what you're looking for."
                    }
                ];
            }
            
            // Generate search query
            const searchQuery = this.generateSearchQuery(query);
            
            // Get base URL for the proxy
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const port = isLocalhost ? ':3000' : '';
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            
            // Build complete proxy URL
            const proxyUrl = `${protocol}//${hostname}${port}/proxy/directsearch`;
            
            console.log(`Sending search request to ${proxyUrl} for query: ${searchQuery}`);
            
            try {
                // Send request through our proxy
                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: searchQuery,
                        userAgent: this.getRandomUserAgent()
                    })
                });
                
                if (!response.ok) {
                    try {
                        const errorData = await response.json();
                        throw new Error(`Search Error: ${errorData.error?.message || response.statusText}`);
                    } catch (e) {
                        throw new Error(`Search Error: ${response.status} ${response.statusText}`);
                    }
                }
                
                return await response.json();
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                
                // If fetch fails, return simulated results instead of failing completely
                console.log('Generating fallback search results for', query);
                
                // Generate simulated search results for fallback
                return [
                    {
                        title: `Information about ${query}`,
                        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
                        snippet: `This is a fallback result for "${query}" since the search server couldn't be reached.`,
                        content: `This is simulated content since the search server couldn't be reached. In a production environment, this would contain actual search results from the web. The search query was: "${query}".`
                    },
                    {
                        title: `${query} - Fallback Results`,
                        url: `https://example.org/fallback/${encodeURIComponent(query)}`,
                        snippet: `Fallback information about ${query} when the search server is unavailable.`,
                        content: `Since the search server is unavailable, this fallback content is being provided. The search query was about "${query}" and normally this would contain real search results.`
                    }
                ];
            }
        } catch (error) {
            console.error('Error performing search:', error);
            
            // Return fallback results instead of throwing
            return [
                {
                    title: `Fallback information for ${query}`,
                    url: `https://example.com/fallback?q=${encodeURIComponent(query)}`,
                    snippet: `Fallback information when search is unavailable.`,
                    content: `This is fallback content because search is currently unavailable. The original query was about "${query}".`
                }
            ];
        }
    }

    /**
     * Scrape content from a webpage
     * @param {string} url - The URL to scrape
     * @returns {Promise<string>} - The extracted content
     */
    async scrapeWebpage(url) {
        try {
            console.log("Scraping webpage:", url);
            
            // Get base URL for the proxy
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const port = isLocalhost ? ':3000' : '';
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            
            // Build complete proxy URL
            const proxyUrl = `${protocol}//${hostname}${port}/proxy/scrape`;
            
            console.log(`Sending scrape request to ${proxyUrl} for URL: ${url}`);
            
            try {
                // Send request through our proxy
                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: url,
                        userAgent: this.getRandomUserAgent()
                    })
                });
                
                if (!response.ok) {
                    try {
                        const errorData = await response.json();
                        throw new Error(`Scrape Error: ${errorData.error?.message || response.statusText}`);
                    } catch (e) {
                        throw new Error(`Scrape Error: ${response.status} ${response.statusText}`);
                    }
                }
                
                const result = await response.json();
                return result.content || "No content could be extracted from the webpage.";
            } catch (fetchError) {
                console.error('Fetch error during scraping:', fetchError);
                
                // Return a fallback message
                return `Unable to scrape content from ${url}. The server reported: ${fetchError.message}. This might be due to CORS restrictions, site blocking scrapers, or the site requiring login.`;
            }
        } catch (error) {
            console.error('Error scraping webpage:', error);
            return `Error scraping webpage: ${error.message}`;
        }
    }
    /**
     * Format search results into a readable message
     * @param {Array} results - The search results array
     * @param {string} query - The original search query
     * @returns {string} Formatted search results
     */
    formatSearchResults(results, query) {
        if (!results || !results.length || results.length === 0) {
            return `No results found for "${query}".`;
        }
        
        let formattedResults = `## Web Search Results for "${query}"\n\n`;
        
        results.forEach((result, index) => {
            formattedResults += `### ${index + 1}. ${result.title}\n`;
            formattedResults += `**URL**: ${result.url}\n`;
            if (result.snippet) {
                formattedResults += `**Snippet**: ${result.snippet}\n`;
            }
            if (result.content) {
                // Truncate content if too long
                const maxContentLength = 1000;
                const content = result.content.length > maxContentLength 
                    ? result.content.substring(0, maxContentLength) + "..." 
                    : result.content;
                formattedResults += `**Content Extract**: ${content}\n`;
            }
            formattedResults += '\n';
        });
        
        formattedResults += `Source: Web Search | Time: ${new Date().toLocaleString()}\n`;
        
        return formattedResults;
    }

    /**
     * Check if a message contains indicators that a search might be needed
     * @param {string} message - The message to check
     * @returns {boolean} True if search indicators are found
     */
    shouldTriggerSearch(message) {
        if (!message) return false;
        
        // First check if auto-search is enabled in settings
        if (!this.getAutoSearchEnabled()) {
            return false;
        }

        // Always trigger search if the user explicitly requests it
        if (this.lastUserQuery) {
            const userQueryLower = this.lastUserQuery.toLowerCase();
            
            // Skip single-character queries
            if (this.lastUserQuery.trim().length <= 1) {
                console.log('Query too short, skipping search:', this.lastUserQuery);
                return false;
            }
            
            // Skip searches if the user is commenting on previous results
            if (userQueryLower.includes("tell me more about the data") || 
                userQueryLower.includes("more details about the search") ||
                userQueryLower.includes("the search results") ||
                userQueryLower.includes("i don't want search")) {
                console.log('Comment about search results detected, skipping search:', this.lastUserQuery);
                return false;
            }
            
            // Direct search trigger if user explicitly asks to search
            if (/search for|search the web|look up|find information|google|search online/i.test(userQueryLower)) {
                console.log('Direct search request detected in user query:', this.lastUserQuery);
                return true;
            }
            
            // Very specific weather-related triggers only
            if (/weather forecast|current weather|weather in|weather at|weather today|temperature in|temperature at|temperature today/i.test(userQueryLower)) {
                console.log('Weather information request detected in user query:', this.lastUserQuery);
                return true;
            }
            
            // Very specific news/time triggers only
            if (/current news|latest news|news today|current events|happening now|current time|current date/i.test(userQueryLower)) {
                console.log('Current news/events request detected in user query:', this.lastUserQuery);
                return true;
            }
            
            // Very specific stock/finance triggers
            if (/stock price of|current price of|how much is|how much does|cost of|market cap of/i.test(userQueryLower)) {
                console.log('Finance information request detected in user query:', this.lastUserQuery);
                return true;
            }
        }
        
        // VERY IMPORTANT: Check Claude's response for clear indicators that it doesn't know
        const hasKnowledgeGap = this.searchIndicatorPatterns.some(pattern => pattern.test(message));
        if (hasKnowledgeGap) {
            // Don't trigger for every knowledge gap - be more selective
            if (message.length < 500 && (
                message.includes("I don't have real-time access") ||
                message.includes("I don't have current information") ||
                message.includes("My knowledge cuts off") ||
                message.includes("My training data only goes up to")
            )) {
                console.log('Significant knowledge gap detected in Claude response - triggering search');
                return true;
            }
        }
        
        return false;
    }

    /**
     * Extract a search query from a message
     * @param {string} message - The message to extract from
     * @returns {string|null} The extracted query or null if not found
     */
    extractSearchQuery(message) {
        if (!message) return null;
        
        // For very short queries, don't trigger search
        if (this.lastUserQuery && this.lastUserQuery.trim().length <= 1) {
            console.log("Query too short, skipping search:", this.lastUserQuery);
            return null;
        }
        
        // If user directly asks to search for something, use the whole query
        if (this.lastUserQuery && /search for|search the web|look up|find information about|google|search online/i.test(this.lastUserQuery.toLowerCase())) {
            // Remove the search instruction part
            return this.lastUserQuery.replace(/^(search for|search the web for|look up|find information about|google|search online for)\s+/i, '');
        }
        
        // If we have a real-time query from the user, use that directly
        if (this.lastUserQuery && this.realTimeQueryPatterns.some(pattern => pattern.test(this.lastUserQuery.toLowerCase()))) {
            return this.lastUserQuery;
        }
        
        // If user asked a question about weather/news directly, use the question
        if (this.lastUserQuery && (
            /weather in|weather at|weather forecast|current weather/i.test(this.lastUserQuery.toLowerCase()) ||
            /current news|latest news|news today|current events/i.test(this.lastUserQuery.toLowerCase())
        )) {
            return this.lastUserQuery;
        }
        
        // Look for phrases about not having information on something specific
        const patterns = [
            /I don't have (information|data|details) (about|on|regarding) (.*?)(\.|\,|\;|\:|\n|$)/i,
            /I don't have (up-to-date|current|recent|the latest) information (about|on|regarding) (.*?)(\.|\,|\;|\:|\n|$)/i,
            /I cannot provide (information|details) (about|on|regarding) (.*?)(\.|\,|\;|\:|\n|$)/i,
            /I don't know (about|the) (.*?)(\.|\,|\;|\:|\n|$)/i,
            /I'm not familiar with (.*?)(\.|\,|\;|\:|\n|$)/i,
            /I can't tell you (about|the) (.*?)(\.|\,|\;|\:|\n|$)/i,
            /I recommend checking (.*?) for (.*?)(\.|\,|\;|\:|\n|$)/i,
            /To get (.*?)(,|\.|$)/i
        ];
        
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                // Get the captured query and clean it
                let query = match[3] || match[2]; // Depending on which pattern matched
                query = query.trim().replace(/\.$/, '');
                return query;
            }
        }
        
        // If no structured patterns matched, look for specific content
        const lines = message.split('\n');
        for (const line of lines) {
            if (line.includes("don't have") && line.includes("information about")) {
                // Extract what comes after "information about"
                const parts = line.split("information about");
                if (parts.length > 1) {
                    let query = parts[1].trim().replace(/\.$/, '');
                    return query;
                }
            }
        }
        
        // If we have a user query but couldn't extract anything from Claude's response,
        // only use specific real-time information queries
        if (this.lastUserQuery && (
            /weather|forecast|temperature/i.test(this.lastUserQuery.toLowerCase()) || 
            /current news|latest news|news today/i.test(this.lastUserQuery.toLowerCase()) ||
            /stock price|current price/i.test(this.lastUserQuery.toLowerCase())
        )) {
            return this.lastUserQuery;
        }
        
        // No need to use last user query for everything
        return null;
    }

    /**
     * Handle the full search workflow: detect need, extract query, perform search, format results
     * @param {string} assistantMessage - The assistant's message
     * @param {string} userQuery - The original user query if available
     * @returns {Promise<Object>} Object with search results and query
     */
    async handleSearchWorkflow(assistantMessage, userQuery = '') {
        try {
            // Store the user query for potential use in extractSearchQuery
            this.lastUserQuery = userQuery;
            
            // Skip very short queries
            if (userQuery && userQuery.trim().length <= 1) {
                console.log("Query too short, skipping search:", userQuery);
                return { performed: false, reason: 'Query too short' };
            }
            
            // Skip searches if the user is commenting on previous results
            if (userQuery && (
                userQuery.toLowerCase().includes("tell me more about the data") || 
                userQuery.toLowerCase().includes("more details about the search") ||
                userQuery.toLowerCase().includes("the search results") ||
                userQuery.toLowerCase().includes("i don't want search")
            )) {
                console.log('Comment about search results detected, skipping search:', userQuery);
                return { performed: false, reason: 'Meta-search comment detected' };
            }
            
            // Check if search should be triggered
            if (!this.shouldTriggerSearch(assistantMessage)) {
                return { performed: false };
            }
            
            // Extract query
            const query = this.extractSearchQuery(assistantMessage) || userQuery;
            if (!query) {
                return { performed: false, reason: 'Could not extract search query' };
            }
            
            // Skip very short extracted queries
            if (query.trim().length <= 1) {
                console.log("Extracted query too short, skipping search:", query);
                return { performed: false, reason: 'Extracted query too short' };
            }
            
            // Perform search - will now return fallback results instead of throwing
            const searchResults = await this.performSearch(query);
            
            // Format results - whether they're real or fallback
            const formattedResults = this.formatSearchResults(searchResults, query);
            
            return {
                performed: true,
                query,
                raw: searchResults,
                formatted: formattedResults,
                isFallback: searchResults.length > 0 && searchResults[0].title.includes('Fallback')
            };
        } catch (error) {
            console.error('Search workflow error:', error);
            
            // Create fallback results even if everything fails
            const fallbackResults = [
                {
                    title: `Emergency Fallback for ${this.lastUserQuery || 'unknown query'}`,
                    url: `https://example.com/emergency?q=${encodeURIComponent(this.lastUserQuery || 'unknown')}`,
                    snippet: `Emergency fallback information.`,
                    content: `This is emergency fallback content when search completely fails. The original query was about "${this.lastUserQuery || 'unknown'}" and we were unable to perform a search due to: ${error.message}.`
                }
            ];
            
            const fallbackFormatted = this.formatSearchResults(fallbackResults, this.lastUserQuery || 'unknown query');
            
            return {
                performed: true, // Still say we performed it
                query: this.lastUserQuery || 'unknown query',
                raw: fallbackResults,
                formatted: fallbackFormatted,
                isFallback: true,
                error: error.message
            };
        }
    }
}

export { WebSearchIntegration };