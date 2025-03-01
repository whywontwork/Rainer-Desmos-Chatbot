/**
 * Desmos Equation Processing Module
 * 
 * This module provides functionality for processing equations in Rainer_Smart's messages
 * and preparing them for display in the Desmos calculator.
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
                    /\b(and|is|the|find|with|when)\b/i.test(latexContent)) {
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
                
                // Try to match each pattern and extract just the mathematical part
                let foundMatch = false;
                for (const pattern of mathExpressionPatterns) {
                    const mathMatch = latexContent.match(pattern);
                    if (mathMatch) {
                        // Extract just the matched mathematical expression
                        let extractedMath = mathMatch[0];
                        
                        // If match contains = sign, take everything after it if it's a standalone equation
                        if (extractedMath.includes('=')) {
                            const parts = extractedMath.split('=');
                            if (parts.length === 2 && parts[1].trim()) {
                                // This is a standalone equation, clean it up
                                extractedMath = parts[0].trim() + '=' + parts[1].trim();
                            }
                        }
                        
                        // Clean up LaTeX formatting
                        const cleanMath = extractedMath
                            .replace(/\\text\{[^}]*\}/g, '')
                            .replace(/\\quad/g, '')
                            .replace(/\s+/g, '');
                        
                        if (cleanMath && !equations.includes(cleanMath)) {
                            equations.push(cleanMath);
                            foundMatch = true;
                            break;
                        }
                    }
                }
                
                // If none of the specific patterns matched but content looks mathematical
                // Try a final check for a standalone mathematical expression
                if (!foundMatch && 
                    !/\b(looks|like|is|are|be|can|will|would|should|could|has|have|had)\b/i.test(latexContent) &&
                    /[0-9x\^+\-*\/\(\)]/.test(latexContent)) {
                    
                    // Further filter to avoid sentences - only take expressions with mathematical symbols
                    // that aren't embedded in explanatory text
                    const simpleMathPattern = /([0-9x]+(?:[+\-*\/\^][0-9x\^{}()\+\-\*\/\.]+)+)/;
                    const simpleMatch = latexContent.match(simpleMathPattern);
                    
                    if (simpleMatch) {
                        const cleanMath = simpleMatch[0]
                            .replace(/\\text\{[^}]*\}/g, '')
                            .replace(/\\quad/g, '')
                            .replace(/\s+/g, '');
                        
                        if (cleanMath && !equations.includes(cleanMath)) {
                            // Add as y= equation if it doesn't already have a variable assignment
                            if (!cleanMath.includes('=')) {
                                equations.push(`y=${cleanMath}`);
                            } else {
                                equations.push(cleanMath);
                            }
                        }
                    }
                }
            }
        }
        
        // Check for specific derivative request patterns
        const derivativePattern = /derivative\s+of\s+([yx]\s*=\s*[0-9a-z^+\-*/(){}.\s]+)/gi;
        let derivMatch;
        while ((derivMatch = derivativePattern.exec(message)) !== null) {
            const baseEquation = derivMatch[1].trim();
            // If we find a derivative request, try to locate the derivative equation in the message
            const derivExpr = this.findDerivativeExpression(message, baseEquation);
            if (derivExpr && !equations.includes(derivExpr)) {
                equations.push(derivExpr);
            }
        }
    
        return equations;
    }
    
    /**
     * Find derivative expressions in a message
     * @param {string} message - The message text
     * @param {string} baseEquation - The base equation to find a derivative for
     * @returns {string|null} - The derivative expression, or null if not found
     */
    findDerivativeExpression(message, baseEquation) {
        // This is a simplified approach - just look for equations after "derivative" or "derivative is"
        const derivPatterns = [
            /derivative\s+is\s+([yx]\s*=\s*[0-9a-z^+\-*/(){}.\s]+)/i,
            /derivative\s*:\s*([yx]\s*=\s*[0-9a-z^+\-*/(){}.\s]+)/i,
            /derivative\s+of[^=]+=\s*([0-9a-z^+\-*/(){}.\s]+)/i,
            /\frac{dy}{dx}\s*=\s*([0-9a-z^+\-*/(){}.\s]+)/i,
            /\frac{d}{dx}[^=]*=\s*([0-9a-z^+\-*/(){}.\s]+)/i
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
                if (!/\band\b|\bis\b|\bthe\b|\bfind\b|\bwith\b/i.test(exprText) && 
                    exprText.split(/\s+/).length < 5) {
                    directEquations.push(`y=${exprText}`);
                }
            }
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
            const yEq = equations.find(eq => eq.startsWith('y='));
            if (yEq) return yEq;
            
            // If no y= equation, return the first equation
            return equations[0];
        }
        
        // If no equations were found, check if we have direct equations
        if (directEquations.length > 0) {
            return directEquations[0];
        }
        
        return null;
    }
}

/**
 * Handler for direct plot requests
 */
class DirectPlotHandler {
    /**
     * Create a new direct plot handler
     * @param {DesmosIntegration} desmosIntegration - The Desmos integration instance
     */
    constructor(desmosIntegration) {
        this.desmosIntegration = desmosIntegration;
        this.setupHandlers();
    }

    /**
     * Set up event handlers for direct plotting
     */
    setupHandlers() {
        window.addPlotMessage = this.addPlotMessage;
        window.plotDirectPoint = this.plotDirectPoint.bind(this);
        
        const textInput = document.getElementById('text-input');
        const sendButton = document.getElementById('send-button');
        
        if (textInput && sendButton) {
            sendButton.addEventListener('click', (e) => {
                const userInput = textInput.value.trim();
                const plotRequest = this.checkForDirectPlotRequest(userInput);
                
                if (plotRequest && this.handleDirectPlot(plotRequest)) {
                    textInput.value = '';
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);
            
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    const userInput = textInput.value.trim();
                    const plotRequest = this.checkForDirectPlotRequest(userInput);
                    
                    if (plotRequest && this.handleDirectPlot(plotRequest)) {
                        textInput.value = '';
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }, true);
        }
    }
    
    /**
     * Check if a user input is a direct plot request
     * @param {string} input - The user input text
     * @returns {Object|null} - Plot request object or null
     */
    checkForDirectPlotRequest(input) {
        if (!input) return null;
        
        // Check for direct equation input like "y=2x+5"
        const equationMatch = input.match(/^([yx])\s*=\s*([0-9a-z^+\-*/(){}.\s]+)$/i);
        if (equationMatch) {
            return {
                type: 'equation',
                expression: `${equationMatch[1]}=${equationMatch[2].trim()}`,
                direct: true
            };
        }
        
        // Check for direct plot commands like "plot y=2x+5"
        const plotMatch = input.match(/^(plot|graph)\s+([yx])\s*=\s*([0-9a-z^+\-*/(){}.\s]+)$/i);
        if (plotMatch) {
            return {
                type: 'equation',
                expression: `${plotMatch[2]}=${plotMatch[3].trim()}`,
                direct: true
            };
        }
        
        // Check for plot coordinates like "(3,4)"
        const coordMatch = input.match(/^\(\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)$/);
        if (coordMatch) {
            return {
                type: 'point',
                x: parseFloat(coordMatch[1]),
                y: parseFloat(coordMatch[3]),
                direct: true
            };
        }
        
        return null;
    }

    /**
     * Handle a direct plot request
     * @param {Object} result - The plot request object
     * @returns {boolean} - Whether the plot was successful
     */
    handleDirectPlot(result) {
        if (!result) return false;
        
        if (result.type === 'point') {
            const point = `(${result.x},${result.y})`;
            
            if (result.direct) {
                this.addPlotMessage(`Plotting coordinate ${point} on Desmos graph`);
            } else {
                this.addPlotMessage(`Point: ${point}`);
            }
            
            window.lastPlottedPoint = point;
            
            if (result.direct) {
                return this.plotDirectPoint(result.x, result.y);
            }
            
            return this.desmosIntegration?.plotPoint(result.x, result.y) || false;
        }
        
        if (result.type === 'equation') {
            const latex = this.formatEquationForDesmos(result.expression);
            this.addPlotMessage(latex);
            return this.desmosIntegration?.plotEquations([latex]) || false;
        }
        
        return false;
    }
    
    /**
     * Format an equation for Desmos
     * @param {string} equation - The equation to format
     * @returns {string} - The formatted equation
     */
    formatEquationForDesmos(equation) {
        if (!equation) return null;
        
        // Clean up the equation
        let latex = equation.trim()
            .replace(/\s+/g, '')  // Remove spaces
            .replace(/\^(?!\{)/g, '^{')  // Convert x^2 to x^{2}
            .replace(/\^{(\d+)(?!})/g, '^{$1}');  // Add missing closing braces
            
        // If it has an equals sign, return as is
        if (latex.includes('=')) {
            return latex;
        }
        
        // Otherwise, assume it's a y= equation
        return `y=${latex}`;
    }
    
    /**
     * Add a plot message to the chat
     * @param {string} message - The message text
     */
    addPlotMessage(message) {
        const chatArea = document.getElementById('chat-area');
        if (!chatArea) return;
        
        const timestamp = new Date().toLocaleTimeString();
        
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container plot-message';
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const messageTimestamp = document.createElement('span');
        messageTimestamp.className = 'message-timestamp';
        messageTimestamp.textContent = `[${timestamp}]`;
        messageHeader.appendChild(messageTimestamp);
        
        const messageSender = document.createElement('span');
        messageSender.className = 'message-sender system-label';
        messageSender.textContent = '📊 Graph: ';
        messageHeader.appendChild(messageSender);
        messageContainer.appendChild(messageHeader);
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        messageContainer.appendChild(messageContent);
        
        chatArea.appendChild(messageContainer);
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
    /**
     * Plot a point directly on the Desmos graph
     * @param {number} x - The x coordinate
     * @param {number} y - The y coordinate
     * @returns {boolean} - Whether the plot was successful
     */
    plotDirectPoint(x, y) {
        if (!this.desmosIntegration) return false;
        
        // Show calculator if not visible
        if (typeof window.showCalculator === 'function') {
            window.showCalculator();
        }
        
        return this.desmosIntegration.plotPoint(x, y);
    }
}

/**
 * Handler for automatic equation plotting
 */
class AutoPlotHandler {
    /**
     * Create a new auto plot handler
     * @param {EquationProcessor} equationProcessor - The equation processor
     * @param {DesmosIntegration} desmosIntegration - The Desmos integration
     */
    constructor(equationProcessor, desmosIntegration) {
        this.equationProcessor = equationProcessor;
        this.desmosIntegration = desmosIntegration;
        this.setupAutoPlotting();
    }

    /**
     * Set up automatic plotting
     */
    setupAutoPlotting() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.classList?.contains('message-container') &&
                            node.querySelector('.message-sender.claude-label')) {
                            setTimeout(() => this.autoPlotEquations(node), 500);
                        }
                    });
                }
            });
        });

        const chatContainer = document.getElementById('chat-area');
        if (chatContainer) {
            observer.observe(chatContainer, { childList: true });
            setTimeout(() => this.autoPlotEquations(), 1000);
        }
    }

    /**
     * Get the previous user message
     * @returns {string|null} - The previous user message or null
     */
    getPreviousUserMessage() {
        const messages = Array.from(document.querySelectorAll('.message-container'));
        // Find the last user message before the current Claude message
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].querySelector('.message-sender.user-label')) {
                const content = messages[i].querySelector('.message-content');
                return content?.textContent || '';
            }
        }
        return null;
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