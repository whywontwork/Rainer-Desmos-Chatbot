/**
 * Desmos Graphing Calculator Integration Module
 * 
 * This module provides integration with the Desmos graphing calculator
 * for plotting mathematical equations and visualizing mathematical concepts.
 * 
 * @version 1.0.0
 */

class DesmosIntegration {
    /**
     * Create a new Desmos integration instance
     * @param {Object} chatbot - The chatbot instance
     */
    constructor(chatbot) {
        this.chatbot = chatbot;
        this.calculator = null;
        this.isActive = false;
        this.container = null;
        this.currentGraphState = null;
        
        // Initialize the Desmos calculator
        this.initializeCalculator();
        
        // Set up toggle button
        this.setupToggleButton();
        
        // Set up a resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    /**
     * Initialize the Desmos calculator
     */
    initializeCalculator() {
        // Get the container element
        this.container = document.getElementById('desmos-container');
        if (!this.container) {
            console.error('Desmos container not found');
            return;
        }
        
        // Get the calculator element
        const calculatorElement = document.getElementById('desmos-calculator');
        if (!calculatorElement) {
            console.error('Desmos calculator element not found');
            return;
        }
        
        // Check if Desmos is available
        if (typeof Desmos === 'undefined') {
            console.error('Desmos library not loaded');
            return;
        }
        
        // Create the calculator
        try {
            this.calculator = Desmos.GraphingCalculator(calculatorElement, {
                keypad: false,
                expressions: true,
                settingsMenu: true,
                zoomButtons: true,
                expressionsTopbar: true,
                lockViewport: false,
                border: false,
                images: false,
                folders: false,
                notes: false,
                sliders: true,
                authorFeatures: false,
                trace: false,
                points: true,
                links: false,
                showGrid: true,
                showXAxis: true,
                showYAxis: true
            });
            
            // Set initial size
            this.handleResize();
            
            // Apply the current theme
            this.applyTheme(this.getCurrentTheme());
            
            // Add a bit of margin to the viewing area
            this.calculator.setMathBounds({
                left: -10,
                right: 10,
                bottom: -6,
                top: 6
            });
            
            // Save current state
            this.currentGraphState = this.calculator.getState();
            
            if (this.chatbot) {
                this.chatbot.updateStatusBar('Desmos calculator initialized');
            }
            console.log('Desmos calculator successfully initialized');
        } catch (error) {
            console.error('Error initializing Desmos calculator:', error);
            this.calculator = null;
        }
    }
    
    /**
     * Set up the toggle button for the calculator
     */
    setupToggleButton() {
        const toggleButton = document.getElementById('toggle-graph-btn');
        if (!toggleButton) {
            console.warn('Desmos toggle button not found');
            return;
        }
        
        toggleButton.addEventListener('click', () => {
            this.toggleCalculator();
        });
    }
    
    /**
     * Toggle the calculator visibility
     */
    toggleCalculator() {
        if (!this.container) {
            return;
        }
        
        this.isActive = !this.isActive;
        this.container.classList.toggle('visible', this.isActive);
        
        // Resize calculator when shown
        if (this.isActive && this.calculator) {
            setTimeout(() => {
                this.calculator.resize();
            }, 100);
        }
        
        // Update toggle button text
        const toggleButton = document.getElementById('toggle-graph-btn');
        if (toggleButton) {
            toggleButton.textContent = this.isActive ? 'Hide Graph' : '📊 Graph';
        }
    }
    
    /**
     * Handle window resize events
     */
    handleResize() {
        if (this.calculator) {
            this.calculator.resize();
        }
    }
    
    /**
     * Get the current theme from the UI
     */
    getCurrentTheme() {
        const htmlElement = document.documentElement;
        const isDark = htmlElement.classList.contains('dark-mode') || 
            htmlElement.getAttribute('data-theme') === 'dark' ||
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        return isDark ? 'dark' : 'light';
    }
    
    /**
     * Apply a theme to the calculator
     * @param {string} theme - The theme to apply (light or dark)
     */
    applyTheme(theme) {
        if (!this.calculator) {
            return;
        }
        
        if (theme === 'dark') {
            this.calculator.updateSettings({
                backgroundColor: '#2D2D2D',
                textColor: '#FFFFFF',
                gridColor: '#444444'
            });
        } else {
            this.calculator.updateSettings({
                backgroundColor: '#FFFFFF',
                textColor: '#000000',
                gridColor: '#DDDDDD'
            });
        }
    }
    
    /**
     * Add an equation to the calculator
     * @param {string} equation - The equation to add
     * @returns {string} - The ID of the added equation
     */
    addEquation(equation) {
        if (!this.calculator) {
            console.error('Desmos calculator not initialized');
            return null;
        }
        
        // Make sure calculator is visible
        if (!this.isActive) {
            this.toggleCalculator();
        }
        
        try {
            // Add the equation to the calculator
            const id = 'eq_' + Date.now();
            this.calculator.setExpression({ id, latex: equation });
            
            // Update current graph state
            this.currentGraphState = this.calculator.getState();
            
            return id;
        } catch (error) {
            console.error('Error adding equation:', error);
            return null;
        }
    }
    
    /**
     * Add a point to the calculator
     * @param {number} x - The x coordinate
     * @param {number} y - The y coordinate
     * @returns {string} - The ID of the added point
     */
    addPoint(x, y) {
        if (!this.calculator) {
            console.error('Desmos calculator not initialized');
            return null;
        }
        
        // Make sure calculator is visible
        if (!this.isActive) {
            this.toggleCalculator();
        }
        
        try {
            // Create a unique ID for the point
            const id = 'point_' + Date.now();
            
            // Add the point to the calculator
            this.calculator.setExpression({
                id: id,
                latex: `(${x},${y})`
            });
            
            return id;
        } catch (error) {
            console.error('Error adding point:', error);
            return null;
        }
    }
    
    /**
     * Plot a single equation in the calculator
     * @param {string} equation - The equation to plot
     * @returns {boolean} - Whether the plot was successful
     */
    plotEquation(equation) {
        if (!equation || typeof equation !== 'string' || equation.trim().length === 0) {
            return false;
        }
        
        // Skip invalid equations
        if (equation.includes('where') || equation.includes('s=')) {
            return false;
        }
        
        // Check if calculator is initialized
        if (!this.calculator) {
            console.error('Cannot plot equation: Desmos calculator is not initialized');
            return false;
        }
        
        // Make sure calculator is visible
        if (!this.isActive) {
            this.toggleCalculator();
        }
        
        try {
            // Clear any previous equations
            // This ensures we only show the main equation
            const expressions = this.calculator.getExpressions();
            if (expressions && expressions.length > 0) {
                this.calculator.removeExpressions(expressions);
            }
            
            // Add the equation to the calculator
            const id = 'claude_eq_' + Date.now();
            this.calculator.setExpression({ id, latex: equation });
            
            // Update current graph state
            this.currentGraphState = this.calculator.getState();
            
            // Update status bar
            if (this.chatbot && typeof this.chatbot.updateStatusBar === 'function') {
                this.chatbot.updateStatusBar(`Plotted equation: ${equation}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error plotting equation:', error);
            return false;
        }
    }
    
    /**
     * Plot a list of equations in the calculator
     * @param {string[]} equations - Array of equations to plot
     * @returns {boolean} - Whether the plot was successful
     */
    plotEquations(equations) {
        if (!equations || !Array.isArray(equations) || equations.length === 0) {
            return false;
        }
        
        // Check if calculator is initialized
        if (!this.calculator) {
            console.error('Cannot plot equations: Desmos calculator is not initialized');
            return false;
        }
        
        // For direct equation requests, use plotEquation to ensure clean plotting
        if (equations.length === 1) {
            return this.plotEquation(equations[0]);
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
        
        try {
            // Clear previous expressions to avoid cluttering the graph
            const expressions = this.calculator.getExpressions();
            if (expressions && expressions.length > 0) {
                this.calculator.removeExpressions(expressions);
            }
            
            // Add each equation to the calculator
            validEquations.forEach((eq, index) => {
                const id = 'claude_eq_' + Date.now() + '_' + index;
                this.calculator.setExpression({ id, latex: eq });
            });
            
            // Update current graph state
            this.currentGraphState = this.calculator.getState();
            
            if (this.chatbot && typeof this.chatbot.updateStatusBar === 'function') {
                this.chatbot.updateStatusBar(`Plotted ${validEquations.length} equation${validEquations.length > 1 ? 's' : ''}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error plotting equations:', error);
            return false;
        }
    }
    
    /**
     * Plot a single point on the calculator
     */
    plotPoint(x, y) {
        if (!this.calculator) {
            console.error('Cannot plot point: Desmos calculator is not initialized');
            return null;
        }
        
        // Make sure calculator is visible
        if (!this.isActive) {
            this.toggleCalculator();
        }
        
        try {
            // Add the point to the calculator
            const id = 'point_' + Date.now();
            this.calculator.setExpression({
                id: id,
                latex: `(${x},${y})`
            });
            
            return id;
        } catch (error) {
            console.error('Error plotting point:', error);
            return null;
        }
    }
    
    /**
     * Extract current graph state as a message for Rainer_Smart
     * Returns a string describing the current graph that can be included in messages to Rainer_Smart
     */
    getCurrentGraphAsMessage() {
        if (!this.calculator || !this.currentGraphState) {
            return null;
        }
        
        try {
            const state = this.currentGraphState;
            const expressions = state.expressions.list
                .filter(expr => expr.latex && expr.latex.trim())
                .map(expr => expr.latex);
            
            if (expressions.length === 0) {
                return null;
            }
            
            return `I've created a graph with the following equations:\n${expressions.map(expr => `- ${expr}`).join('\n')}`;
        } catch (error) {
            console.error('Error getting graph state:', error);
            return null;
        }
    }
}

// Export the DesmosIntegration class
export { DesmosIntegration };