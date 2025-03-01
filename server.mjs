/**
 * Claude API Proxy Server
 * 
 * This server proxies requests to the Anthropic Claude API, handling authentication
 * and request/response formatting.
 * 
 * @version 1.0.0
 */

import express from 'express';
import cors from 'cors';
import * as sdk from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name properly in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read configuration
const configPath = './config/config.js';
let CLAUDE_MODELS = {};

try {
    // Try to extract Claude models from config file
    if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const CLAUDE_MODELS_MATCH = configContent.match(/const CLAUDE_MODELS = ({[\s\S]*?});/);
        if (CLAUDE_MODELS_MATCH) {
            CLAUDE_MODELS = eval('(' + CLAUDE_MODELS_MATCH[1] + ')');
        }
    }
} catch (error) {
    console.error('Error loading models from config:', error);
}

// Default models if not found in config
if (Object.keys(CLAUDE_MODELS).length === 0) {
    CLAUDE_MODELS = {
        "Claude 3.7 Sonnet": {
            "id": "claude-3-7-sonnet-20250219",
            "max_tokens": 20000
        },
        "Claude 3.5 Sonnet": {
            "id": "claude-3-5-sonnet-20241022",
            "max_tokens": 8192
        },
        "Claude 3 Opus": {
            "id": "claude-3-opus-20240229",
            "max_tokens": 4096
        },
        "Claude 3 Haiku": {
            "id": "claude-3-haiku-20240307",
            "max_tokens": 4096
        }
    };
}

// Create Express app
const app = express();

// Configure CORS and JSON parsing
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'anthropic-version', 'anthropic-beta'],
    exposedHeaders: ['Content-Type', 'x-api-key', 'anthropic-version', 'anthropic-beta']
}));

app.use(express.json({limit: '200mb', extended: true}));

// Serve static files with correct MIME types
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

/**
 * Claude API proxy endpoint
 * Accepts API key in x-api-key header and forwards request to Anthropic
 */
app.post('/proxy/claude', async (req, res) => {
    try {
        // Get the API key from the request header
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({
                error: {
                    type: 'api_error',
                    message: 'API key is required'
                },
                message: 'Please provide a valid API key in the x-api-key header'
            });
        }
        
        console.log("Making Claude API request...");
        
        // Create direct API fetch to Anthropic
        try {
            // Manually make the API call to Anthropic
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: req.body.model,
                    max_tokens: req.body.max_tokens || 4096,
                    messages: req.body.messages,
                    system: req.body.system
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                return res.status(response.status).json(errorData);
            }
            
            const message = await response.json();
            console.log("Response received from Claude API");
            
            // Format the response
            res.json({
                id: message.id,
                content: message.content,
                role: message.role,
                usage: message.usage
            });
        } catch (error) {
            console.error('Error making API request:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error details:', error);
        
        // Send appropriate error response
        res.status(error.status || 500).json({
            error: {
                type: error.type || 'api_error',
                message: error.message
            },
            message: error.message,
            usage: { input_tokens: 0, output_tokens: 0 }
        });
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        models: Object.keys(CLAUDE_MODELS)
    });
});

// Start the server
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Claude Proxy Server v1.0.0`);
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Access locally via: http://localhost:${PORT}`);
    console.log(`Access from other devices via: http://<your-ip-address>:${PORT}`);
});