# CLAUDE.md - Development Guidelines for Rainer_Smart

## Build/Run/Test Commands
- Run server: `node server.mjs` or `npm start`
- Development mode: `npm run dev` (auto-restart on changes)
- Run locally: Open `index.html` in browser and access API via http://localhost:3000
- Test API: `curl -X POST http://localhost:3000/proxy/claude -H "Content-Type: application/json" -H "x-api-key: YOUR_API_KEY" -d '{"model":"claude-3-7-sonnet-20250219", "messages":[{"role":"user","content":"Hello"}], "system":"You are Rainer_Smart"}'`
- Health check: `curl http://localhost:3000/health`

## Code Style Guidelines
- **Formatting**: ES6+ JavaScript with 4-space indentation, consistent semicolons
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Imports**: ES6 modules with named exports (`export { ClassName }`)
- **Error Handling**: Always use try/catch blocks for async operations with specific error messages
- **Classes**: Use class-based architecture with proper JSDoc comments
- **Documentation**: Document parameters with JSDoc (`@param`, `@returns`)
- **File Structure**: Modular organization (api/, config/, core/, desmos/, ui/)

## Architecture Notes
Web-based Rainer_Smart client with Express.js proxy server for Anthropic API communication. Features Desmos graphing calculator integration for mathematical visualizations. Uses local storage for config and chat history. All API requests are proxied through the local server to avoid CORS issues.

## UI Functionality
- The application has a dropdown menu structure that currently isn't functional and needs to be implemented
- Menu items (File, Edit, Settings, Help) should be clickable and show/hide their dropdown contents
- Each dropdown menu contains action items that should trigger specific operations when clicked
- Menu system should be responsive with hover effects and proper z-indexing
- Dropdown menus need proper event listeners in the core/app.js file
- Model selector contains duplicate entries that need to be cleaned up
- The "📊 Graph" button is the only functional UI element in the header currently
- When implementing dropdown functionality, use CSS classes like `.active` or `.open` to show/hide menus

## Desmos Integration
- CRITICAL: When plotting equations (e.g., "plot y=e^x"), ALWAYS plot the complete equation on the Desmos graph, not just a single point
- NEVER use ASCII art or text-based graphs - always use the integrated Desmos calculator
- When parsing LaTeX expressions, extract ONLY the mathematical content between $ symbols, not the entire text
- Current issue: when finding "$e^{x^2}$" and "$2xe^{x^2}$", system incorrectly includes all text between expressions
- For example, in "$e^{x^2}$ is $f'(x)=2xe^{x^2}$", plot only the formulas, not the "is" text between them
- The system must properly parse LaTeX notation with subscripts, superscripts, and nested braces
- The system must plot actual functions (continuous curves) rather than just individual points
- For complex equations like derivatives (e.g., y=16x·e^(4x²)), ensure proper handling of exponents and syntax
- When plotting mathematical functions like "e^x", ensure the entire curve is plotted, not just one point
- The Desmos calculator is toggled visible with the "📊 Graph" button when plotting is requested
- When a user asks to "plot the equation y=2x", parse and plot the actual equation y=2x
- Implement a "Replot" button to restore previously plotted functions that may have been cleared
- For plotting derivatives, extract ONLY the derivative function from the text and graph it explicitly
- Multiple equations should be plotted as separate graphs, not concatenated into a single malformed equation

## Known Issues to Fix
- Dropdown menus in the UI are not functional and need JavaScript event handlers
- Model name should always be Rainer_Smart instead of Claude in response headers and documentation
- LaTeX parsing is not correctly extracting equation content; it's including text between $ delimiters
- When plotting equations like "y=2e^(x*4x)", currently only a single point is plotted instead of the complete function
- Direct plot commands are not consistently detecting and plotting complete functions
- The equation parser incorrectly joins multiple LaTeX expressions with the text between them
- LaTeX parser should detect patterns like $e^{x^2}$ and extract only "e^{x^2}" for plotting
- The derivative equation parser needs to properly extract equations like "2xe^{x^2}" from text 
- The auto-plotting system should detect requests for derivatives and plot the complete derivative function
- ASCII charts are being generated instead of using the Desmos integration for some requests
- Model selector in the UI shows duplicate entries that need to be filtered

## Special Case Handling
- When a user requests "graph the equation e^x^2 and find the derivative":
  1. Plot y=e^(x^2) as the primary equation
  2. Plot y=2x*e^(x^2) as the derivative
  3. DO NOT plot the entire explanation text that appears between $ symbols
  4. Extract only the actual equations from the text, not paragraphs of explanation
  5. Never insert spaces or descriptive text into the equation itself
- For any equation plotting, truncate long strings to avoid including explanation text in the equation
- Look for specific sections in the message like "## Graph" or "## Finding the Derivative" to extract relevant equations
- The system should first check for special case equations (e^x^2, sin(x), etc.) before applying general parsing
- When multiple equations are detected, plot them as separate expressions, not combined as a single string
- Avoid sending complete content of message to Desmos; instead, extract specific mathematical expressions only