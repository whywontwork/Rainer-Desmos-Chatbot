// This file contains the implementation for parsing DuckDuckGo search results
import * as cheerio from 'cheerio';

export default async function processSearchResults(html, query) {
    try {
        // Parse the HTML with Cheerio
        const $ = cheerio.load(html);
        const results = [];
        
        // Extract search results from DuckDuckGo HTML
        $('.result').each((i, element) => {
            if (i >= 5) return; // Limit to 5 results
            
            const $element = $(element);
            const $title = $element.find('.result__title');
            const $snippet = $element.find('.result__snippet');
            const $url = $element.find('.result__url');
            
            // Extract the actual URL (DuckDuckGo uses redirects)
            let url = $element.find('.result__a').attr('href') || '';
            
            // If it's a DuckDuckGo redirect URL, try to extract the actual destination
            if (url.startsWith('/')) {
                const urlMatch = $element.find('.result__url').text().trim();
                url = urlMatch ? `https://${urlMatch}` : `https://duckduckgo.com${url}`;
            }
            
            const title = $title.text().trim();
            const snippet = $snippet.text().trim();
            
            // Only add results with valid titles
            if (title) {
                results.push({
                    title: title,
                    url: url,
                    snippet: snippet || `Result for ${query}`,
                    content: `## ${title}\n\n${snippet || 'No description available'}\n\nURL: ${url}\n\nThis result was found on DuckDuckGo for the query: "${query}".`
                });
            }
        });
        
        // If no results were found, check for special knowledge panels
        if (results.length === 0) {
            // Check for DuckDuckGo instant answers
            const $instantAnswer = $('.c-base__title');
            if ($instantAnswer.length > 0) {
                const title = $instantAnswer.text().trim();
                const content = $('.c-base__content').text().trim();
                
                results.push({
                    title: title || `Information about ${query}`,
                    url: `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
                    snippet: content.substring(0, 150) + '...',
                    content: `## ${title || 'Instant Answer'}\n\n${content}\n\nThis result was found on DuckDuckGo for the query: "${query}".`
                });
            }
        }
        
        // If still no results, return an empty array
        return results;
    } catch (error) {
        console.error('Error parsing search results:', error);
        return [];
    }
}