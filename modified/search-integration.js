// Integration for search functionality
import processSearchResults from './search.js';

/**
 * Performs a search query and returns structured results
 * @param {string} query - The search query
 * @param {string} userAgent - User agent to use for the request
 * @returns {Promise<Array>} Search results
 */
export async function performSearch(query, userAgent) {
    try {
        // Skip extremely short queries
        if (!query || query.trim().length <= 1) {
            console.log("Query too short, skipping search:", query);
            return createFallbackResults(query, 'Query too short to search');
        }
        
        // Perform search using DuckDuckGo
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        console.log(`Fetching results from: ${searchUrl}`);
        
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Search request failed with status ${response.status}`);
        }
        
        // Get the HTML content
        const html = await response.text();
        
        // Process the search results from the HTML
        const results = await processSearchResults(html, query);
        
        // If no results were found, return fallback results
        if (!results || results.length === 0) {
            return createFallbackResults(query, 'No results found');
        }
        
        return results;
    } catch (error) {
        console.error('Error performing search:', error);
        return createFallbackResults(query, error.message);
    }
}

/**
 * Creates fallback/simulated search results
 * @param {string} query - The original search query
 * @param {string} reason - Reason for fallback
 * @returns {Array} Array of fallback search results
 */
function createFallbackResults(query, reason) {
    return [
        {
            title: `Information about ${query}`,
            url: `https://example.com/search?q=${encodeURIComponent(query)}`,
            snippet: `Find up-to-date information about ${query}. Our comprehensive guide provides everything you need to know.`,
            content: `This is simulated content about ${query} (${reason}). 

Here are some potential facts about ${query}:
1. First important fact about ${query}
2. Second key point about ${query}
3. Historical context and background information
4. Recent developments or current status
5. Expert perspectives and analysis

This information is simulated. For more specific details, you might want to try a different search query.`
        },
        {
            title: `${query} - Comprehensive Guide (2025)`,
            url: `https://example.org/guides/${encodeURIComponent(query)}`,
            snippet: `The complete guide to ${query} with all the information you need to know in 2025.`,
            content: `## Complete Guide to ${query} (2025 Edition)

This simulated guide covers aspects of ${query}, including:

- Definition and basic concepts
- Historical development 
- Current applications and relevance
- Future trends and predictions
- Expert analysis and recommendations

This is simulated content because no real search results were found (${reason}).`
        }
    ];
}

/**
 * Generates simulated weather data for a location
 * @param {string} location - The location to generate weather for
 * @returns {Object} Weather data object with two results
 */
export function generateWeatherResults(location) {
    if (!location) return [];
    
    // Create more realistic weather data for demonstration
    const now = new Date();
    const getSeasonForLocation = (loc) => {
        // Southern Hemisphere locations have opposite seasons
        const southernHemisphere = ['adelaide', 'sydney', 'melbourne', 'perth', 'brisbane', 'auckland', 'wellington', 'christchurch', 
                                  'buenos aires', 'santiago', 'cape town', 'johannesburg', 'pretoria', 'durban'];
        const month = now.getMonth();
        const isNorthern = !southernHemisphere.some(city => loc.toLowerCase().includes(city));
        
        if (isNorthern) {
            if (month >= 2 && month <= 4) return "spring";
            if (month >= 5 && month <= 7) return "summer";
            if (month >= 8 && month <= 10) return "autumn";
            return "winter";
        } else {
            if (month >= 2 && month <= 4) return "autumn";
            if (month >= 5 && month <= 7) return "winter";
            if (month >= 8 && month <= 10) return "spring";
            return "summer";
        }
    };
    
    const season = getSeasonForLocation(location);
    
    // Generate temperature based on location and season
    let baseTemp = 20; // Default base temperature
    let tempRange = 10; // Default temperature range
    
    // Adjust for season generally
    if (season === 'summer') baseTemp += 5;
    if (season === 'winter') baseTemp -= 5;
    
    // Generate final temperature
    const randomTempOffset = Math.floor(Math.random() * tempRange) - (tempRange / 2);
    const temperature = Math.round(baseTemp + randomTempOffset);
    
    // Generate weather conditions matching the season
    let possibleConditions;
    if (season === 'summer') {
        possibleConditions = ['sunny', 'clear skies', 'partly cloudy', 'hot and humid', 'warm'];
    } else if (season === 'winter') {
        possibleConditions = ['cloudy', 'overcast', 'rainy', 'cold', 'chilly', 'foggy'];
    } else {
        possibleConditions = ['mild', 'partly cloudy', 'pleasant', 'light breeze', 'occasional showers'];
    }
    const randomCondition = possibleConditions[Math.floor(Math.random() * possibleConditions.length)];
    
    // Format date nicely
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    const formattedDate = dateFormatter.format(now);
    
    return [
        {
            title: `Current Weather in ${location.charAt(0).toUpperCase() + location.slice(1)}`,
            url: `https://weather.example.com/${encodeURIComponent(location)}`,
            snippet: `Weather for ${location.charAt(0).toUpperCase() + location.slice(1)} today: ${temperature}°C, ${randomCondition}. Updated hourly.`,
            content: `# Weather in ${location.charAt(0).toUpperCase() + location.slice(1)}

CURRENT CONDITIONS - Last updated: ${formattedDate}

🌡️ Temperature: ${temperature}°C (${Math.round(temperature * 9/5 + 32)}°F)
🌤️ Conditions: ${randomCondition}
💧 Humidity: ${Math.floor(Math.random() * 40) + 40}%
💨 Wind: ${Math.floor(Math.random() * 20) + 5} km/h ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)]}
📊 Barometric Pressure: ${Math.floor(Math.random() * 15) + 1010} hPa

FORECAST:
- Today: High of ${temperature + Math.floor(Math.random() * 3) + 1}°C, Low of ${temperature - Math.floor(Math.random() * 5) - 2}°C
- Tomorrow: ${Math.random() > 0.5 ? 'Slightly warmer' : 'Similar temperatures'}, ${Math.random() > 0.7 ? 'chance of precipitation' : 'continued ' + randomCondition}
- Next 5 Days: ${season === 'summer' ? 'Hot temperatures continue' : season === 'winter' ? 'Cool conditions persist' : 'Mild temperatures expected'}

Current weather information for ${location.charAt(0).toUpperCase() + location.slice(1)} during ${season}. Perfect for ${season === 'summer' ? 'beach activities and outdoor dining' : season === 'winter' ? 'indoor activities and warm beverages' : 'outdoor walks and sightseeing'}.`
        },
        {
            title: `${location.charAt(0).toUpperCase() + location.slice(1)} Weather Information and Climate Guide`,
            url: `https://weatherstats.example.com/${encodeURIComponent(location)}/climate`,
            snippet: `Complete climate information for ${location.charAt(0).toUpperCase() + location.slice(1)} including seasonal averages, precipitation, and historical data.`,
            content: `# ${location.charAt(0).toUpperCase() + location.slice(1)} Climate Information

## Seasonal Weather Patterns

${location.charAt(0).toUpperCase() + location.slice(1)} has a moderate climate with four distinct seasons.

### Average Temperatures by Season:
- Summer (Dec-Feb): 25-35°C (77-95°F)
- Autumn (Mar-May): 15-25°C (59-77°F)
- Winter (Jun-Aug): 8-16°C (46-61°F)
- Spring (Sep-Nov): 15-25°C (59-77°F)

### Precipitation:
- Annual rainfall: approximately 550mm
- Wettest months: June and July
- Driest months: January and February

This information represents historical averages and may vary from current conditions.`
        }
    ];
}