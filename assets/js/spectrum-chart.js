/**
 * Spectrum chart components for displaying RTL-SDR data
 * Handles both spectrum and waterfall visualization
 */

/**
 * Main spectrum chart class using Canvas for high-performance rendering
 */
class SpectrumChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with ID ${canvasId} not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.isDestroyed = false;
        this.animationId = null;
        
        // Chart data
        this.spectrumData = null;
        this.frequencyData = null;
        this.markers = [];
        
        // Chart settings
        this.settings = {
            backgroundColor: '#111111',
            gridColor: 'rgba(255, 255, 255, 0.1)',
            spectrumColor: '#00ff00',
            textColor: '#ffffff',
            markerColor: '#ff0000',
            padding: { top: 20, right: 20, bottom: 40, left: 60 },
            showGrid: true,
            showLabels: true,
            minDb: -100,
            maxDb: 0,
            ...options
        };
        
        // Mouse interaction
        this.isMouseDown = false;
        this.mousePos = { x: 0, y: 0 };
        this.selectedFrequency = null;
        
        this.initializeCanvas();
        this.bindEvents();
        this.startRenderLoop();
    }
    
    /**
     * Initialize canvas and set up basic properties
     */
    initializeCanvas() {
        this.resizeCanvas();
        
        // Set canvas properties for crisp rendering
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '12px Courier New, monospace';
        
        // Initial draw
        this.draw();
    }
    
    /**
     * Resize canvas to fit container
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Update canvas style
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Recalculate draw area
        this.drawWidth = this.canvas.width - this.settings.padding.left - this.settings.padding.right;
        this.drawHeight = this.canvas.height - this.settings.padding.top - this.settings.padding.bottom;
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Listen for spectrum data updates
        document.addEventListener('spectrumData', (event) => {
            if (!this.isDestroyed) {
                this.updateData(event.detail);
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (!this.isDestroyed) {
                this.resizeCanvas();
            }
        });
        
        // Mouse events for interaction
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }
    
    /**
     * Start render loop
     */
    startRenderLoop() {
        const render = () => {
            if (!this.isDestroyed) {
                this.draw();
                this.animationId = requestAnimationFrame(render);
            }
        };
        render();
    }
    
    /**
     * Update spectrum data
     */
    updateData(data) {
        if (!data || !data.powers || !data.center_freq || !data.sample_rate) {
            return;
        }
        
        this.spectrumData = data.powers;
        
        // Calculate frequency array
        const centerFreq = data.center_freq / 1e6; // Convert to MHz
        const sampleRate = data.sample_rate / 1e6; // Convert to MHz
        const numPoints = data.powers.length;
        const freqStep = sampleRate / numPoints;
        const startFreq = centerFreq - (sampleRate / 2);
        
        this.frequencyData = [];
        for (let i = 0; i < numPoints; i++) {
            this.frequencyData.push(startFreq + (i * freqStep));
        }
        
        this.centerFreq = centerFreq;
        this.sampleRate = sampleRate;
    }
    
    /**
     * Main draw function
     */
    draw() {
        if (!this.ctx || this.isDestroyed) return;
        
        // Clear canvas
        this.ctx.fillStyle = this.settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.spectrumData || !this.frequencyData) {
            this.drawNoDataMessage();
            return;
        }
        
        // Draw grid
        if (this.settings.showGrid) {
            this.drawGrid();
        }
        
        // Draw spectrum
        this.drawSpectrum();
        
        // Draw markers
        this.drawMarkers();
        
        // Draw labels
        if (this.settings.showLabels) {
            this.drawLabels();
        }
        
        // Draw mouse cursor info
        this.drawMouseInfo();
    }
    
    /**
     * Draw grid lines
     */
    drawGrid() {
        this.ctx.strokeStyle = this.settings.gridColor;
        this.ctx.lineWidth = 1;
        
        // Vertical grid lines (frequency)
        const freqStep = this.sampleRate / 10;
        for (let i = 0; i <= 10; i++) {
            const freq = this.centerFreq - (this.sampleRate / 2) + (i * freqStep);
            const x = this.settings.padding.left + (i * this.drawWidth / 10);
            
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.settings.padding.top);
            this.ctx.lineTo(x, this.canvas.height - this.settings.padding.bottom);
            this.ctx.stroke();
        }
        
        // Horizontal grid lines (power)
        const powerStep = (this.settings.maxDb - this.settings.minDb) / 10;
        for (let i = 0; i <= 10; i++) {
            const power = this.settings.minDb + (i * powerStep);
            const y = this.canvas.height - this.settings.padding.bottom - (i * this.drawHeight / 10);
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.settings.padding.left, y);
            this.ctx.lineTo(this.canvas.width - this.settings.padding.right, y);
            this.ctx.stroke();
        }
    }
    
    /**
     * Draw spectrum line
     */
    drawSpectrum() {
        if (!this.spectrumData || this.spectrumData.length === 0) return;
        
        this.ctx.strokeStyle = this.settings.spectrumColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        let firstPoint = true;
        
        for (let i = 0; i < this.spectrumData.length; i++) {
            const power = this.spectrumData[i];
            const x = this.settings.padding.left + (i * this.drawWidth / this.spectrumData.length);
            const y = this.powerToY(power);
            
            if (firstPoint) {
                this.ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        
        // Fill area under curve
        this.ctx.fillStyle = this.settings.spectrumColor + '20';
        this.ctx.lineTo(this.canvas.width - this.settings.padding.right, this.canvas.height - this.settings.padding.bottom);
        this.ctx.lineTo(this.settings.padding.left, this.canvas.height - this.settings.padding.bottom);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    /**
     * Draw frequency markers
     */
    drawMarkers() {
        this.markers.forEach(marker => {
            const x = this.freqToX(marker.frequency);
            
            // Draw marker line
            this.ctx.strokeStyle = marker.color || this.settings.markerColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.settings.padding.top);
            this.ctx.lineTo(x, this.canvas.height - this.settings.padding.bottom);
            this.ctx.stroke();
            
            // Draw marker label
            this.ctx.fillStyle = marker.color || this.settings.markerColor;
            this.ctx.font = '12px Arial';
            this.ctx.fillText(
                marker.label || `${marker.frequency.toFixed(3)} MHz`,
                x + 5,
                this.settings.padding.top + 15
            );
        });
    }
    
    /**
     * Draw axis labels
     */
    drawLabels() {
        this.ctx.fillStyle = this.settings.textColor;
        this.ctx.font = '12px Arial';
        
        // Frequency labels (bottom)
        const freqStep = this.sampleRate / 5;
        for (let i = 0; i <= 5; i++) {
            const freq = this.centerFreq - (this.sampleRate / 2) + (i * freqStep);
            const x = this.settings.padding.left + (i * this.drawWidth / 5);
            
            this.ctx.fillText(
                freq.toFixed(1),
                x - 20,
                this.canvas.height - this.settings.padding.bottom + 20
            );
        }
        
        // Power labels (left)
        const powerStep = (this.settings.maxDb - this.settings.minDb) / 5;
        for (let i = 0; i <= 5; i++) {
            const power = this.settings.minDb + (i * powerStep);
            const y = this.canvas.height - this.settings.padding.bottom - (i * this.drawHeight / 5);
            
            this.ctx.fillText(
                power.toFixed(0),
                this.settings.padding.left - 40,
                y
            );
        }
        
        // Axis titles
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Frequency (MHz)', this.canvas.width / 2 - 50, this.canvas.height - 10);
        
        this.ctx.save();
        this.ctx.translate(15, this.canvas.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText('Power (dB)', -40, 0);
        this.ctx.restore();
    }
    
    /**
     * Draw mouse cursor information
     */
    drawMouseInfo() {
        if (!this.isMouseDown && !this.selectedFrequency) return;
        
        const freq = this.xToFreq(this.mousePos.x);
        const power = this.yToPower(this.mousePos.y);
        
        if (freq >= this.frequencyData[0] && freq <= this.frequencyData[this.frequencyData.length - 1]) {
            // Draw cursor line
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.mousePos.x, this.settings.padding.top);
            this.ctx.lineTo(this.mousePos.x, this.canvas.height - this.settings.padding.bottom);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw info box
            const infoText = `${freq.toFixed(3)} MHz, ${power.toFixed(1)} dB`;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(this.mousePos.x + 10, this.mousePos.y - 20, 120, 25);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(infoText, this.mousePos.x + 15, this.mousePos.y - 7);
        }
    }
    
    /**
     * Draw "No Data" message
     */
    drawNoDataMessage() {
        this.ctx.fillStyle = this.settings.textColor;
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            'No spectrum data available',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
        this.ctx.textAlign = 'left';
    }
    
    /**
     * Convert frequency to X coordinate
     */
    freqToX(freq) {
        if (!this.frequencyData || this.frequencyData.length === 0) return 0;
        
        const minFreq = this.frequencyData[0];
        const maxFreq = this.frequencyData[this.frequencyData.length - 1];
        const ratio = (freq - minFreq) / (maxFreq - minFreq);
        
        return this.settings.padding.left + (ratio * this.drawWidth);
    }
    
    /**
     * Convert X coordinate to frequency
     */
    xToFreq(x) {
        if (!this.frequencyData || this.frequencyData.length === 0) return 0;
        
        const ratio = (x - this.settings.padding.left) / this.drawWidth;
        const minFreq = this.frequencyData[0];
        const maxFreq = this.frequencyData[this.frequencyData.length - 1];
        
        return minFreq + (ratio * (maxFreq - minFreq));
    }
    
    /**
     * Convert power to Y coordinate
     */
    powerToY(power) {
        const ratio = (power - this.settings.minDb) / (this.settings.maxDb - this.settings.minDb);
        return this.canvas.height - this.settings.padding.bottom - (ratio * this.drawHeight);
    }
    
    /**
     * Convert Y coordinate to power
     */
    yToPower(y) {
        const ratio = (this.canvas.height - this.settings.padding.bottom - y) / this.drawHeight;
        return this.settings.minDb + (ratio * (this.settings.maxDb - this.settings.minDb));
    }
    
    /**
     * Mouse event handlers
     */
    handleMouseDown(e) {
        this.isMouseDown = true;
        this.updateMousePosition(e);
    }
    
    handleMouseMove(e) {
        this.updateMousePosition(e);
    }
    
    handleMouseUp(e) {
        this.isMouseDown = false;
    }
    
    handleMouseLeave(e) {
        this.isMouseDown = false;
    }
    
    handleClick(e) {
        this.updateMousePosition(e);
        const freq = this.xToFreq(this.mousePos.x);
        
        // Emit frequency click event
        document.dispatchEvent(new CustomEvent('frequencyClick', {
            detail: { frequency: freq * 1e6 } // Convert to Hz
        }));
    }
    
    /**
     * Touch event handlers
     */
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.updateMousePosition(e.touches[0]);
            this.isMouseDown = true;
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.updateMousePosition(e.touches[0]);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.isMouseDown = false;
    }
    
    /**
     * Update mouse position
     */
    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
    }
    
    /**
     * Add frequency marker
     */
    addMarker(frequency, label, color) {
        this.markers.push({
            frequency: frequency,
            label: label,
            color: color
        });
    }
    
    /**
     * Remove all markers
     */
    clearMarkers() {
        this.markers = [];
    }
    
    /**
     * Update chart settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
    
    /**
     * Destroy chart and cleanup
     */
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.isDestroyed = true;
        this.spectrumData = null;
        this.frequencyData = null;
        this.markers = [];
        
        console.log('Spectrum chart destroyed');
    }
}

/**
 * Waterfall chart class for time-frequency display
 */
class WaterfallChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with ID ${canvasId} not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.isDestroyed = false;
        
        // Waterfall data
        this.waterfallData = [];
        this.maxLines = 200;
        this.currentLine = 0;
        
        // Settings
        this.settings = {
            backgroundColor: '#000000',
            minDb: -100,
            maxDb: 0,
            colormap: 'viridis',
            ...options
        };
        
        // Color mapping
        this.colorPalette = this.generateColorPalette();
        
        this.initializeCanvas();
        this.bindEvents();
    }
    
    /**
     * Initialize canvas
     */
    initializeCanvas() {
        this.resizeCanvas();
        this.clearCanvas();
    }
    
    /**
     * Resize canvas to fit container
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Update max lines based on canvas height
        this.maxLines = Math.max(rect.height, 200);
    }
    
    /**
     * Bind events
     */
    bindEvents() {
        document.addEventListener('spectrumData', (event) => {
            if (!this.isDestroyed) {
                this.updateWaterfall(event.detail);
            }
        });
        
        window.addEventListener('resize', () => {
            if (!this.isDestroyed) {
                this.resizeCanvas();
            }
        });
    }
    
    /**
     * Generate color palette for waterfall
     */
    generateColorPalette() {
        const palette = [];
        const steps = 256;
        
        for (let i = 0; i < steps; i++) {
            const ratio = i / (steps - 1);
            let r, g, b;
            
            if (this.settings.colormap === 'viridis') {
                // Viridis colormap approximation
                r = Math.round(255 * (0.267 + 0.004 * ratio + 0.329 * ratio * ratio));
                g = Math.round(255 * (0.004 + 0.635 * ratio + 0.039 * ratio * ratio));
                b = Math.round(255 * (0.329 + 0.184 * ratio + 0.640 * ratio * ratio));
            } else {
                // Default blue-to-red colormap
                if (ratio < 0.5) {
                    r = 0;
                    g = Math.round(255 * (ratio * 2));
                    b = Math.round(255 * (1 - ratio * 2));
                } else {
                    r = Math.round(255 * ((ratio - 0.5) * 2));
                    g = Math.round(255 * (1 - (ratio - 0.5) * 2));
                    b = 0;
                }
            }
            
            palette.push(`rgb(${r}, ${g}, ${b})`);
        }
        
        return palette;
    }
    
    /**
     * Update waterfall with new spectrum data
     */
    updateWaterfall(data) {
        if (!data || !data.powers) return;
        
        // Add new line to waterfall
        this.waterfallData.push(data.powers);
        
        // Remove old lines if we have too many
        if (this.waterfallData.length > this.maxLines) {
            this.waterfallData.shift();
        }
        
        this.draw();
    }
    
    /**
     * Draw waterfall
     */
    draw() {
        if (!this.ctx || this.isDestroyed) return;
        
        this.clearCanvas();
        
        if (this.waterfallData.length === 0) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const lineHeight = Math.max(1, height / this.waterfallData.length);
        
        // Create image data
        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Fill image data
        for (let lineIndex = 0; lineIndex < this.waterfallData.length; lineIndex++) {
            const line = this.waterfallData[lineIndex];
            const y = Math.floor(lineIndex * lineHeight);
            
            for (let x = 0; x < width; x++) {
                const binIndex = Math.floor((x / width) * line.length);
                const power = line[binIndex];
                
                // Normalize power to 0-255
                const normalizedPower = Math.max(0, Math.min(255, 
                    Math.floor(((power - this.settings.minDb) / (this.settings.maxDb - this.settings.minDb)) * 255)
                ));
                
                // Get color from palette
                const color = this.powerToColor(normalizedPower);
                
                // Fill pixels for this line
                for (let dy = 0; dy < Math.ceil(lineHeight); dy++) {
                    const pixelY = y + dy;
                    if (pixelY >= height) break;
                    
                    const pixelIndex = (pixelY * width + x) * 4;
                    data[pixelIndex] = color.r;     // R
                    data[pixelIndex + 1] = color.g; // G
                    data[pixelIndex + 2] = color.b; // B
                    data[pixelIndex + 3] = 255;     // A
                }
            }
        }
        
        // Put image data to canvas
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Convert power level to color
     */
    powerToColor(power) {
        const colorIndex = Math.floor(power);
        const colorStr = this.colorPalette[colorIndex] || this.colorPalette[0];
        
        // Parse RGB values
        const matches = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (matches) {
            return {
                r: parseInt(matches[1]),
                g: parseInt(matches[2]),
                b: parseInt(matches[3])
            };
        }
        
        return { r: 0, g: 0, b: 0 };
    }
    
    /**
     * Clear canvas
     */
    clearCanvas() {
        this.ctx.fillStyle = this.settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Clear waterfall data
     */
    clearWaterfall() {
        this.waterfallData = [];
        this.clearCanvas();
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Regenerate color palette if colormap changed
        if (newSettings.colormap) {
            this.colorPalette = this.generateColorPalette();
        }
    }
    
    /**
     * Destroy waterfall chart
     */
    destroy() {
        this.isDestroyed = true;
        this.waterfallData = [];
        console.log('Waterfall chart destroyed');
    }
}

// Export classes
window.SpectrumChart = SpectrumChart;
window.WaterfallChart = WaterfallChart;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpectrumChart, WaterfallChart };
}