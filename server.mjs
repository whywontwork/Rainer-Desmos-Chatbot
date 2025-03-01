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
import pkg from '@anthropic-ai/sdk';
const { Anthropic } = pkg;
import fs from 'fs';
import path from 'path';

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
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key']
}));

app.use(express.json({limit: '200mb', extended: true}));
app.use(express.static('.'));

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
                error: 'API key is required',
                message: 'Please provide an API key in the x-api-key header'
            });
        }
        
        console.log("Making Claude API request...");
        
        // Create Anthropic client with the provided API key
        const client = new Anthropic({
            apiKey: apiKey
        });

        // Check if the model ID is a display name or actual model ID
        const modelId = req.body.model;
        let actualModelId = modelId;
        let modelConfig = Object.values(CLAUDE_MODELS).find(m => m.id === modelId);
        
        if (!modelConfig) {
            // If not found as an ID, check if it's a display name and get the ID
            for (const [displayName, config] of Object.entries(CLAUDE_MODELS)) {
                if (displayName === modelId) {
                    actualModelId = config.id;
                    modelConfig = config;
                    console.log(`Converting display name "${modelId}" to model ID: "${actualModelId}"`);
                    break;
                }
            }
        }
        
        // Get model's max token limit
        const modelMaxTokens = modelConfig?.max_tokens || 4096;
        
        // If req.body.max_tokens is specified, use it but cap at model's limit
        let maxTokens = req.body.max_tokens || modelMaxTokens;
        
        // Ensure we don't exceed the model's maximum token limit
        if (maxTokens > modelMaxTokens) {
            console.log(`Requested max_tokens (${maxTokens}) exceeds model limit (${modelMaxTokens}), capping at model limit`);
            maxTokens = modelMaxTokens;
        }

        console.log(`Request includes ${req.body.messages.length} messages in conversation history`);
        
        // Create the message with the Anthropic API
        const message = await client.messages.create({
            model: actualModelId,
            max_tokens: maxTokens,
            messages: req.body.messages,
            system: req.body.system
        });

        console.log("Response received from Claude API");
        
        // Format the response
        res.json({
            id: message.id,
            content: message.content,
            role: message.role,
            usage: message.usage
        });
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
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`Claude Proxy Server v1.0.0`);
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Access locally via: http://localhost:${PORT}`);
    console.log(`Access from other devices via: http://<your-ip-address>:${PORT}`);
});