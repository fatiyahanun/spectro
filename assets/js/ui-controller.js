/**
 * UI Controller for managing user interface interactions
 * Handles controls, settings, and user interactions
 */
class UIController {
    constructor() {
        this.elements = {};
        this.state = {
            isRecording: false,
            currentFrequency: 100e6,
            currentSampleRate: 2.4e6,
            currentGain: 'auto',
            autoRefresh: true,
            showWaterfall: true
        };
        this.config = null;
        this.lastConfigFetch = 0;
        this.notificationTimeout = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
    }
    
    /**
     * Initialize UI elements
     */
    initializeElements() {
        // Main controls
        this.elements.centerFreq = document.getElementById('centerFreq');
        this.elements.sampleRate = document.getElementById('sampleRate');
        this.elements.gainSelect = document.getElementById('gainSelect');
        this.elements.updateFreq = document.getElementById('updateFreq');
        this.elements.updateGain = document.getElementById('updateGain');
        
        // Recording controls
        this.elements.startRecording = document.getElementById('startRecording');
        this.elements.stopRecording = document.getElementById('stopRecording');
        this.elements.recordingStatus = document.getElementById('recordingStatus');
        
        // Status indicators
        this.elements.connectionStatus = document.getElementById('connectionStatus');
        this.elements.frequencyInfo = document.getElementById('frequencyInfo');
        this.elements.sampleRateInfo = document.getElementById('sampleRateInfo');
        this.elements.lnbInfo = document.getElementById('lnbInfo');
        this.elements.recordingInfo = document.getElementById('recordingInfo');
        
        // Settings modal elements
        this.elements.backendUrl = document.getElementById('backendUrl');
        this.elements.websocketUrl = document.getElementById('websocketUrl');
        this.elements.updateInterval = document.getElementById('updateInterval');
        this.elements.fftSize = document.getElementById('fftSize');
        this.elements.showWaterfall = document.getElementById('showWaterfall');
        this.elements.autoRefresh = document.getElementById('autoRefresh');
        this.elements.saveSettings = document.getElementById('saveSettings');
        
        // Device modal elements
        this.elements.deviceIndex = document.getElementById('deviceIndex');
        this.elements.lnbLo = document.getElementById('lnbLo');
        this.elements.lnbPreset = document.getElementById('lnbPreset');
        this.elements.biasTee = document.getElementById('biasTee');
        this.elements.ppmError = document.getElementById('ppmError');
        this.elements.applyDevice = document.getElementById('applyDevice');
        
        // Dashboard elements
        this.elements.backendStatus = document.getElementById('backendStatus');
        this.elements.websocketStatus = document.getElementById('websocketStatus');
        this.elements.deviceStatus = document.getElementById('deviceStatus');
        this.elements.deviceName = document.getElementById('deviceName');
        this.elements.currentFreq = document.getElementById('currentFreq');
        this.elements.currentSampleRate = document.getElementById('currentSampleRate');
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Frequency update
        if (this.elements.updateFreq) {
            this.elements.updateFreq.addEventListener('click', () => {
                this.updateFrequency();
            });
        }
        
        // Sample rate update
        if (this.elements.sampleRate) {
            this.elements.sampleRate.addEventListener('change', () => {
                this.updateSampleRate();
            });
        }
        
        // Gain update
        if (this.elements.updateGain) {
            this.elements.updateGain.addEventListener('click', () => {
                this.updateGain();
            });
        }
        
        // Recording controls
        if (this.elements.startRecording) {
            this.elements.startRecording.addEventListener('click', () => {
                this.startRecording();
            });
        }
        
        if (this.elements.stopRecording) {
            this.elements.stopRecording.addEventListener('click', () => {
                this.stopRecording();
            });
        }
        
        // Settings
        if (this.elements.saveSettings) {
            this.elements.saveSettings.addEventListener('click', () => {
                this.saveSettings();
            });
        }
        
        // Device settings
        if (this.elements.applyDevice) {
            this.elements.applyDevice.addEventListener('click', () => {
                this.applyDeviceSettings();
            });
        }
        
        // Enter key for frequency input
        if (this.elements.centerFreq) {
            this.elements.centerFreq.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.updateFrequency();
                }
            });
        }
        
        // Waterfall toggle
        if (this.elements.showWaterfall) {
            this.elements.showWaterfall.addEventListener('change', (e) => {
                this.toggleWaterfall(e.target.checked);
            });
        }
        
        // Auto refresh toggle
        if (this.elements.autoRefresh) {
            this.elements.autoRefresh.addEventListener('change', (e) => {
                this.state.autoRefresh = e.target.checked;
            });
        }
        
        // Frequency click from spectrum chart
        document.addEventListener('frequencyClick', (e) => {
            this.handleFrequencyClick(e.detail.frequency);
        });
        
        // Configuration events
        document.addEventListener('configLoaded', () => {
            this.loadCurrentSettings();
        });
        
        document.addEventListener('configChanged', () => {
            this.loadCurrentSettings();
        });
    }
    
    /**
     * Load saved settings
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('ui_controller_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.state = { ...this.state, ...settings };
            }
        } catch (error) {
            console.warn('Error loading UI settings:', error);
        }
    }
    
    /**
     * Save current settings
     */
    saveCurrentSettings() {
        try {
            localStorage.setItem('ui_controller_settings', JSON.stringify(this.state));
        } catch (error) {
            console.warn('Error saving UI settings:', error);
        }
    }
    
    /**
     * Update frequency
     */
    async updateFrequency() {
        if (!this.elements.centerFreq) return;
        
        const frequency = parseFloat(this.elements.centerFreq.value);
        if (isNaN(frequency) || frequency <= 0) {
            this.showNotification('Invalid frequency', 'error');
            return;
        }
        
        try {
            const freqHz = frequency * 1e6; // Convert MHz to Hz
            const result = await window.spectroApp.setFrequency(freqHz);
            
            if (result.success) {
                this.state.currentFrequency = freqHz;
                this.showNotification('Frequency updated', 'success');
                this.updateFrequencyDisplay(freqHz);
                this.saveCurrentSettings();
            } else {
                this.showNotification('Failed to update frequency: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error updating frequency:', error);
            this.showNotification('Error updating frequency', 'error');
        }
    }
    
    /**
     * Update sample rate
     */
    async updateSampleRate() {
        if (!this.elements.sampleRate) return;
        
        const sampleRate = parseFloat(this.elements.sampleRate.value);
        if (isNaN(sampleRate) || sampleRate <= 0) {
            this.showNotification('Invalid sample rate', 'error');
            return;
        }
        
        try {
            const sampleRateHz = sampleRate * 1e6; // Convert MHz to Hz
            const result = await window.spectroApp.setSampleRate(sampleRateHz);
            
            if (result.success) {
                this.state.currentSampleRate = sampleRateHz;
                this.showNotification('Sample rate updated', 'success');
                this.updateSampleRateDisplay(sampleRateHz);
                this.saveCurrentSettings();
            } else {
                this.showNotification('Failed to update sample rate: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error updating sample rate:', error);
            this.showNotification('Error updating sample rate', 'error');
        }
    }
    
    /**
     * Update gain
     */
    async updateGain() {
        if (!this.elements.gainSelect) return;
        
        const gain = this.elements.gainSelect.value;
        
        try {
            const result = await window.spectroApp.setGain(gain);
            
            if (result.success) {
                this.state.currentGain = gain;
                this.showNotification('Gain updated', 'success');
                this.saveCurrentSettings();
            } else {
                this.showNotification('Failed to update gain: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error updating gain:', error);
            this.showNotification('Error updating gain', 'error');
        }
    }
    
    /**
     * Start recording
     */
    async startRecording() {
        if (this.state.isRecording) return;
        
        try {
            const result = await window.spectroApp.startRecording();
            
            if (result.success) {
                this.state.isRecording = true;
                this.updateRecordingUI(true);
                this.showNotification('Recording started', 'success');
                this.saveCurrentSettings();
            } else {
                this.showNotification('Failed to start recording: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showNotification('Error starting recording', 'error');
        }
    }
    
    /**
     * Stop recording
     */
    async stopRecording() {
        if (!this.state.isRecording) return;
        
        try {
            const result = await window.spectroApp.stopRecording();
            
            if (result.success) {
                this.state.isRecording = false;
                this.updateRecordingUI(false);
                this.showNotification('Recording stopped', 'success');
                this.saveCurrentSettings();
            } else {
                this.showNotification('Failed to stop recording: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.showNotification('Error stopping recording', 'error');
        }
    }
    
    /**
     * Update recording UI state
     */
    updateRecordingUI(isRecording) {
        if (this.elements.startRecording) {
            this.elements.startRecording.disabled = isRecording;
        }
        
        if (this.elements.stopRecording) {
            this.elements.stopRecording.disabled = !isRecording;
        }
        
        if (this.elements.recordingStatus) {
            this.elements.recordingStatus.textContent = isRecording ? 'Recording' : 'Live Only';
            this.elements.recordingStatus.className = isRecording ? 'badge bg-danger' : 'badge bg-secondary';
        }
        
        if (this.elements.recordingInfo) {
            this.elements.recordingInfo.style.display = isRecording ? 'block' : 'none';
        }
    }
    
    /**
     * Update connection status
     */
    updateConnectionStatus(connected, customMessage = null) {
        const statusText = customMessage || (connected ? 'Connected' : 'Disconnected');
        const statusClass = connected ? 'badge bg-success' : 'badge bg-danger';
        
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = statusText;
            this.elements.connectionStatus.className = statusClass;
        }
        
        // Update dashboard status indicators
        if (this.elements.backendStatus) {
            this.elements.backendStatus.textContent = statusText;
            this.elements.backendStatus.className = connected ? 'text-success' : 'text-danger';
        }
        
        if (this.elements.websocketStatus) {
            this.elements.websocketStatus.textContent = statusText;
            this.elements.websocketStatus.className = connected ? 'text-success' : 'text-danger';
        }
        
        // Update status indicators in other pages
        const statusElements = document.querySelectorAll('.connection-status');
        const statusIndicators = document.querySelectorAll('.status-indicator');
        
        statusElements.forEach(el => {
            const textEl = el.querySelector('#connectionText') || el;
            textEl.textContent = statusText;
            el.className = `connection-status ${connected ? 'text-success' : 'text-danger'}`;
        });
        
        statusIndicators.forEach(el => {
            el.className = `status-indicator ${connected ? '' : 'disconnected'}`;
        });
    }
    
    /**
     * Update frequency display
     */
    updateFrequencyDisplay(frequency) {
        if (this.elements.frequencyInfo) {
            const freqMHz = frequency / 1e6;
            this.elements.frequencyInfo.textContent = `Center: ${freqMHz.toFixed(3)} MHz`;
        }
        
        if (this.elements.currentFreq) {
            const freqMHz = frequency / 1e6;
            this.elements.currentFreq.textContent = `${freqMHz.toFixed(3)} MHz`;
        }
    }
    
    /**
     * Update sample rate display
     */
    updateSampleRateDisplay(sampleRate) {
        if (this.elements.sampleRateInfo) {
            const sampleRateMHz = sampleRate / 1e6;
            this.elements.sampleRateInfo.textContent = `Sample Rate: ${sampleRateMHz.toFixed(1)} MS/s`;
        }
        
        if (this.elements.currentSampleRate) {
            const sampleRateMHz = sampleRate / 1e6;
            this.elements.currentSampleRate.textContent = `${sampleRateMHz.toFixed(1)} MS/s`;
        }
    }
    
    /**
     * Update LNB display
     */
    updateLNBDisplay(lnbFreq) {
        if (this.elements.lnbInfo) {
            if (lnbFreq > 0) {
                this.elements.lnbInfo.textContent = `LNB LO: ${lnbFreq} MHz`;
                this.elements.lnbInfo.style.display = 'block';
            } else {
                this.elements.lnbInfo.style.display = 'none';
            }
        }
    }
    
    /**
     * Toggle waterfall display
     */
    toggleWaterfall(show) {
        const waterfallContainer = document.querySelector('.waterfall-container');
        if (waterfallContainer) {
            waterfallContainer.style.display = show ? 'block' : 'none';
        }
        
        this.state.showWaterfall = show;
        this.saveCurrentSettings();
    }
    
    /**
     * Handle frequency click from spectrum chart
     */
    handleFrequencyClick(frequency) {
        if (this.elements.centerFreq) {
            this.elements.centerFreq.value = (frequency / 1e6).toFixed(3);
            this.showNotification(`Frequency set to ${(frequency / 1e6).toFixed(3)} MHz`, 'info');
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Clear existing notification
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(el => el.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi bi-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        this.notificationTimeout = setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    /**
     * Save settings to backend and localStorage
     */
    saveSettings() {
        if (!window.appConfig) return;
        
        const backendUrl = this.elements.backendUrl?.value;
        const websocketUrl = this.elements.websocketUrl?.value;
        const updateInterval = parseInt(this.elements.updateInterval?.value);
        const fftSize = parseInt(this.elements.fftSize?.value);
        const showWaterfall = this.elements.showWaterfall?.checked;
        const autoRefresh = this.elements.autoRefresh?.checked;
        
        if (backendUrl) {
            window.appConfig.setBackendUrl(backendUrl);
        }
        
        if (websocketUrl) {
            window.appConfig.setWebSocketUrl(websocketUrl);
        }
        
        if (updateInterval && updateInterval > 0) {
            window.appConfig.setUpdateInterval(updateInterval);
        }
        
        if (showWaterfall !== undefined) {
            window.appConfig.setShowWaterfall(showWaterfall);
            this.toggleWaterfall(showWaterfall);
        }
        
        if (autoRefresh !== undefined) {
            window.appConfig.setAutoRefresh(autoRefresh);
            this.state.autoRefresh = autoRefresh;
        }
        
        this.saveCurrentSettings();
        this.showNotification('Settings saved. Some changes may require page refresh.', 'success');
    }
    
    /**
     * Apply device settings
     */
    async applyDeviceSettings() {
        const deviceIndex = parseInt(this.elements.deviceIndex?.value);
        const lnbLo = parseFloat(this.elements.lnbLo?.value);
        const biasTee = this.elements.biasTee?.checked;
        const ppmError = parseFloat(this.elements.ppmError?.value);
        
        try {
            // Apply device settings
            if (!isNaN(deviceIndex) && window.spectroApp) {
                await window.spectroApp.apiCall('/api/device', 'POST', { index: deviceIndex });
            }
            
            if (!isNaN(lnbLo) && window.spectroApp) {
                await window.spectroApp.apiCall('/api/lnb', 'POST', { lo_frequency: lnbLo * 1e6 });
                this.updateLNBDisplay(lnbLo);
            }
            
            if (typeof biasTee === 'boolean' && window.spectroApp) {
                await window.spectroApp.apiCall('/api/bias_tee', 'POST', { enabled: biasTee });
            }
            
            if (!isNaN(ppmError) && window.spectroApp) {
                await window.spectroApp.apiCall('/api/ppm_error', 'POST', { ppm: ppmError });
            }
            
            this.showNotification('Device settings applied', 'success');
            
        } catch (error) {
            console.error('Error applying device settings:', error);
            this.showNotification('Error applying device settings', 'error');
        }
    }
    
    /**
     * Load current settings from backend
     */
    async loadCurrentSettings() {
        try {
            if (!window.spectroApp) return;
            
            const config = await window.spectroApp.getConfig();
            this.config = config;
            
            // Update UI elements with current values
            if (this.elements.centerFreq && config.frequency?.center) {
                this.elements.centerFreq.value = (config.frequency.center / 1e6).toFixed(3);
                this.state.currentFrequency = config.frequency.center;
            }
            
            if (this.elements.sampleRate && config.frequency?.sample_rate) {
                this.elements.sampleRate.value = (config.frequency.sample_rate / 1e6).toFixed(1);
                this.state.currentSampleRate = config.frequency.sample_rate;
            }
            
            if (this.elements.gainSelect && config.gain) {
                this.elements.gainSelect.value = config.gain.current;
                this.state.currentGain = config.gain.current;
            }
            
            if (this.elements.deviceIndex && config.device?.index !== undefined) {
                this.elements.deviceIndex.value = config.device.index;
            }
            
            if (this.elements.lnbLo && config.lnb?.lo_frequency) {
                this.elements.lnbLo.value = (config.lnb.lo_frequency / 1e6).toFixed(1);
            }
            
            if (this.elements.biasTee && config.bias_tee !== undefined) {
                this.elements.biasTee.checked = config.bias_tee;
            }
            
            if (this.elements.ppmError && config.ppm_error !== undefined) {
                this.elements.ppmError.value = config.ppm_error;
            }
            
            // Update settings modal
            if (this.elements.backendUrl && window.appConfig) {
                this.elements.backendUrl.value = window.appConfig.getBackendUrl();
            }
            
            if (this.elements.websocketUrl && window.appConfig) {
                this.elements.websocketUrl.value = window.appConfig.getWebSocketUrl();
            }
            
            if (this.elements.updateInterval && window.appConfig) {
                this.elements.updateInterval.value = window.appConfig.getUpdateInterval();
            }
            
            if (this.elements.showWaterfall && window.appConfig) {
                this.elements.showWaterfall.checked = window.appConfig.getShowWaterfall();
            }
            
            if (this.elements.autoRefresh && window.appConfig) {
                this.elements.autoRefresh.checked = window.appConfig.getAutoRefresh();
            }
            
            // Update displays
            this.updateFrequencyDisplay(config.frequency?.center || 100e6);
            this.updateSampleRateDisplay(config.frequency?.sample_rate || 2.4e6);
            this.updateLNBDisplay((config.lnb?.lo_frequency || 0) / 1e6);
            
            // Update device status
            if (this.elements.deviceStatus) {
                this.elements.deviceStatus.textContent = config.device?.connected ? 'Connected' : 'Disconnected';
                this.elements.deviceStatus.className = config.device?.connected ? 'text-success' : 'text-danger';
            }
            
            if (this.elements.deviceName) {
                this.elements.deviceName.textContent = config.device?.name || 'RTL-SDR';
            }
            
        } catch (error) {
            console.error('Error loading current settings:', error);
        }
    }
    
    /**
     * Request immediate spectrum update
     */
    requestImmediateSpectrumUpdate() {
        if (window.spectroApp) {
            window.spectroApp.apiCall('/api/spectrum/update', 'POST')
                .catch(error => {
                    console.log('Error requesting spectrum update:', error);
                });
        }
    }
    
    /**
     * Get current UI state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Set UI state
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.saveCurrentSettings();
    }
    
    /**
     * Cleanup and destroy
     */
    destroy() {
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        
        // Remove event listeners
        document.removeEventListener('frequencyClick', this.handleFrequencyClick);
        document.removeEventListener('configLoaded', this.loadCurrentSettings);
        document.removeEventListener('configChanged', this.loadCurrentSettings);
        
        console.log('UI Controller destroyed');
    }
}

// Export class
window.UIController = UIController;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}