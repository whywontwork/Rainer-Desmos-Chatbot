/**
 * Configuration Module
 * 
 * Provides configuration management for the Claude client application,
 * including default settings, theme definitions, API usage tracking,
 * and storage/retrieval of user preferences.
 * 
 * @version 1.0.0
 */

// Default configuration values
const DEFAULT_CONFIG = {
    "API_KEY": "", // API key should be provided by the user
    "MAX_TOKENS": 8192,
    "THEME": "sepia",
    "DEFAULT_MODEL": "Claude 3.7 Sonnet",
    "FONT_SIZE": 12,
    "SAVE_API_USAGE": true,
    "AUTO_SAVE_CHAT": false,
    "AUTO_SAVE_DIRECTORY": "saved_chats",
    "CONTEXT_WINDOW_SIZE": 10,
    "CONTEXT_STRATEGY": "sliding",
    "CONTEXT_SUMMARY_TOKENS": 4000,
    "CONTEXT_RETENTION": "full",
    "THINKING_ENABLED": true,
    "THINKING_MODE": "thorough",
    "THINKING_BUDGET": 16000,
    "RESPONSE_FORMAT": "markdown",
    "CODE_HIGHLIGHTING": true,
    "MATH_RENDERING": true,
    "AUTO_COMPLETE": true,
    "CHAT_HISTORY_LIMIT": 100,
    "BACKUP_ENABLED": true,
    "BACKUP_INTERVAL": 3600
};

// Available Claude models and their specifications
const CLAUDE_MODELS = {
    "Claude 3.7 Sonnet": {
        "id": "claude-3-7-sonnet-20250219",
        "rpm": 50,
        "input_tpm": 200000,
        "max_tokens": 20000,
        "CONTEXT_WINDOW_SIZE": 10,
        "thinking": {
            "enabled": true,
            "modes": {
                "quick": {"budget_tokens": 4000},
                "balanced": {"budget_tokens": 8000},
                "thorough": {"budget_tokens": 16000}
            }
        },
        "features": {
            "code_generation": true,
            "math_analysis": true,
            "image_understanding": true
        }
    },
    "Claude 3.5 Sonnet 2024-10-22": {
        "id": "claude-3-5-sonnet-20241022",
        "rpm": 50,
        "input_tpm": 8192,
        "CONTEXT_WINDOW_SIZE": 10,
        "max_tokens": 8192
    },
    "Claude 3.5 Sonnet 2024-06-20": {
        "id": "claude-3-5-sonnet-20240620",
        "rpm": 50,
        "input_tpm": 8192,
        "CONTEXT_WINDOW_SIZE": 10,
        "max_tokens": 8192
    },
    "Claude 3 Opus": {
        "id": "claude-3-opus-20240229",
        "rpm": 50,
        "input_tpm": 4096,
        "CONTEXT_WINDOW_SIZE": 10,
        "max_tokens": 4096
    },
    "Claude 3.5 Haiku": {
        "id": "claude-3-5-haiku-20241022",
        "rpm": 50,
        "input_tpm": 8192,
        "CONTEXT_WINDOW_SIZE": 10,
        "max_tokens": 8192
    },
    "Claude 3 Haiku": {
        "id": "claude-3-haiku-20240307",
        "rpm": 50,
        "input_tpm": 8192,
        "CONTEXT_WINDOW_SIZE": 10,
        "max_tokens": 4096
    }
};

// Theme definitions
const THEMES = {
    "light": {
        "bg": "#FFFFFF",
        "fg": "#000000",
        "chat_bg": "#F5F5F5",
        "input_bg": "#FFFFFF",
        "button_bg": "#E1E1E1",
        "highlight_bg": "#4A6FE3",
        "highlight_fg": "#FFFFFF"
    },
    "dark": {
        "bg": "#2D2D2D",
        "fg": "#E1E1E1",
        "chat_bg": "#383838",
        "input_bg": "#2D2D2D",
        "button_bg": "#4D4D4D",
        "highlight_bg": "#4A6FE3",
        "highlight_fg": "#FFFFFF"
    },
    "sepia": {
        "bg": "#F4ECD8",
        "fg": "#5B4636",
        "chat_bg": "#F8F4E9",
        "input_bg": "#F4ECD8",
        "button_bg": "#E6D9BE",
        "highlight_bg": "#A67D5D",
        "highlight_fg": "#FFFFFF"
    },    
    "ocean": {
        "bg": "#0F2027",
        "fg": "#E0E0E0",
        "chat_bg": "#203A43",
        "input_bg": "#0F2027",
        "button_bg": "#2C5364",
        "highlight_bg": "#4ECDC4",
        "highlight_fg": "#000000"
    },
    "forest": {
        "bg": "#1D3B1E",
        "fg": "#E0F0E0",
        "chat_bg": "#2A5529",
        "input_bg": "#1D3B1E",
        "button_bg": "#3C6E3C",
        "highlight_bg": "#7BC950",
        "highlight_fg": "#FFFFFF"
    },
    "lavender": {
        "bg": "#F5EBFF",
        "fg": "#4A4A4A",
        "chat_bg": "#EDE7F6",
        "input_bg": "#F5EBFF",
        "button_bg": "#D1C4E9",
        "highlight_bg": "#7C4DFF",
        "highlight_fg": "#FFFFFF"
    },
    "nord": {
        "bg": "#2E3440",
        "fg": "#D8DEE9",
        "chat_bg": "#3B4252",
        "input_bg": "#2E3440",
        "button_bg": "#434C5E",
        "highlight_bg": "#88C0D0",
        "highlight_fg": "#000000"
    },
    "sunset": {
        "bg": "#3C1053",
        "fg": "#E6E6FA",
        "chat_bg": "#4A1E69",
        "input_bg": "#3C1053",
        "button_bg": "#5D3FD3",
        "highlight_bg": "#FF6B6B",
        "highlight_fg": "#FFFFFF"
    },
    "green_muted": {
        "bg": "#1A2421",
        "fg": "#8FBC8F",
        "chat_bg": "#2F4F4F",
        "input_bg": "#1A2421",
        "button_bg": "#3C6464",
        "highlight_bg": "#5D9B9B",
        "highlight_fg": "#FFFFFF"
    },
    "cyberpunk": {
        "bg": "#000B0E",
        "fg": "#0FF",
        "chat_bg": "#001F3F",
        "input_bg": "#000B0E",
        "button_bg": "#003366",
        "highlight_bg": "#00FFFF",
        "highlight_fg": "#000000"
    }
};

/**
 * Configuration management class
 */
class Config {
    /**
     * Load configuration from localStorage
     * @returns {Object} The loaded config
     */
    static load() {
        try {
            const savedConfig = localStorage.getItem('claude_config');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                // Update with any new default keys
                for (const key in DEFAULT_CONFIG) {
                    if (config[key] === undefined) {
                        config[key] = DEFAULT_CONFIG[key];
                    }
                }
                return config;
            }
            return { ...DEFAULT_CONFIG };
        } catch (e) {
            console.error('Error loading config:', e);
            return { ...DEFAULT_CONFIG };
        }
    }

    /**
     * Save configuration to localStorage
     * @param {Object} config - The configuration to save
     */
    static save(config) {
        try {
            localStorage.setItem('claude_config', JSON.stringify(config));
        } catch (e) {
            console.error('Error saving config:', e);
        }
    }
    
    /**
     * Get the specified theme
     * @param {string} themeName - The name of the theme to get
     * @returns {Object} The theme object
     */
    static getTheme(themeName) {
        return THEMES[themeName] || THEMES.light;
    }
    
    /**
     * Apply the current theme to the application
     * @param {string} themeName - The name of the theme to apply
     */
    static applyTheme(themeName) {
        const theme = this.getTheme(themeName);
        const root = document.documentElement;
        
        root.style.setProperty('--bg-color', theme.bg);
        root.style.setProperty('--text-color', theme.fg);
        root.style.setProperty('--chat-bg-color', theme.chat_bg);
        root.style.setProperty('--input-bg-color', theme.input_bg);
        root.style.setProperty('--button-bg-color', theme.button_bg);
        root.style.setProperty('--highlight-bg-color', theme.highlight_bg);
        root.style.setProperty('--highlight-text-color', theme.highlight_fg);
    }
    
    /**
     * Get the model configuration for the specified model
     * @param {string} modelName - The name of the model
     * @returns {Object} The model configuration
     */
    static getModelConfig(modelName) {
        return CLAUDE_MODELS[modelName] || CLAUDE_MODELS["Claude 3.7 Sonnet"];
    }
}

/**
 * API usage tracking class
 */
class ApiUsageTracker {
    /**
     * Create a new API usage tracker
     */
    constructor() {
        this.usage_data = this.loadUsageData();
    }

    /**
     * Load API usage data from localStorage
     * @returns {Object} The usage data
     */
    loadUsageData() {
        try {
            const savedData = localStorage.getItem('api_usage');
            return savedData ? JSON.parse(savedData) : { "usage": [] };
        } catch (e) {
            console.error('Error loading API usage data:', e);
            return { "usage": [] };
        }
    }

    /**
     * Save API usage data to localStorage
     */
    saveUsageData() {
        try {
            localStorage.setItem('api_usage', JSON.stringify(this.usage_data));
        } catch (e) {
            console.error('Error saving API usage data:', e);
        }
    }

    /**
     * Record a new API usage entry
     * @param {string} model_id - The model ID
     * @param {number} input_tokens - The number of input tokens
     * @param {number} output_tokens - The number of output tokens
     */
    recordUsage(model_id, input_tokens, output_tokens) {
        const entry = {
            "timestamp": new Date().toISOString(),
            "model": model_id,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        };
        this.usage_data.usage.push(entry);
        this.saveUsageData();
    }
    
    /**
     * Get the total usage for the current month
     * @returns {Object} The total usage
     */
    getCurrentMonthUsage() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthlyUsage = this.usage_data.usage.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
        });
        
        return monthlyUsage.reduce((total, entry) => {
            total.input_tokens += entry.input_tokens;
            total.output_tokens += entry.output_tokens;
            return total;
        }, { input_tokens: 0, output_tokens: 0 });
    }
}

// Export the classes and constants
export { Config, ApiUsageTracker, DEFAULT_CONFIG, CLAUDE_MODELS, THEMES };