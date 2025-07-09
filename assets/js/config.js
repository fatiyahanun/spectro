const config = {
  backend_url: "http://localhost:5000",
  websocket_url: "ws://localhost:5001",
  app_name: "SPECTRO WEB",
  version: "1.0.0",
  cors_enabled: true,
  reconnect_attempts: 10,
  reconnect_delay: 1000,
  update_interval: 100,
  chart_settings: {
    animation: false,
    responsive: true,
    maintain_aspect_ratio: false,
    spectrum_color: "rgb(75, 192, 192)",
    waterfall_colors: {
      low: "hsl(240, 100%, 20%)",
      medium: "hsl(60, 100%, 50%)",
      high: "hsl(0, 100%, 50%)"
    }
  },
  ui_settings: {
    theme: "dark",
    auto_refresh: true,
    show_waterfall: true,
    show_markers: true,
    frequency_units: "MHz",
    power_units: "dB"
  },
  api_endpoints: {
    config: "/api/config",
    frequency: "/api/frequency",
    sample_rate: "/api/sample_rate",
    gain: "/api/gain",
    recording_start: "/api/recording/start",
    recording_stop: "/api/recording/stop",
    history: "/api/history/sessions",
    health: "/api/health"
  }
};