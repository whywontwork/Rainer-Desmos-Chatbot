# Claude Assistant with Desmos Integration

A web-based client for interacting with Anthropic's Claude AI models, featuring integrated Desmos graphing calculator functionality.

## Features

- Clean, intuitive chat interface for Claude interactions
- Integrated Desmos graphing calculator for mathematical visualizations
- Automatic equation detection and plotting
- Direct point and equation plotting commands
- File and image uploads to Claude
- Customizable themes and appearance settings
- Local chat history storage and management
- API usage tracking and optimization

## Directory Structure

The application is organized into the following modules:

- `/api` - API client and file handling
- `/config` - Configuration management and settings
- `/core` - Core application functionality
- `/desmos` - Desmos calculator integration
- `/ui` - Styling and UI components

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the proxy server:
   ```bash
   node server.mjs
   ```
4. Open `index.html` in your browser

## Usage

### Basic Chat

Type messages in the input box and press Enter or click Send to chat with Claude. The conversation will appear in the chat area above.

### Desmos Integration

- Click the "📊 Graph" button in the top menu to toggle the Desmos calculator
- Type `plot (x,y)` to plot a specific point
- Type `plot y=x^2` to plot an equation
- Claude will automatically detect equations in its responses and offer to plot them

### File Uploads

Click "Attach Files" to upload documents or images to include with your next message.

### System Prompt

Click "► System Prompt" to expand the system prompt input area, where you can provide instructions that guide Claude's behavior throughout the conversation.

## Configuration

Edit settings through the Settings menu, including:

- API Key
- Theme selection
- Font size
- Model selection

## Development

### Key Files

- `server.mjs` - Express proxy server for Claude API communication
- `index.html` - Main application HTML
- `core/app.js` - Core application logic
- `api/api.js` - API client and helpers
- `desmos/desmos-core.js` - Desmos integration
- `desmos/equation-processor.js` - Equation detection and processing
- `config/config.js` - Configuration management
- `ui/styles.css` - Styling

## License

This project is provided for educational and personal use.

## Acknowledgments

- Anthropic for Claude API
- Desmos for the graphing calculator API