/**
 * Main application logic for RTL-SDR Spectrum Analyzer
 * Coordinates all components and handles application lifecycle
 */
class SpectroApp {
    constructor() {
        this.config = window.appConfig;
        this.ws = null;
        this.isConnected = false;
        this.currentData = null;
        this.uiController = null;
        this.spectrumChart = null;
        this.waterfallChart = null;
        this.connectionCheckInterval = null;
        this.healthCheckInterval = null;
        this.isInitialized = false;
        
        // Application state
        this.state = {
            isRecording: false,
            lastDataTime: 0,
            connectionAttempts: 0,
            lastHealthCheck: 0,
            dataRate: 0,
            messageCount: 0
        };
        
        // Performance monitoring
        this.performance = {
            lastFrameTime: 0,
            frameCount: 0,
            fps: 0,
            avgDataRate: 0,
            peakDataRate: 0
        };
        
        this.initializeApp();
    }
    
    /**
     * Initialize the application
     */
    async initializeApp() {
        console.log('Initializing Spectro App...');
        
        try {
            // Wait for configuration to load
            await this.waitForConfig();
            
            // Initialize UI controller
            this.initializeUIController();
            
            // Initialize charts based on current page
            this.initializeChartsIfNeeded();
            
            // Initialize WebSocket connection
            this.initializeWebSocket();
            
            // Load current settings
            await this.loadCurrentSettings();
            
            // Start periodic checks
            this.startPeriodicChecks();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('Spectro App initialized successfully');
            
            // Dispatch initialization complete event
            document.dispatchEvent(new CustomEvent('appInitialized', { detail: this }));
            
        } catch (error) {
            console.error('Failed to initialize Spectro App:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * Wait for configuration to load
     */
    async waitForConfig() {
        if (!this.config) {
            console.error('AppConfig not available');
            return;
        }
        
        // Wait for config to be loaded
        await this.config.waitForLoad();
        console.log('Configuration loaded');
    }
    
    /**
     * Initialize UI controller
     */
    initializeUIController() {
        if (typeof UIController !== 'undefined') {
            this.uiController = new UIController();
            console.log('UI Controller initialized');
        } else {
            console.warn('UIController not available');
        }
    }
    
    /**
     * Initialize charts based on current page
     */
    initializeChartsIfNeeded() {
        // Initialize spectrum chart if canvas exists
        const spectrumCanvas = document.getElementById('spectrumCanvas');
        if (spectrumCanvas && typeof SpectrumChart !== 'undefined') {
            this.spectrumChart = new SpectrumChart('spectrumCanvas', {
                backgroundColor: '#111111',
                spectrumColor: '#00ff00',
                showGrid: true,
                showLabels: true
            });
            console.log('Spectrum chart initialized');
        }
        
        // Initialize waterfall chart if canvas exists
        const waterfallCanvas = document.getElementById('waterfallCanvas');
        if (waterfallCanvas && typeof WaterfallChart !== 'undefined') {
            this.waterfallChart = new WaterfallChart('waterfallCanvas', {
                backgroundColor: '#000000',
                colormap: 'viridis',
                maxLines: 200
            });
            console.log('Waterfall chart initialized');
        }
        
        // Initialize history chart if canvas exists
        const historyCanvas = document.getElementById('historyChart');
        if (historyCanvas && typeof SpectrumChart !== 'undefined') {
            this.historyChart = new SpectrumChart('historyChart', {
                backgroundColor: '#ffffff',
                spectrumColor: '#0066cc',
                textColor: '#000000',
                showGrid: true,
                showLabels: true
            });
            console.log('History chart initialized');
        }
    }
    
    /**
     * Initialize WebSocket connection
     */
    initializeWebSocket() {
        if (!this.config) {
            console.error('Cannot initialize WebSocket without configuration');
            return;
        }
        
        const wsUrl = this.config.getWebSocketUrl();
        
        if (typeof WebSocketClient !== 'undefined') {
            this.ws = new WebSocketClient(wsUrl);
            this.bindWebSocketEvents();
            console.log('WebSocket client initialized');
        } else {
            console.error('WebSocketClient not available');
        }
    }
    
    /**
     * Bind WebSocket events
     */
    bindWebSocketEvents() {
        if (!this.ws) return;
        
        this.ws.on('connected', (data) => {
            console.log('Connected to backend:', data);
            this.isConnected = true;
            this.state.connectionAttempts = 0;
            this.updateConnectionStatus(true);
            this.requestInitialData();
        });
        
        this.ws.on('disconnected', (data) => {
            console.log('Disconnected from backend:', data);
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });
        
        this.ws.on('reconnecting', (data) => {
            console.log(`Reconnecting... (${data.attempt}/${data.maxAttempts})`);
            this.state.connectionAttempts = data.attempt;
            this.updateConnectionStatus(false, `Reconnecting (${data.attempt}/${data.maxAttempts})`);
        });
        
        this.ws.on('spectrum', (data) => {
            this.handleSpectrumData(data);
        });
        
        this.ws.on('config', (data) => {
            this.handleConfigUpdate(data);
        });
        
        this.ws.on('recording', (data) => {
            this.handleRecordingUpdate(data);
        });
        
        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleWebSocketError(error);
        });
        
        this.ws.on('max_reconnect_attempts_reached', () => {
            console.error('Maximum reconnection attempts reached');
            this.updateConnectionStatus(false, 'Connection Failed');
            this.handleConnectionFailure();
        });
    }
    
    /**
     * Request initial data after connection
     */
    async requestInitialData() {
        try {
            // Request current configuration
            const config = await this.getConfig();
            if (config && this.uiController) {
                this.uiController.config = config;
            }
            
            // Request immediate spectrum update
            this.requestSpectrumUpdate();
            
        } catch (error) {
            console.error('Error requesting initial data:', error);
        }
    }
    
    /**
     * Start periodic checks
     */
    startPeriodicChecks() {
        // Health check every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            this.checkBackendHealth();
        }, 30000);
        
        // Connection status check every 10 seconds
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnectionStatus();
        }, 10000);
    }
    
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        const updatePerformance = () => {
            const now = performance.now();
            
            if (this.performance.lastFrameTime > 0) {
                const deltaTime = now - this.performance.lastFrameTime;
                this.performance.frameCount++;
                
                // Calculate FPS every second
                if (deltaTime >= 1000) {
                    this.performance.fps = this.performance.frameCount;
                    this.performance.frameCount = 0;
                    this.performance.lastFrameTime = now;
                }
            } else {
                this.performance.lastFrameTime = now;
            }
            
            if (!this.isDestroyed) {
                requestAnimationFrame(updatePerformance);
            }
        };
        
        requestAnimationFrame(updatePerformance);
    }
    
    /**
     * Check backend health
     */
    async checkBackendHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.config.getBackendUrl()}/api/health`, {
                signal: controller.signal,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            const healthy = response.ok;
            this.state.lastHealthCheck = Date.now();
            
            if (!healthy && this.isConnected) {
                console.log('Backend health check failed');
                this.updateConnectionStatus(false, 'Backend Unavailable');
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Backend health check timeout');
            } else {
                console.log('Backend health check failed:', error.message);
            }
            
            if (this.isConnected) {
                this.updateConnectionStatus(false, 'Backend Unavailable');
            }
        }
    }
    
    /**
     * Check connection status
     */
    checkConnectionStatus() {
        if (this.ws) {
            const wsState = this.ws.getConnectionState();
            const isHealthy = this.ws.isHealthy();
            
            if (this.isConnected !== isHealthy) {
                this.isConnected = isHealthy;
                this.updateConnectionStatus(isHealthy);
            }
        }
    }
    
    /**
     * Update connection status across UI
     */
    updateConnectionStatus(connected, customMessage = null) {
        this.isConnected = connected;
        
        if (this.uiController) {
            this.uiController.updateConnectionStatus(connected, customMessage);
        }
        
        // Update connection text with custom message
        if (customMessage) {
            const connectionTextElements = document.querySelectorAll('#connectionText');
            connectionTextElements.forEach(el => {
                el.textContent = customMessage;
            });
        }
        
        // Dispatch connection status event
        document.dispatchEvent(new CustomEvent('connectionStatusChanged', {
            detail: { connected, message: customMessage }
        }));
    }
    
    /**
     * Handle spectrum data
     */
    handleSpectrumData(data) {
        this.currentData = data;
        this.state.lastDataTime = Date.now();
        this.state.messageCount++;
        
        // Calculate data rate
        const now = Date.now();
        if (this.state.lastDataTime > 0) {
            const timeDiff = now - this.state.lastDataTime;
            this.state.dataRate = 1000 / timeDiff; // Messages per second
            
            // Update average data rate
            this.performance.avgDataRate = (this.performance.avgDataRate * 0.9) + (this.state.dataRate * 0.1);
            
            // Update peak data rate
            if (this.state.dataRate > this.performance.peakDataRate) {
                this.performance.peakDataRate = this.state.dataRate;
            }
        }
        
        // Update UI displays
        if (this.uiController) {
            this.uiController.updateFrequencyDisplay(data.center_freq);
            this.uiController.updateSampleRateDisplay(data.sample_rate);
        }
        
        // Emit event for chart components
        document.dispatchEvent(new CustomEvent('spectrumData', { detail: data }));
    }
    
    /**
     * Handle configuration updates
     */
    handleConfigUpdate(data) {
        console.log('Configuration updated:', data);
        
        // Update UI controller config
        if (this.uiController) {
            this.uiController.config = data;
        }
        
        // Emit event for other components
        document.dispatchEvent(new CustomEvent('configUpdate', { detail: data }));
    }
    
    /**
     * Handle recording status updates
     */
    handleRecordingUpdate(data) {
        console.log('Recording status updated:', data);
        
        this.state.isRecording = data.recording;
        
        if (this.uiController) {
            this.uiController.updateRecordingUI(data.recording);
        }
        
        // Emit event for other components
        document.dispatchEvent(new CustomEvent('recordingStatusChanged', { detail: data }));
    }
    
    /**
     * Handle WebSocket errors
     */
    handleWebSocketError(error) {
        console.error('WebSocket error:', error);
        
        // Show user-friendly error message
        if (this.uiController) {
            this.uiController.showNotification('Connection error occurred', 'error');
        }
    }
    
    /**
     * Handle connection failure
     */
    handleConnectionFailure() {
        if (this.uiController) {
            this.uiController.showNotification(
                'Cannot connect to backend. Please check if the RTL-SDR server is running.',
                'error'
            );
        }
    }
    
    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        console.error('Initialization error:', error);
        
        // Show error in UI
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.style.cssText = 'position: fixed; top: 20px; left: 20px; right: 20px; z-index: 10000;';
        errorDiv.innerHTML = `
            <h4>Initialization Error</h4>
            <p>Failed to initialize the application: ${error.message}</p>
            <button type="button" class="btn btn-primary" onclick="window.location.reload()">Reload Page</button>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    /**
     * Load current settings
     */
    async loadCurrentSettings() {
        if (this.uiController) {
            await this.uiController.loadCurrentSettings();
        }
    }
    
    /**
     * Request spectrum update
     */
    requestSpectrumUpdate() {
        if (this.ws && this.ws.isConnected) {
            this.ws.send({
                type: 'request_spectrum',
                timestamp: Date.now()
            });
        }
    }
    
    // API methods for interacting with backend
    
    /**
     * Make API call to backend
     */
    async apiCall(endpoint, method = 'GET', data = null) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(`${this.config.getBackendUrl()}${endpoint}`, options);
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            console.error('API call failed:', error);
            throw error;
        }
    }
    
    /**
     * Set frequency
     */
    async setFrequency(frequency) {
        return await this.apiCall('/api/frequency', 'POST', { center: frequency });
    }
    
    /**
     * Set sample rate
     */
    async setSampleRate(sampleRate) {
        return await this.apiCall('/api/sample_rate', 'POST', { sample_rate: sampleRate });
    }
    
    /**
     * Set gain
     */
    async setGain(gain) {
        return await this.apiCall('/api/gain', 'POST', { gain: gain });
    }
    
    /**
     * Start recording
     */
    async startRecording() {
        return await this.apiCall('/api/recording/start', 'POST');
    }
    
    /**
     * Stop recording
     */
    async stopRecording() {
        return await this.apiCall('/api/recording/stop', 'POST');
    }
    
    /**
     * Get current configuration
     */
    async getConfig() {
        return await this.apiCall('/api/config');
    }
    
    /**
     * Get recording history
     */
    async getHistory() {
        return await this.apiCall('/api/history/sessions');
    }
    
    /**
     * Get specific session
     */
    async getSession(sessionId) {
        return await this.apiCall(`/api/history/session/${sessionId}`);
    }
    
    /**
     * Get application statistics
     */
    getStats() {
        return {
            app: {
                initialized: this.isInitialized,
                connected: this.isConnected,
                recording: this.state.isRecording,
                lastDataTime: this.state.lastDataTime,
                messageCount: this.state.messageCount,
                dataRate: this.state.dataRate
            },
            performance: this.performance,
            websocket: this.ws ? this.ws.getStats() : null,
            config: this.config ? this.config.getDebugInfo() : null
        };
    }
    
    /**
     * Get current application state
     */
    getState() {
        return {
            ...this.state,
            isConnected: this.isConnected,
            isInitialized: this.isInitialized,
            currentData: this.currentData
        };
    }
    
    /**
     * Restart application
     */
    async restart() {
        console.log('Restarting application...');
        
        this.destroy();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.initializeApp();
    }
    
    /**
     * Cleanup and destroy application
     */
    destroy() {
        console.log('Destroying Spectro App...');
        
        this.isDestroyed = true;
        
        // Clear intervals
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
        
        // Destroy UI controller
        if (this.uiController) {
            this.uiController.destroy();
        }
        
        // Destroy charts
        if (this.spectrumChart) {
            this.spectrumChart.destroy();
        }
        
        if (this.waterfallChart) {
            this.waterfallChart.destroy();
        }
        
        if (this.historyChart) {
            this.historyChart.destroy();
        }
        
        // Clear state
        this.currentData = null;
        this.isInitialized = false;
        this.isConnected = false;
        
        console.log('Spectro App destroyed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add some delay to ensure all scripts are loaded
    setTimeout(() => {
        window.spectroApp = new SpectroApp();
    }, 100);
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.spectroApp) {
        window.spectroApp.destroy();
    }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.spectroApp) {
        if (document.hidden) {
            console.log('Page hidden, reducing activity');
            // Could reduce update frequency here
        } else {
            console.log('Page visible, resuming normal activity');
            // Could resume normal update frequency here
        }
    }
});

// Export for use in other contexts
window.SpectroApp = SpectroApp;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpectroApp;
}