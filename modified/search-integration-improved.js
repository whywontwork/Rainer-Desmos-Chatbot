// Enhanced search integration that actually extracts content from searched URLs
import * as cheerio from 'cheerio';

/**
 * Performs search and extracts content from top results
 * @param {string} query - The user's search query
 * @param {string} userAgent - User agent for requests
 * @returns {Promise<Object>} Object with the search results and extracted content
 */
export async function enhancedSearch(query, userAgent) {
    try {
        // Perform the initial search
        const searchResults = await performSearch(query, userAgent);
        
        // Extract content from the top 2 search results
        const enrichedResults = await extractContentFromTopResults(searchResults, userAgent);
        
        // Format the results for Claude in the requested structure
        return formatResultsForClaude(query, enrichedResults);
    } catch (error) {
        console.error('Enhanced search failed:', error);
        return createFallbackStructuredResults(query, error.message);
    }
}

/**
 * Performs a search using DuckDuckGo
 * @param {string} query - Search query
 * @param {string} userAgent - User agent
 * @returns {Promise<Array>} Array of search results
 */
async function performSearch(query, userAgent) {
    try {
        if (!query || query.trim().length <= 1) {
            throw new Error('Query too short');
        }
        
        // Search DuckDuckGo
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        console.log(`Searching DuckDuckGo: ${searchUrl}`);
        
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        
        // Parse results
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];
        
        // Extract search results from HTML
        $('.result').each((i, element) => {
            if (i >= 5) return; // Limit to 5 results
            
            const $element = $(element);
            const $title = $element.find('.result__title');
            const $snippet = $element.find('.result__snippet');
            
            // Extract URL - handle DuckDuckGo's redirect structure
            let url = '';
            const $link = $element.find('.result__a');
            if ($link.length > 0) {
                url = $link.attr('href') || '';
                
                // If it's a DuckDuckGo redirect URL, extract the actual URL
                if (url.startsWith('/')) {
                    // Try to get the actual URL from the displayed text
                    const urlText = $element.find('.result__url').text().trim();
                    if (urlText) {
                        url = urlText.startsWith('http') ? urlText : `https://${urlText}`;
                    } else {
                        url = `https://duckduckgo.com${url}`;
                    }
                }
            }
            
            const title = $title.text().trim();
            const snippet = $snippet.text().trim();
            
            if (title && url) {
                results.push({
                    title,
                    url,
                    snippet,
                    content: '' // Will be populated later
                });
            }
        });
        
        return results;
    } catch (error) {
        console.error('Search failed:', error);
        throw error;
    }
}

/**
 * Extracts actual content from the top search results
 * @param {Array} results - Search results 
 * @param {string} userAgent - User agent
 * @returns {Promise<Array>} Search results with extracted content
 */
async function extractContentFromTopResults(results, userAgent) {
    if (!results || results.length === 0) {
        return [];
    }
    
    // Only process the top 2 results
    const topResults = results.slice(0, 2);
    
    // Process URLs in parallel for efficiency
    const enrichmentPromises = topResults.map(async (result, index) => {
        try {
            // Skip URLs that may cause issues
            const skipDomains = ['youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'];
            const urlObj = new URL(result.url);
            const shouldSkip = skipDomains.some(domain => urlObj.hostname.includes(domain));
            
            if (shouldSkip) {
                console.log(`Skipping content extraction for ${result.url} (social media)`);
                return result;
            }
            
            console.log(`Extracting content from ${result.url}`);
            
            // Fetch the webpage with a timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const response = await fetch(result.url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch content: ${response.status}`);
            }
            
            // Get content type to check if it's HTML
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                throw new Error('Not an HTML page');
            }
            
            // Parse the HTML
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Remove elements that usually don't contain main content
            $('script, style, nav, header, footer, iframe, [role="banner"], [role="navigation"], .ad, .advertisement, .banner, .menu, .sidebar').remove();
            
            // Try various selectors to find the main content
            let mainContent = '';
            const contentSelectors = [
                'article',
                '[role="main"]',
                'main',
                '.main-content',
                '.content',
                '#content',
                '.post-content',
                '.article',
                '.entry-content'
            ];
            
            // Try each selector until we find good content
            for (const selector of contentSelectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    // Get all paragraph text from the main content area
                    let paragraphs = [];
                    elements.find('p').each((i, el) => {
                        const text = $(el).text().trim();
                        if (text.length > 30) { // Only include substantial paragraphs
                            paragraphs.push(text);
                        }
                    });
                    
                    if (paragraphs.length > 0) {
                        mainContent = paragraphs.join('\n\n');
                        break;
                    }
                }
            }
            
            // If still no content, just get all paragraphs from the body
            if (!mainContent) {
                let paragraphs = [];
                $('body p').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.length > 30) {
                        paragraphs.push(text);
                    }
                });
                
                mainContent = paragraphs.join('\n\n');
            }
            
            // Clean up the text - remove excess whitespace
            mainContent = mainContent.replace(/\s+/g, ' ').trim();
            
            // Limit content length
            const maxLength = 2000;
            if (mainContent.length > maxLength) {
                mainContent = mainContent.substring(0, maxLength) + '...';
            }
            
            // If we still don't have good content, use the snippet
            if (mainContent.length < 100) {
                mainContent = result.snippet;
            }
            
            // Add the extracted content to the result
            result.content = mainContent;
            result.extracted = true;
            
            return result;
        } catch (error) {
            console.error(`Failed to extract content from ${result.url}:`, error);
            // Return the original result with the error info
            return {
                ...result,
                content: result.snippet,
                extractionError: error.message
            };
        }
    });
    
    // Wait for all extractions to complete
    const enrichedResults = await Promise.all(enrichmentPromises);
    
    // Keep original results for any that failed extraction
    return results.map((result, index) => {
        if (index < enrichedResults.length) {
            return enrichedResults[index];
        }
        return result;
    });
}

/**
 * Formats search results in the structured format requested
 * @param {string} query - User's query
 * @param {Array} results - Enriched search results
 * @returns {Object} Structured results for Claude
 */
function formatResultsForClaude(query, results) {
    // Default structure in case of no results
    const structured = {
        userQuery: query,
        sources: []
    };
    
    if (!results || results.length === 0) {
        return structured;
    }
    
    // Add each result as a source
    results.forEach((result, index) => {
        structured.sources.push({
            title: result.title,
            url: result.url,
            content: result.content || result.snippet || 'No content extracted'
        });
    });
    
    return structured;
}

/**
 * Creates fallback structured results when search fails
 * @param {string} query - User's query 
 * @param {string} errorMessage - Error message
 * @returns {Object} Structured fallback results
 */
function createFallbackStructuredResults(query, errorMessage) {
    return {
        userQuery: query,
        errorMessage: errorMessage,
        sources: [
            {
                title: `Information about ${query} (Fallback)`,
                url: `https://example.com/search?q=${encodeURIComponent(query)}`,
                content: `This is fallback content because search failed: ${errorMessage}`
            }
        ]
    };
}

/**
 * Generates a prompt for Claude based on structured search results
 * @param {Object} structured - Structured search results
 * @returns {string} Prompt for Claude
 */
export function generateClaudePrompt(structured) {
    let prompt = `I need information about "${structured.userQuery}". Here are web search results:\n\n`;
    
    if (structured.errorMessage) {
        prompt += `NOTE: Search encountered an error: ${structured.errorMessage}\n\n`;
    }
    
    structured.sources.forEach((source, index) => {
        prompt += `SOURCE ${index + 1}: ${source.title}\nURL: ${source.url}\n\nCONTENT:\n${source.content}\n\n---\n\n`;
    });
    
    prompt += `\nBased on the above information, please provide a comprehensive answer about "${structured.userQuery}". Use the information from these sources, and clearly indicate when information might be uncertain or missing. End with a "SOURCES" section listing the URLs used.`;
    
    return prompt;
}