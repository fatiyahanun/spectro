/**
 * WebSocket client for real-time communication with RTL-SDR backend
 * Handles connection, reconnection, and message routing
 */
class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = window.appConfig?.get('reconnect_attempts') || 10;
        this.reconnectDelay = window.appConfig?.get('reconnect_delay') || 1000;
        this.listeners = {};
        this.isConnected = false;
        this.isReconnecting = false;
        this.isManuallyDisconnected = false;
        this.messageQueue = [];
        this.lastPingTime = 0;
        this.pingInterval = null;
        this.connectionTimeout = null;
        
        // Statistics
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            reconnectCount: 0,
            lastConnected: null,
            lastDisconnected: null,
            totalDowntime: 0
        };
        
        this.connect();
    }
    
    /**
     * Establish WebSocket connection
     */
    connect() {
        if (this.isReconnecting || this.isManuallyDisconnected) {
            return;
        }
        
        try {
            console.log('Connecting to WebSocket:', this.url);
            
            // Clear any existing connection timeout
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
            }
            
            this.ws = new WebSocket(this.url);
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                    console.warn('WebSocket connection timeout');
                    this.ws.close();
                }
            }, 10000); // 10 second timeout
            
            this.ws.onopen = (event) => {
                console.log('WebSocket connected');
                
                // Clear connection timeout
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                
                this.isConnected = true;
                this.isReconnecting = false;
                this.reconnectAttempts = 0;
                this.stats.lastConnected = new Date();
                
                // Send queued messages
                this.flushMessageQueue();
                
                // Start ping interval
                this.startPingInterval();
                
                this.emit('connected', {
                    timestamp: Date.now(),
                    reconnectCount: this.stats.reconnectCount,
                    url: this.url
                });
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event);
            };
            
            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                
                // Clear connection timeout
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                    this.connectionTimeout = null;
                }
                
                this.isConnected = false;
                this.stats.lastDisconnected = new Date();
                
                // Stop ping interval
                this.stopPingInterval();
                
                this.emit('disconnected', {
                    timestamp: Date.now(),
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                });
                
                // Attempt to reconnect unless manually disconnected
                if (!this.isManuallyDisconnected) {
                    this.scheduleReconnect();
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                
                this.emit('error', {
                    timestamp: Date.now(),
                    error: error,
                    readyState: this.ws ? this.ws.readyState : null
                });
            };
            
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.emit('error', {
                timestamp: Date.now(),
                error: error,
                phase: 'connection'
            });
        }
    }
    
    /**
     * Handle incoming WebSocket message
     */
    handleMessage(event) {
        try {
            this.stats.messagesReceived++;
            
            // Handle ping/pong messages
            if (event.data === 'ping') {
                this.send('pong');
                return;
            }
            
            if (event.data === 'pong') {
                this.lastPingTime = Date.now();
                return;
            }
            
            // Parse JSON message
            const data = JSON.parse(event.data);
            
            // Add timestamp if not present
            if (!data.timestamp) {
                data.timestamp = Date.now();
            }
            
            // Emit the message based on its type
            this.emit(data.type || 'message', data);
            
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.emit('error', {
                timestamp: Date.now(),
                error: error,
                rawData: event.data,
                phase: 'message_parsing'
            });
        }
    }
    
    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.isReconnecting || this.isManuallyDisconnected) {
            return;
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Maximum reconnection attempts reached');
            this.emit('max_reconnect_attempts_reached', {
                attempts: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts
            });
            return;
        }
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        this.stats.reconnectCount++;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            30000 // Max 30 seconds
        );
        
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        this.emit('reconnecting', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay: delay
        });
        
        setTimeout(() => {
            if (!this.isManuallyDisconnected) {
                this.connect();
            }
        }, delay);
    }
    
    /**
     * Send message to WebSocket
     */
    send(data) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(message);
                this.stats.messagesSent++;
                return true;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                this.emit('error', {
                    timestamp: Date.now(),
                    error: error,
                    phase: 'message_sending'
                });
                return false;
            }
        } else {
            // Queue message for later sending
            if (typeof data === 'object') {
                this.messageQueue.push(data);
            }
            console.warn('WebSocket not connected, message queued');
            return false;
        }
    }
    
    /**
     * Send queued messages
     */
    flushMessageQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }
        
        console.log(`Sending ${this.messageQueue.length} queued messages`);
        
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        
        messages.forEach(message => {
            this.send(message);
        });
    }
    
    /**
     * Start ping interval to keep connection alive
     */
    startPingInterval() {
        this.stopPingInterval();
        
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping');
                
                // Check if we received a pong within reasonable time
                setTimeout(() => {
                    const timeSinceLastPing = Date.now() - this.lastPingTime;
                    if (timeSinceLastPing > 10000) { // 10 seconds
                        console.warn('No pong received, connection may be dead');
                        this.close();
                    }
                }, 5000); // Wait 5 seconds for pong
            }
        }, 30000); // Ping every 30 seconds
    }
    
    /**
     * Stop ping interval
     */
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    
    /**
     * Remove all event listeners for an event
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners[event] = [];
        } else {
            this.listeners = {};
        }
    }
    
    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in WebSocket event callback for '${event}':`, error);
                }
            });
        }
    }
    
    /**
     * Close WebSocket connection
     */
    close() {
        this.isManuallyDisconnected = true;
        this.isReconnecting = false;
        
        this.stopPingInterval();
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        console.log('WebSocket manually disconnected');
    }
    
    /**
     * Reconnect WebSocket
     */
    reconnect() {
        this.close();
        this.isManuallyDisconnected = false;
        this.reconnectAttempts = 0;
        this.connect();
    }
    
    /**
     * Get connection state
     */
    getConnectionState() {
        if (!this.ws) return 'CLOSED';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'CONNECTING';
            case WebSocket.OPEN:
                return 'OPEN';
            case WebSocket.CLOSING:
                return 'CLOSING';
            case WebSocket.CLOSED:
                return 'CLOSED';
            default:
                return 'UNKNOWN';
        }
    }
    
    /**
     * Get connection statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentState: this.getConnectionState(),
            isConnected: this.isConnected,
            isReconnecting: this.isReconnecting,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            messageQueueLength: this.messageQueue.length,
            url: this.url
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            reconnectCount: 0,
            lastConnected: null,
            lastDisconnected: null,
            totalDowntime: 0
        };
    }
    
    /**
     * Set new URL and reconnect
     */
    setUrl(newUrl) {
        if (this.url === newUrl) {
            return;
        }
        
        this.url = newUrl;
        console.log('WebSocket URL changed to:', newUrl);
        
        if (this.isConnected || this.isReconnecting) {
            this.reconnect();
        }
    }
    
    /**
     * Send request with response handling
     */
    async sendRequest(type, data = {}, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            const request = {
                type: type,
                id: requestId,
                timestamp: Date.now(),
                ...data
            };
            
            // Set up response handler
            const responseHandler = (response) => {
                if (response.id === requestId) {
                    this.off('response', responseHandler);
                    if (timeoutTimer) {
                        clearTimeout(timeoutTimer);
                    }
                    resolve(response);
                }
            };
            
            // Set up timeout
            const timeoutTimer = setTimeout(() => {
                this.off('response', responseHandler);
                reject(new Error(`Request timeout: ${type}`));
            }, timeout);
            
            this.on('response', responseHandler);
            
            // Send request
            if (!this.send(request)) {
                this.off('response', responseHandler);
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                }
                reject(new Error('Failed to send request'));
            }
        });
    }
    
    /**
     * Check if WebSocket is healthy
     */
    isHealthy() {
        return this.isConnected && 
               this.ws && 
               this.ws.readyState === WebSocket.OPEN &&
               !this.isReconnecting;
    }
    
    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            url: this.url,
            state: this.getConnectionState(),
            isConnected: this.isConnected,
            isReconnecting: this.isReconnecting,
            isManuallyDisconnected: this.isManuallyDisconnected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            messageQueueLength: this.messageQueue.length,
            stats: this.getStats(),
            listeners: Object.keys(this.listeners).reduce((acc, key) => {
                acc[key] = this.listeners[key].length;
                return acc;
            }, {})
        };
    }
}

// Export for use in other modules
window.WebSocketClient = WebSocketClient;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketClient;
}