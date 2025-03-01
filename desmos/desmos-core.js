/**
 * Desmos Integration Module
 * 
 * Provides functionality for integrating the Desmos graphing calculator with Rainer_Smart Assistant.
 * This module handles the core calculator functionality including initialization,
 * showing/hiding, saving/loading graphs, and equation processing.
 * 
 * @version 1.0.0
 */

class DesmosIntegration {
    /**
     * Create a new Desmos integration instance
     * @param {Object} chatbot - The chatbot instance for communication
     */
    constructor(chatbot) {
        this.chatbot = chatbot;
        this.calculator = null;
        this.isActive = false;
        this.graphHistory = [];
        this.currentGraphId = null;
        this.currentTheme = 'light';
        
        // DOM elements
        this.container = document.getElementById('calculator-container');
        this.calculatorEl = document.getElementById('desmos-calculator');
        this.toggleBtn = document.getElementById('toggle-calculator');
        this.graphBtn = document.getElementById('toggle-graph-btn');
        this.saveGraphBtn = document.getElementById('save-graph-btn');
        this.loadGraphBtn = document.getElementById('load-graph-btn');
        this.shareGraphBtn = document.getElementById('share-graph-btn');
        this.clearGraphBtn = document.getElementById('clear-graph-btn');
        
        this.initialize();
    }
    
    /**
     * Initialize the Desmos calculator and set up event handlers
     */
    initialize() {
        // Initialize the calculator with enhanced options
        this.calculator = Desmos.GraphingCalculator(this.calculatorEl, {
            keypad: true,
            expressions: true,
            settingsMenu: true,
            zoomButtons: true,
            lockViewport: false,        // Allow resizing
            fontSize: 16,               // Default font size
            administerSecretFolders: true, // Enable folders
            expressionsCollapsed: false,
            border: false
        });
        
        // Make calculator globally accessible
        window.calculator = this.calculator;
        
        // Initialize theme support
        this.currentTheme = localStorage.getItem('desmosTheme') || 'light';
        this.applyTheme(this.currentTheme);
        
        // Set up basic event handlers
        this.toggleBtn.addEventListener('click', () => this.toggleCalculator());
        this.graphBtn.addEventListener('click', () => this.toggleCalculator());
        this.saveGraphBtn.addEventListener('click', () => this.saveGraph());
        this.loadGraphBtn.addEventListener('click', () => this.loadGraph());
        this.shareGraphBtn.addEventListener('click', () => this.shareGraph());
        this.clearGraphBtn.addEventListener('click', () => this.clearGraph());
        
        // Create export button if it doesn't exist
        this.exportGraphBtn = document.getElementById("export-graph-btn");
        if (!this.exportGraphBtn) {
            this.exportGraphBtn = document.createElement('button');
            this.exportGraphBtn.id = 'export-graph-btn';
            this.exportGraphBtn.className = 'calculator-button';
            this.exportGraphBtn.innerHTML = '💾 Export';
            
            // Add it next to other buttons
            const btnContainer = this.clearGraphBtn?.parentElement;
            if (btnContainer) {
                btnContainer.appendChild(this.exportGraphBtn);
            }
        }
        this.exportGraphBtn.addEventListener("click", () => this.exportGraph());
        
        // Create theme toggle button
        this.themeBtn = document.getElementById("theme-toggle-btn");
        if (!this.themeBtn) {
            this.themeBtn = document.createElement('button');
            this.themeBtn.id = 'theme-toggle-btn';
            this.themeBtn.className = 'calculator-button';
            this.themeBtn.innerHTML = this.currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
            
            // Add it next to other buttons
            const btnContainer = this.clearGraphBtn?.parentElement;
            if (btnContainer) {
                btnContainer.appendChild(this.themeBtn);
            }
        }
        this.themeBtn.addEventListener("click", () => this.toggleTheme());
        
        // Add event listener for calculator changes to track history
        this.calculator.observeEvent('change', () => {
            this.saveGraphState();
        });
        
        // Make sure the calculator is resized properly when shown
        this.container.addEventListener('transitionend', () => {
            if (this.isActive) {
                this.calculator.resize();
            }
        });
        
        // Add global toggle function
        window.toggleCalculator = () => this.toggleCalculator();
        window.showCalculator = () => {
            if (!this.isActive) {
                this.toggleCalculator();
            }
            return true;
        };
    }
    
    /**
     * Apply theme to the calculator
     * @param {string} theme - 'light' or 'dark'
     */
    applyTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('desmosTheme', theme);
        
        if (theme === 'dark') {
            // Apply dark theme
            this.calculator.updateSettings({
                backgroundColor: '#1e1e1e',
                textColor: '#f0f0f0',
                gridColor: '#333333',
                expressionsTopbarColor: '#2d2d2d'
            });
            
            // Update button text
            if (this.themeBtn) {
                this.themeBtn.innerHTML = '☀️ Light';
            }
            
            // Also update the container
            if (this.container) {
                this.container.classList.add('dark-theme');
                this.container.classList.remove('light-theme');
            }
        } else {
            // Apply light theme (default)
            this.calculator.updateSettings({
                backgroundColor: '#ffffff',
                textColor: '#000000',
                gridColor: '#d8d8d8',
                expressionsTopbarColor: '#f7f7f7'
            });
            
            // Update button text
            if (this.themeBtn) {
                this.themeBtn.innerHTML = '🌙 Dark';
            }
            
            // Also update the container
            if (this.container) {
                this.container.classList.add('light-theme');
                this.container.classList.remove('dark-theme');
            }
        }
    }
    
    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        this.chatbot?.updateStatusBar(`Calculator theme changed to ${newTheme}`);
    }
    
    /**
     * Toggle the calculator visibility
     */
    toggleCalculator() {
        this.isActive = !this.isActive;
        
        if (this.isActive) {
            this.container.classList.add('active');
            this.graphBtn.classList.add('active');
            this.toggleBtn.textContent = '➡️';
            setTimeout(() => this.calculator.resize(), 300); // Resize after transition
        } else {
            this.container.classList.remove('active');
            this.graphBtn.classList.remove('active');
            this.toggleBtn.textContent = '⬅️';
        }
        
        if (this.chatbot && typeof this.chatbot.updateStatusBar === 'function') {
            this.chatbot.updateStatusBar(this.isActive ? 'Graph calculator opened' : 'Graph calculator closed');
        }
        
        return this.isActive;
    }
    
    /**
     * Save the current graph state to history
     */
    saveGraphState() {
        const state = this.calculator.getState();
        this.currentGraphState = state;
    }
    
    /**
     * Save the current graph with a name
     */
    saveGraph() {
        const state = this.calculator.getState();
        
        // Show dialog to name the graph
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Enter a name for this graph:</p>
            <input type="text" id="graph-name-input" class="settings-input" value="Graph ${this.graphHistory.length + 1}">
            <p>Graph Data (for export):</p>
            <textarea class="graph-dialog-textarea" readonly>${JSON.stringify(state)}</textarea>
        `;
        
        this.chatbot.showModal('Save Graph', content, [
            {
                text: 'Save',
                callback: () => {
                    const name = document.getElementById('graph-name-input').value.trim() || `Graph ${this.graphHistory.length + 1}`;
                    const timestamp = new Date().toLocaleTimeString();
                    
                    // Save to history
                    const graphData = {
                        id: Date.now(),
                        name: name,
                        timestamp: timestamp,
                        state: state
                    };
                    
                    this.graphHistory.push(graphData);
                    this.currentGraphId = graphData.id;
                    
                    // Save to local storage
                    this.saveGraphToStorage(graphData);
                    
                    this.chatbot.updateStatusBar(`Graph "${name}" saved`);
                    
                    // Add to chat as a reference
                    this.addGraphReferenceToChat(graphData);
                }
            },
            {
                text: 'Cancel'
            }
        ]);
    }
    
    /**
     * Save graph to local storage
     */
    saveGraphToStorage(graphData) {
        try {
            // Get existing saved graphs
            const savedGraphs = JSON.parse(localStorage.getItem('desmos_graphs') || '[]');
            
            // Add new graph
            savedGraphs.push(graphData);
            
            // Limit to last 20 graphs to save space
            if (savedGraphs.length > 20) {
                savedGraphs.shift();
            }
            
            // Save back to storage
            localStorage.setItem('desmos_graphs', JSON.stringify(savedGraphs));
        } catch (error) {
            console.error('Error saving graph to storage:', error);
        }
    }
    
    /**
     * Load a previously saved graph
     */
    loadGraph() {
        try {
            // Get saved graphs from storage
            const savedGraphs = JSON.parse(localStorage.getItem('desmos_graphs') || '[]');
            
            if (savedGraphs.length === 0) {
                this.chatbot.updateStatusBar('No saved graphs found');
                return;
            }
            
            // Create graph selection interface
            const content = document.createElement('div');
            content.innerHTML = `
                <p>Select a graph to load:</p>
                <select id="graph-select" class="settings-input">
                    ${savedGraphs.map(graph => `
                        <option value="${graph.id}">${graph.name} (${graph.timestamp})</option>
                    `).join('')}
                </select>
                <p>Or paste graph data:</p>
                <textarea id="graph-data-input" class="graph-dialog-textarea" placeholder="Paste graph data here..."></textarea>
            `;
            
            this.chatbot.showModal('Load Graph', content, [
                {
                    text: 'Load Selected',
                    callback: () => {
                        const select = document.getElementById('graph-select');
                        const selectedId = parseInt(select.value);
                        const selectedGraph = savedGraphs.find(g => g.id === selectedId);
                        
                        if (selectedGraph) {
                            this.calculator.setState(selectedGraph.state);
                            this.currentGraphId = selectedGraph.id;
                            this.currentGraphState = selectedGraph.state;
                            this.chatbot.updateStatusBar(`Loaded graph: ${selectedGraph.name}`);
                            
                            // Make sure calculator is visible
                            if (!this.isActive) {
                                this.toggleCalculator();
                            }
                        }
                    }
                },
                {
                    text: 'Load from Text',
                    callback: () => {
                        const dataInput = document.getElementById('graph-data-input');
                        try {
                            const state = JSON.parse(dataInput.value);
                            this.calculator.setState(state);
                            this.currentGraphState = state;
                            this.chatbot.updateStatusBar('Graph loaded from text input');
                            
                            // Make sure calculator is visible
                            if (!this.isActive) {
                                this.toggleCalculator();
                            }
                        } catch (error) {
                            this.chatbot.updateStatusBar('Error: Invalid graph data format');
                        }
                    }
                },
                {
                    text: 'Cancel'
                }
            ]);
        } catch (error) {
            console.error('Error loading graph:', error);
            this.chatbot.updateStatusBar('Error loading saved graphs');
        }
    }
    
    /**
     * Share the current graph as text
     */
    shareGraph() {
        const state = this.calculator.getState();
        const stateJson = JSON.stringify(state);
        
        // Create a simplified version for Rainer_Smart
        const expressions = state.expressions.list
            .filter(expr => expr.latex && expr.latex.trim())
            .map(expr => expr.latex);
        
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Share your graph:</p>
            <div class="graph-dialog-content">
                <p><strong>Graph Expressions</strong></p>
                <ul>
                    ${expressions.map(expr => `<li><code>${expr}</code></li>`).join('')}
                </ul>
                <p><strong>Graph Data</strong></p>
                <textarea class="graph-dialog-textarea">${stateJson}</textarea>
            </div>
        `;
        
        this.chatbot.showModal('Share Graph', content, [
            {
                text: 'Copy to Clipboard',
                callback: () => {
                    navigator.clipboard.writeText(stateJson)
                        .then(() => this.chatbot.updateStatusBar('Graph data copied to clipboard'))
                        .catch(err => this.chatbot.updateStatusBar('Failed to copy: ' + err.message));
                }
            },
            {
                text: 'Add to Chat',
                callback: () => {
                    // Add a reference to the current graph in the chat
                    const graphData = {
                        id: Date.now(),
                        name: `Shared Graph ${new Date().toLocaleTimeString()}`,
                        timestamp: new Date().toLocaleTimeString(),
                        state: state
                    };
                    
                    this.addGraphReferenceToChat(graphData);
                    this.chatbot.updateStatusBar('Graph reference added to chat');
                }
            },
            {
                text: 'Close'
            }
        ]);
    }
    
    /**
     * Clear the current graph
     */
    clearGraph() {
        if (confirm('Are you sure you want to clear the graph?')) {
            this.calculator.setBlank();
            this.currentGraphState = this.calculator.getState();
            this.chatbot.updateStatusBar('Graph cleared');
        }
    }
    
    /**
     * Export graph as image, HTML or data file
     */
    exportGraph() {
        const state = this.calculator.getState();
        const stateJson = JSON.stringify(state, null, 2);
        
        // Get expressions for HTML export
        const expressions = state.expressions.list
            .filter(expr => expr.latex && expr.latex.trim())
            .map(expr => expr.latex);
        
        // Create minimal HTML template
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Desmos Graph Export</title>
    <script src="https://www.desmos.com/api/v1.7/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"></script>
    <style>
        body { font-family: Arial, sans-serif; }
        #calculator { width: 800px; height: 600px; }
        .equation-list { margin-top: 20px; }
    </style>
</head>
<body>
    <h1>Exported Graph</h1>
    <div id="calculator"></div>
    
    <div class="equation-list">
        <h2>Equations:</h2>
        <ul>
            ${expressions.map(expr => `<li>${expr}</li>`).join('\n            ')}
        </ul>
    </div>
    
    <script>
        window.onload = function() {
            var elt = document.getElementById('calculator');
            var calculator = Desmos.GraphingCalculator(elt);
            calculator.setState(${stateJson});
        };
    </script>
</body>
</html>`;
        
        // Create exported file dialog content
        const content = document.createElement('div');
        content.innerHTML = `
            <p>Export your graph:</p>
            <div class="export-options">
                <button id="export-image-btn" class="export-btn">As PNG Image</button>
                <button id="export-html-btn" class="export-btn">As HTML Page</button>
                <button id="export-json-btn" class="export-btn">As Data File</button>
            </div>
            <p>Graph preview:</p>
            <div class="graph-preview" style="margin: 10px 0; border: 1px solid #ccc; height: 200px; overflow: hidden;">
                <img id="graph-preview-img" style="max-width: 100%;">
            </div>
            <p>Filename (without extension):</p>
            <input type="text" id="export-filename" value="desmos-graph-${Date.now()}" class="settings-input">
        `;
        
        const dialog = this.chatbot.showModal('Export Graph', content, [
            {
                text: 'Close'
            }
        ]);
        
        // Create a temporary canvas for PNG export
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        
        // Set a timeout to capture screenshot after dialog is shown
        setTimeout(() => {
            // Get screenshot
            const screenshot = this.calculator.screenshot({
                width: 800,
                height: 600,
                targetPixelRatio: 2
            });
            
            // Update preview image
            const previewImg = document.getElementById('graph-preview-img');
            if (previewImg) {
                previewImg.src = screenshot;
            }
            
            // Set up export buttons
            document.getElementById('export-image-btn')?.addEventListener('click', () => {
                const filename = document.getElementById('export-filename').value || `desmos-graph-${Date.now()}`;
                this.exportAsImage(screenshot, `${filename}.png`);
            });
            
            document.getElementById('export-html-btn')?.addEventListener('click', () => {
                const filename = document.getElementById('export-filename').value || `desmos-graph-${Date.now()}`;
                this.exportAsFile(htmlContent, `${filename}.html`, 'text/html');
            });
            
            document.getElementById('export-json-btn')?.addEventListener('click', () => {
                const filename = document.getElementById('export-filename').value || `desmos-graph-${Date.now()}`;
                this.exportAsFile(stateJson, `${filename}.json`, 'application/json');
            });
        }, 500);
    }
    
    /**
     * Export the graph as an image file
     */
    exportAsImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        this.chatbot.updateStatusBar(`Graph exported as ${filename}`);
    }
    
    /**
     * Export graph as a file (HTML or JSON)
     */
    exportAsFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.chatbot.updateStatusBar(`Graph exported as ${filename}`);
    }
    
    /**
     * Add a reference to a graph in the chat
     */
    addGraphReferenceToChat(graphData) {
        const chatArea = document.getElementById('chat-area');
        const timestamp = new Date().toLocaleTimeString();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const messageTimestamp = document.createElement('span');
        messageTimestamp.className = 'message-timestamp';
        messageTimestamp.textContent = `[${timestamp}]`;
        messageHeader.appendChild(messageTimestamp);
        
        const messageSender = document.createElement('span');
        messageSender.className = 'message-sender user-label';
        messageSender.textContent = 'You: ';
        messageHeader.appendChild(messageSender);
        messageContainer.appendChild(messageHeader);
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Create a clickable graph reference
        const graphRef = document.createElement('div');
        graphRef.className = 'graph-reference';
        graphRef.innerHTML = `
            <div>📊 <strong>${graphData.name}</strong></div>
            <div style="font-size: 0.9em; margin-top: 5px;">
                ${this.getExpressionSummary(graphData.state)}
            </div>
        `;
        
        // Make it clickable to restore the graph
        graphRef.addEventListener('click', () => {
            this.calculator.setState(graphData.state);
            this.currentGraphState = graphData.state;
            
            // Make sure calculator is visible
            if (!this.isActive) {
                this.toggleCalculator();
            }
            
            this.chatbot.updateStatusBar(`Loaded graph: ${graphData.name}`);
        });
        
        messageContent.appendChild(graphRef);
        messageContainer.appendChild(messageContent);
        chatArea.appendChild(messageContainer);
        chatArea.scrollTop = chatArea.scrollHeight;
        
        // Add to conversation history
        if (this.chatbot && this.chatbot.conversationHistory) {
            this.chatbot.conversationHistory.push({
                timestamp,
                sender: 'You',
                message: `[Graph: ${graphData.name}]`,
                type: 'graph',
                graphData: graphData
            });
        }
    }
    
    /**
     * Get a summary of the expressions in a graph state
     */
    getExpressionSummary(state) {
        const expressions = state.expressions.list
            .filter(expr => expr.latex && expr.latex.trim())
            .map(expr => expr.latex);
        
        if (expressions.length === 0) {
            return '<em>Empty graph</em>';
        }
        
        // Show up to 3 expressions, then "and X more"
        const displayExpressions = expressions.slice(0, 3);
        const remaining = expressions.length - displayExpressions.length;
        
        let summary = displayExpressions.map(expr => `<code>${expr}</code>`).join(', ');
        if (remaining > 0) {
            summary += ` and ${remaining} more equation${remaining > 1 ? 's' : ''}`;
        }
        
        return summary;
    }
    
    /**
     * Plot a list of equations in the calculator
     */
    plotEquations(equations) {
        if (!equations || !Array.isArray(equations) || equations.length === 0) {
            return false;
        }
        
        // Filter out invalid equations
        const validEquations = equations.filter(eq => 
            typeof eq === 'string' && 
            eq.trim().length > 0 && 
            !eq.includes('where') && 
            !eq.includes('s=')
        );
        
        if (validEquations.length === 0) {
            return false;
        }
        
        // Make sure calculator is visible
        if (!this.isActive) {
            this.toggleCalculator();
        }
        
        // Add each equation to the calculator
        validEquations.forEach((eq, index) => {
            const id = 'claude_eq_' + Date.now() + '_' + index;
            this.calculator.setExpression({ id, latex: eq });
        });
        
        if (this.chatbot && typeof this.chatbot.updateStatusBar === 'function') {
            this.chatbot.updateStatusBar(`Plotted ${validEquations.length} equation${validEquations.length > 1 ? 's' : ''}`);
        }
        
        return true;
    }
    
    /**
     * Plot a single point on the calculator
     */
    plotPoint(x, y) {
        // Make sure calculator is visible
        if (!this.isActive) {
            this.toggleCalculator();
        }
        
        // Add the point to the calculator
        const id = 'point_' + Date.now();
        this.calculator.setExpression({ 
            id: id,
            latex: `(${x},${y})`
        });
        
        return id;
    }
    
    /**
     * Extract current graph state as a message for Rainer_Smart
     * Returns a string describing the current graph that can be included in messages to Rainer_Smart
     */
    getCurrentGraphAsMessage() {
        if (!this.currentGraphState) {
            return null;
        }
        
        const state = this.currentGraphState;
        const expressions = state.expressions.list
            .filter(expr => expr.latex && expr.latex.trim())
            .map(expr => expr.latex);
        
        if (expressions.length === 0) {
            return null;
        }
        
        return `I've created a graph with the following equations:\n${expressions.map(expr => `- ${expr}`).join('\n')}`;
    }
}

// Export the DesmosIntegration class
export { DesmosIntegration };