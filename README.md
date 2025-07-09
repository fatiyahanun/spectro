# RTL-SDR Spectrum Analyzer - Frontend

Frontend web interface untuk RTL-SDR Spectrum Analyzer yang dapat di-host di GitHub Pages atau web server lainnya.

## 🚀 Features

- **Dashboard**: Landing page dengan navigasi ke berbagai fitur
- **Live Spectrum**: Real-time spectrum analysis dan waterfall display
- **History**: Playback dan analisis recording session
- **Real-time Updates**: WebSocket connection untuk data real-time
- **Responsive Design**: Mobile-friendly interface
- **Customizable Settings**: Konfigurasi backend URL dan parameter lainnya

## 📁 Struktur File

```
rtlsdr-spectrum-frontend/
├── index.html                 # Dashboard (landing page)
├── live.html                  # Live spectrum analyzer
├── history.html               # History playback
├── README.md                  # Dokumentasi
├── config.json               # Konfigurasi aplikasi
├── assets/
│   ├── css/
│   │   └── style.css         # Styling utama
│   ├── js/
│   │   ├── config.js         # Manajemen konfigurasi
│   │   ├── websocket-client.js # WebSocket client
│   │   ├── spectrum-chart.js  # Chart components
│   │   ├── ui-controller.js   # UI controller
│   │   └── app.js            # Main application logic
│   └── img/
│       └── favicon.ico       # Favicon
└── .github/
    └── workflows/
        └── deploy.yml        # GitHub Actions untuk deployment
```

## 🛠️ Setup

### 1. Download/Clone Repository

```bash
git clone https://github.com/yourusername/rtlsdr-spectrum-frontend.git
cd rtlsdr-spectrum-frontend
```

### 2. Konfigurasi Backend

Edit file `config.json` untuk mengatur URL backend lokal Anda:

```json
{
  "backend_url": "http://localhost:5000",
  "websocket_url": "ws://localhost:5001",
  "app_name": "SPECTRO WEB"
}
```

### 3. Deploy ke GitHub Pages

1. Push repository ke GitHub
2. Buka Settings > Pages
3. Pilih source: Deploy from a branch
4. Pilih branch: main (atau branch yang Anda gunakan)
5. Klik Save

### 4. Akses Aplikasi

- **GitHub Pages**: `https://yourusername.github.io/rtlsdr-spectrum-frontend/`
- **Local Development**: Gunakan web server lokal (Live Server, Python HTTP server, dll)

## 🔧 Konfigurasi

### Backend Requirements

Frontend ini membutuhkan backend RTL-SDR yang menyediakan:

- **REST API endpoints**:
  - `/api/config` - Konfigurasi perangkat
  - `/api/frequency` - Set center frequency
  - `/api/sample_rate` - Set sample rate
  - `/api/gain` - Set gain
  - `/api/recording/start` - Start recording
  - `/api/recording/stop` - Stop recording
  - `/api/history/sessions` - Get recording history
  - `/api/health` - Health check

- **WebSocket server** untuk real-time updates
- **CORS support** untuk akses dari domain lain

### CORS Configuration

Backend harus mengizinkan akses dari domain frontend. Contoh untuk Flask:

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["https://yourusername.github.io"])
```

### Settings Modal

Aplikasi menyediakan settings modal untuk mengubah:
- Backend URL
- WebSocket URL
- Update interval
- Display preferences

## 📱 Penggunaan

### Dashboard
- Landing page dengan navigation cards
- Status monitor sistem
- Quick settings access

### Live Spectrum
- Real-time spectrum display
- Waterfall visualization
- Control panel untuk frequency, gain, sample rate
- Recording controls
- Preset frequencies

### History
- Daftar recording sessions
- Playback controls (play, pause, stop)
- Time slider untuk navigasi
- Export data ke CSV/JSON
- Search dan filter sessions

## 🔌 API Integration

### WebSocket Messages

Frontend mendengarkan message types:
- `spectrum` - Data spektrum real-time
- `config` - Update konfigurasi
- `recording` - Status recording
- `error` - Error notifications

### REST API Calls

```javascript
// Set frequency
await window.spectroApp.setFrequency(frequency);

// Start recording
await window.spectroApp.startRecording();

// Get history
const history = await window.spectroApp.getHistory();
```

## 🎨 Customization

### Themes
- Dark theme (default)
- Light theme
- Custom color schemes

### Chart Settings
- Spectrum colors
- Waterfall colormap
- Grid display
- Labels and markers

### UI Configuration
- Update intervals
- Display preferences
- Auto-refresh settings

## 🚧 Development

### Local Development Server

```bash
# Python
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

### JavaScript Modules

- `config.js` - Configuration management
- `websocket-client.js` - WebSocket client dengan reconnection
- `spectrum-chart.js` - Canvas-based spectrum charts
- `ui-controller.js` - UI interactions dan controls
- `app.js` - Main application coordinator

### CSS Framework

- Bootstrap 5.2.3
- Bootstrap Icons
- Custom CSS variables untuk theming

## 📊 Performance

### Optimizations
- Canvas rendering untuk charts
- WebSocket connection pooling
- Efficient data structures
- Lazy loading components

### Browser Compatibility
- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🔒 Security

### CORS
- Proper CORS headers required
- Origin restrictions recommended

### Data Validation
- Input validation di frontend
- Sanitization di backend

### WebSocket Security
- Connection timeout handling
- Automatic reconnection
- Error handling

## 🐛 Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check backend URL di config.json
   - Verify backend is running
   - Check CORS settings

2. **No Data Display**
   - Check WebSocket connection
   - Verify RTL-SDR device connected
   - Check browser console for errors

3. **Slow Performance**
   - Reduce update interval
   - Disable waterfall if not needed
   - Check browser hardware acceleration

### Debug Mode

Enable debug mode di browser console:
```javascript
window.spectroApp.config.set('debug', true);
```

## 📈 Monitoring

### Application Statistics
```javascript
// Get app statistics
const stats = window.spectroApp.getStats();
console.log(stats);
```

### Performance Metrics
- WebSocket message rate
- Chart render FPS
- Memory usage
- Connection stability

## 🔄 Updates

### Auto-Update
- Check for config updates
- WebSocket reconnection
- Settings persistence

### Manual Update
- Refresh browser
- Clear cache jika perlu
- Update config.json

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

- GitHub Issues untuk bug reports
- Discussions untuk feature requests
- Documentation di Wiki

## 🏷️ Version History

- **v1.0.0** - Initial release
  - Dashboard, Live Spectrum, History
  - WebSocket real-time updates
  - GitHub Pages deployment

---

**Happy Spectrum Analyzing!** 📡✨