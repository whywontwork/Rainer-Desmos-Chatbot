/**
 * Equation Processing and Desmos Integration Module
 * 
 * This module provides tools for processing equations and mathematical expressions
 * from text and integrating with the Desmos graphing calculator.
 * 
 * @version 1.0.0
 */

class EquationProcessor {
    /**
     * Create a new equation processor
     * @param {DesmosIntegration} desmosIntegration - The Desmos integration instance
     */
    constructor(desmosIntegration) {
        this.desmosIntegration = desmosIntegration;
    }

    /**
     * Extract LaTeX equations from a message
     * @param {string} message - The message text to process
     * @returns {string[]} - Array of extracted LaTeX equations
     */
    extractLatexEquations(message) {
        const equations = [];
        
        if (!message || typeof message !== 'string') {
            return equations;
        }
        
        // First look for direct equation requests in the message
        const directEquationPatterns = [
            /\b([yx]|f\(x\))\s*=\s*([0-9a-z^+\-*/(){}.\s]+)/gi,
            /\bplot\s+([yx]\s*=\s*[0-9a-z^+\-*/(){}.\s]+)/gi,
            /\bgraph\s+([yx]\s*=\s*[0-9a-z^+\-*/(){}.\s]+)/gi
        ];
        
        for (const pattern of directEquationPatterns) {
            let eqMatch;
            while ((eqMatch = pattern.exec(message)) !== null) {
                if (eqMatch[1].includes('=')) {
                    const equation = eqMatch[1].trim();
                    if (equation && !equations.includes(equation)) {
                        equations.push(equation);
                    }
                } else {
                    const expression = eqMatch[2] ? eqMatch[2].trim() : eqMatch[1].trim();
                    if (expression && !equations.includes(`y=${expression}`)) {
                        equations.push(`y=${expression}`);
                    }
                }
            }
        }
        
        // Process LaTeX expressions within $ delimiters - treat $ as strict opening/closing tags for math
        const dollarRegex = /\$([^$]+)\$/g;
        let match;
    
        while ((match = dollarRegex.exec(message)) !== null) {
            if (match[1]) {
                // Everything between $ signs is considered math content
                let latexContent = match[1].trim();
                
                // Skip if it looks like a full sentence or non-math content
                if (latexContent.split(/\s+/).length > 10 || 
                    !/[=^+\-*\/0-9xy()]/.test(latexContent) ||
                    /\b(and|is|the|find|with|when|using)\b/i.test(latexContent) ||
                    /\bDesmos\b/i.test(latexContent) ||
                    /\bplotting\b/i.test(latexContent) ||
                    /\bcalculator\b/i.test(latexContent) ||
                    /\bgraphing\b/i.test(latexContent)) {
                    continue;
                }
                
                // Extract only the actual mathematical expression, not surrounding text
                // This more aggressively filters out text descriptions within LaTeX delimiters
                
                // First try to find a specific equation pattern like y=x^2
                const equationPattern = /\b([yx]|f\(x\))\s*=\s*([^=\s][^,;\.\s]*)/i;
                const equationMatch = latexContent.match(equationPattern);
                
                if (equationMatch) {
                    // Found explicit equation pattern, extract just that part
                    const extractedEquation = `${equationMatch[1]}=${equationMatch[2].trim()}`;
                    
                    // Clean up LaTeX formatting
                    const cleanEquation = extractedEquation
                        .replace(/\\text\{[^}]*\}/g, '')
                        .replace(/\\quad/g, '')
                        .replace(/\s+/g, '');
                    
                    if (cleanEquation && !equations.includes(cleanEquation)) {
                        equations.push(cleanEquation);
                    }
                    continue;
                }
                
                // For other mathematical expressions that should be plotted (without y=)
                const mathExpressionPatterns = [
                    // Derivatives
                    /\\frac\{dy\}\{dx\}\s*=\s*([^,;\.\s]+)/,
                    /\\frac\{d\}\{dx\}\s*[^=]*=\s*([^,;\.\s]+)/,
                    // Common functions
                    /e\^(?:\{[^}]+\}|[^{}\s,;\.]+)/i,
                    /[0-9]*x\^(?:\{[0-9]+\}|[0-9]+)/,
                    /(?:sin|cos|tan|log|ln)\((?:[^)]+)\)/i,
                    /[0-9]+x\s*[+\-]\s*(?:e\^x|[0-9]*x\^[0-9])/
                ];
                
                for (const pattern of mathExpressionPatterns) {
                    const exprMatch = latexContent.match(pattern);
                    if (exprMatch) {
                        let expression = exprMatch[1] ? exprMatch[1].trim() : exprMatch[0].trim();
                        
                        // Remove LaTeX formatting artifacts
                        expression = expression
                            .replace(/\\text\{[^}]*\}/g, '')
                            .replace(/\\quad/g, '')
                            .replace(/\s+/g, '');
                        
                        if (expression && !equations.includes(`y=${expression}`)) {
                            equations.push(`y=${expression}`);
                        }
                        
                        break; // Only use the first matching expression pattern
                    }
                }
            }
        }
        
        // Process LaTeX expressions within double $$ delimiters (these are usually displayed math)
        const doubleDollarRegex = /\$\$([^$]+)\$\$/g;
        
        while ((match = doubleDollarRegex.exec(message)) !== null) {
            if (match[1]) {
                // Clean up the content
                let mathContent = match[1].trim();
                
                // Skip if it looks like a full sentence or non-math content
                if (mathContent.split(/\s+/).length > 10 || 
                    !/[=^+\-*\/0-9xy()]/.test(mathContent) || 
                    /\b(and|is|the|find|with|when|using)\b/i.test(mathContent)) {
                    continue;
                }
                
                // Look for an equation format: y = something or f(x) = something
                const equationMatch = mathContent.match(/([yx]|f\(x\))\s*=\s*([^=\s]+)/i);
                
                if (equationMatch) {
                    const equation = `${equationMatch[1]}=${equationMatch[2].trim()}`;
                    // Clean up
                    const cleanEquation = equation
                        .replace(/\\text\{[^}]*\}/g, '')
                        .replace(/\\quad/g, '')
                        .replace(/\s+/g, '');
                    
                    if (cleanEquation && !equations.includes(cleanEquation)) {
                        equations.push(cleanEquation);
                    }
                }
            }
        }
        
        return equations;
    }
    
    /**
     * Extract a derivative equation from a message
     * @param {string} message - The message to extract a derivative from
     * @returns {string|null} - The extracted derivative or null if not found
     */
    extractDerivative(message) {
        if (!message || typeof message !== 'string') {
            return null;
        }
        
        // Variety of patterns for derivative expressions in both LaTeX and plain text
        const derivPatterns = [
            /derivative is\s*[^\w]*([^\.]+)/i,
            /function's derivative is\s*[^\w]*([^\.]+)/i,
            /derivative of this function is\s*[^\w]*([^\.]+)/i,
            /derivative(?:.*?)is\s*[^\w]*f'(?:.*?)=(.*?)(?:\.|$)/is,
            /derivative:(.*?)$/im,
            /derivative\s*[=:]\s*([^\.]+)/i,
            /the\s+derivative\s+(?:.*?)\s+is\s+([^\.]+)/i,
            /f'(?:\(x\))?\s*=\s*([^\.]+)/i,
            /\$f'(?:\(x\))?\s*=\s*([^$]+)\$/i,
            /\$\\frac{d}{dx}(?:.*?)=\s*([^$]+)\$/i,
            /\$\\frac{dy}{dx}(?:.*?)=\s*([^$]+)\$/i
        ];
        
        for (const pattern of derivPatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return null;
    }
    
    /**
     * Find point coordinates in a message
     * @param {string} message - The message text
     * @returns {Array} - Array of point objects with x, y coordinates
     */
    findPoints(message) {
        const points = [];
        
        if (!message || typeof message !== 'string') {
            return points;
        }
        
        // Don't extract points from messages that appear to be graphing main functions
        // This prevents adding example points meant for explanation
        if (message.match(/plot|graph|equation|function|y\s*=|f\s*\(x\)\s*=/i)) {
            return points;
        }
        
        // Match coordinate pairs like (3,4) or (x,y)
        const pointRegex = /\((-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)\)/g;
        let match;
        
        while ((match = pointRegex.exec(message)) !== null) {
            const x = parseFloat(match[1]);
            const y = parseFloat(match[3]);
            if (!isNaN(x) && !isNaN(y)) {
                points.push({ x, y });
            }
        }
        
        return points;
    }

    /**
     * Process a message from Rainer_Smart for potential graph/equation content
     * @param {string} message - The message text
     * @returns {Object} - Result object with success status and plotted equations
     */
    processMessageForEquations(message) {
        // Improved pattern to find proper equation formats
        const equationPattern = /\b([a-z])\s*=\s*([-+*\/\^0-9a-z²³()\s]+)(?![^<]*>|[^<>]*<\/)/gi;
        
        // Pattern to identify "Plot N equations in Desmos" sections
        const plotCommandPattern = /📊\s*Plot\s+(\d+)\s+equations?\s+in\s+Desmos/i;
        const isPlotCommand = plotCommandPattern.test(message);
        
        // Extract direct request for plotting equations or derivatives
        const plotRequestPattern = /\b(plot|graph|derivative)\b/i;
        const isPlotRequest = plotRequestPattern.test(message);
        
        // Direct extraction of key equation forms
        const directEquations = [];
        
        // Look for y= forms directly
        if (isPlotRequest || message.toLowerCase().includes('y=')) {
            const directEquationMatch = message.match(/y\s*=\s*([0-9a-z^+\-*/(){}.\s]+)/i);
            if (directEquationMatch && directEquationMatch[1]) {
                const exprText = directEquationMatch[1].trim();
                // Filter out text that looks like a sentence
                if (!/\band\b|\bis\b|\bthe\b|\bfind\b|\bwith\b|\busing\b|\bdesmos\b|\bcalculator\b/i.test(exprText) && 
                    exprText.split(/\s+/).length < 5) {
                    directEquations.push(`y=${exprText}`);
                }
            }
        }
        
        // If this is a direct plot or equation request, only plot the main equation
        // and ignore example points that might be included in the response
        if (isPlotRequest && directEquations.length > 0) {
            // We have a direct equation to plot, just use that
            const mainEquation = directEquations[0];
            
            if (this.desmosIntegration) {
                this.desmosIntegration.plotEquation(mainEquation);
                
                const result = {
                    success: true,
                    equations: [mainEquation],
                    message: `Plotted equation: ${mainEquation}`
                };
                
                result.toString = function() { return this.message; };
                return result;
            }
            
            return { success: false, message: "Desmos integration not available" };
        }
        
        // Check for LaTeX delimited equations and parse them carefully
        const latexEquations = this.extractLatexEquations(message);
        
        // Filter out malformed latex expressions that aren't actual equations
        const validLatexEquations = latexEquations.filter(eq => {
            // Skip expressions that are likely text fragments
            if (eq.startsWith('=') || 
                eq.includes('where') || 
                eq.includes('s=') || 
                eq.includes('text') || 
                /^([a-z])\s*=\s*"/.test(eq)) {
                return false;
            }
            return true;
        });
        
        // If we're responding to a specific user request like "graph y=2x+4",
        // only graph the exact form requested and ignore examples/explanations
        if (isPlotRequest) {
            const userRequestedEquation = this.getUserRequestedEquation();
            if (userRequestedEquation) {
                if (this.desmosIntegration) {
                    this.desmosIntegration.plotEquation(userRequestedEquation);
                    
                    const result = {
                        success: true,
                        equations: [userRequestedEquation],
                        message: `Plotted requested equation: ${userRequestedEquation}`
                    };
                    
                    result.toString = function() { return this.message; };
                    return result;
                }
                
                return { success: false, message: "Desmos integration not available" };
            }
        }
        
        // Check if there are potential equations in the message
        const hasEquations = equationPattern.test(message) || validLatexEquations.length > 0 || directEquations.length > 0;
        equationPattern.lastIndex = 0; // Reset the regex
        
        if (!hasEquations && !isPlotCommand && !isPlotRequest) {
            const result = { success: false, message: "No equations found to plot" };
            return result;
        }
        
        // Format equations for plotting
        const plotEquations = [
            ...directEquations,
            ...validLatexEquations.map(eq => {
                if (eq.includes('=')) {
                    return eq;
                } else {
                    return `y=${eq}`;
                }
            })
        ];
        
        // Remove duplicates, empty equations, and filter out helper equations
        const uniqueEquations = [...new Set(plotEquations)]
            .filter(eq => eq && eq.length > 2)
            // Filter out common helper equations used for visual details rather than functions
            .filter(eq => 
                !['y=0', 'x=0', 'y=x', 'y=x^2'].includes(eq) && 
                !eq.includes('\\geq') &&
                !eq.includes('≈') &&
                !eq.includes('≥') &&
                !eq.match(/[xy]=.*[xy]>/)
            );
        
        // Make sure we still have at least the primary equation
        const mainEquation = this.findMainEquation(uniqueEquations, directEquations);
        const filteredEquations = uniqueEquations.length > 0 ? uniqueEquations : (mainEquation ? [mainEquation] : []);
        
        // Plot the equations
        if (this.desmosIntegration && filteredEquations.length > 0) {
            // If we have a direct equation request, only plot the first equation
            // This prevents plotting examples and explanations
            if (isPlotRequest && filteredEquations.length > 0) {
                // Find the most likely main equation
                const mainEq = filteredEquations[0];
                this.desmosIntegration.plotEquation(mainEq);
                
                const result = {
                    success: true,
                    equations: [mainEq],
                    message: `Plotted equation: ${mainEq}`
                };
                
                result.toString = function() { return this.message; };
                return result;
            } else {
                // Normal processing for other cases
                this.desmosIntegration.plotEquations(filteredEquations);
                
                // Create a result object that behaves both as a boolean true and has properties
                const result = Object.assign(
                    function() { return true; }, 
                    {
                        success: true,
                        equations: filteredEquations,
                        message: `Plotted ${filteredEquations.length} equation${filteredEquations.length > 1 ? 's' : ''}: ${filteredEquations.join(', ')}`
                    }
                );
                
                // Add a toString method that returns the message
                result.toString = function() { return this.message; };
                
                return result;
            }
        }

        const result = { success: false, message: "No valid equations found to plot" };
        return result;
    }

    /**
     * Find the main equation to plot from available equations
     * @param {string[]} equations - List of available equations
     * @param {string[]} directEquations - Direct equations from the message
     * @returns {string|null} - The main equation or null
     */
    findMainEquation(equations, directEquations) {
        // If we have equations, try to find the most important one
        if (equations.length > 0) {
            // First look for the direct request equation
            if (directEquations.length > 0) {
                return directEquations[0];
            }
            
            // Otherwise, look for equations with specific patterns
            // First, check for y= equations
            const yEquation = equations.find(eq => /^y\s*=/.test(eq));
            if (yEquation) {
                return yEquation;
            }
            
            // Then check for f(x)= equations
            const fEquation = equations.find(eq => /^f\s*\(\s*x\s*\)\s*=/.test(eq));
            if (fEquation) {
                return fEquation;
            }
            
            // Otherwise just take the first equation
            return equations[0];
        }
        
        return null;
    }
    
    /**
     * Get the equation directly requested by the user
     * @returns {string|null} - The requested equation or null
     */
    getUserRequestedEquation() {
        const userMessages = Array.from(document.querySelectorAll('.user-message'))
            .map(el => el.querySelector('.message-content')?.textContent || '');
        
        if (userMessages.length === 0) {
            return null;
        }
        
        // Get the most recent user message
        const lastUserMessage = userMessages[userMessages.length - 1];
        
        // Look for direct plotting requests
        const plotPatterns = [
            /plot\s+(?:the\s+)?(?:equation\s+)?(y\s*=\s*[^,.]+)/i,
            /graph\s+(?:the\s+)?(?:equation\s+)?(y\s*=\s*[^,.]+)/i,
            /plot\s+(?:the\s+)?(?:equation\s+)?([a-z]\s*\([a-z]\)\s*=\s*[^,.]+)/i,
            /graph\s+(?:the\s+)?(?:equation\s+)?([a-z]\s*\([a-z]\)\s*=\s*[^,.]+)/i,
            /plot\s+(?:the\s+)?(?:function\s+)?([^,.]+)/i,
            /graph\s+(?:the\s+)?(?:function\s+)?([^,.]+)/i
        ];
        
        for (const pattern of plotPatterns) {
            const match = lastUserMessage.match(pattern);
            if (match && match[1]) {
                const equation = match[1].trim();
                // Check if it already has the y= part
                if (equation.match(/^[a-z]\s*=|^[a-z]\s*\([a-z]\)\s*=/i)) {
                    return equation;
                } else {
                    // If it's just an expression, add y=
                    return `y=${equation}`;
                }
            }
        }
        return null;
    }
}

/**
 * Handles direct plotting of equations based on button clicks or UI events
 */
class DirectPlotHandler {
    /**
     * Create a new direct plot handler
     * @param {DesmosIntegration} desmosIntegration - The Desmos integration
     */
    constructor(desmosIntegration) {
        this.desmosIntegration = desmosIntegration;
        this.setupDirectPlotButtons();
    }
    
    /**
     * Set up direct plot buttons in the UI
     */
    setupDirectPlotButtons() {
        // Add event listeners to any plot buttons
        document.querySelectorAll('.plot-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                const equation = button.dataset.equation;
                if (equation) {
                    this.handleDirectPlot(equation);
                }
            });
        });
        
        // Set up a global handler for plot buttons that may be added dynamically
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.plot-button');
            if (target && !target.hasDirectPlotHandler) {
                target.hasDirectPlotHandler = true;
                
                const equation = target.dataset.equation;
                if (equation) {
                    this.handleDirectPlot(equation);
                }
            }
        });
    }
    
    /**
     * Handle a direct plot request
     * @param {string} equation - The equation to plot
     */
    handleDirectPlot(equation) {
        if (!equation || !this.desmosIntegration) {
            return;
        }
        
        // Show the Desmos calculator
        const desmosContainer = document.getElementById('desmos-container');
        if (desmosContainer) {
            desmosContainer.classList.add('visible');
        }
        
        // Plot the equation
        this.desmosIntegration.plotEquation(equation);
        
        // Update UI if needed
        if (typeof window.addPlotMessage === 'function') {
            window.addPlotMessage(`Plotted equation: ${equation}`);
        }
    }
}

/**
 * Automatically detects and plots equations in Rainer_Smart's messages
 */
class AutoPlotHandler {
    /**
     * Create a new auto plot handler
     * @param {EquationProcessor} equationProcessor - The equation processor to use
     * @param {DesmosIntegration} desmosIntegration - The Desmos integration
     */
    constructor(equationProcessor, desmosIntegration) {
        this.equationProcessor = equationProcessor;
        this.desmosIntegration = desmosIntegration;
        this.setupAutoPlotObserver();
        
        // Mark that we've initialized to prevent multiple instances
        window._autoPlotHandlerInitialized = true;
    }
    
    /**
     * Set up an observer to detect new messages
     */
    setupAutoPlotObserver() {
        // Process existing messages first
        this.autoPlotEquations();
        
        // Set up observer for new messages
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                const addedNodes = Array.from(mutation.addedNodes);
                
                for (const node of addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if this is a Rainer_Smart message
                        const isClaudeMessage = node.classList?.contains('claude-message') ||
                            node.querySelector?.('.claude-message, .message-sender.claude-label');
                        
                        if (isClaudeMessage) {
                            setTimeout(() => this.autoPlotEquations(node), 500);
                        }
                    }
                }
            }
        });
        
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            observer.observe(chatArea, { childList: true, subtree: true });
        }
        
        // Store the observer so it can be disconnected if needed
        this.observer = observer;
    }
    
    /**
     * Get the previous user message
     * @returns {string|null} - The previous user message content
     */
    getPreviousUserMessage() {
        const userMessages = Array.from(document.querySelectorAll('.user-message .message-content'));
        if (userMessages.length === 0) {
            return null;
        }
        
        return userMessages[userMessages.length - 1].textContent;
    }

    /**
     * Auto-plot equations in Rainer_Smart's messages
     * @param {Element} claudeMessage - The Rainer_Smart message element
     */
    autoPlotEquations(claudeMessage) {
        const messagesToProcess = claudeMessage ? [claudeMessage] : 
            Array.from(document.querySelectorAll('.message-container'))
                .filter(el => el.querySelector('.message-sender.claude-label') && !el.dataset.autoPlotted);

        if (!messagesToProcess.length) return;

        const userMessage = this.getPreviousUserMessage();
        const isPlotRequest = userMessage?.toLowerCase().match(/plot|graph|derivative/);

        messagesToProcess.forEach(message => {
            if (message.dataset.autoPlotted === 'true') return;
            message.dataset.autoPlotted = 'true';

            const messageContent = message.querySelector('.message-content');
            if (!messageContent?.textContent) return;

            if (isPlotRequest) {
                const result = this.equationProcessor.processMessageForEquations(messageContent.textContent);
                if (result && result.success) {
                    // Only update the status, don't modify the message
                    if (typeof window.addPlotMessage === 'function') {
                        window.addPlotMessage(`Plotted ${result.equations.length} equation(s): ${result.equations.join(', ')}`);
                    }
                }
            }
        });
    }
}

export { EquationProcessor, DirectPlotHandler, AutoPlotHandler };