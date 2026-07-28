'use strict';

const { Gdk, GLib, Gio, Pango, PangoCairo } = imports.gi;
const BaseWidget = imports.widgets.baseWidget;
const Prefs = imports.preferences;
const Cairo = imports.gi.cairo;

/**
 * Weather widget. Fetches data from Open-Meteo (free, no API key needed).
 * Shows current weather + temperature and an hourly timeline.
 *
 * Size variants:
 *   2x2: icon + temperature only
 *   4x2: icon + temp + short timeline (6 hours)
 *   4x4: icon + temp + details + full timeline (12 hours)
 */
var WeatherWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._temperature = null;
        this._apparentTemp = null;
        this._humidity = null;
        this._windSpeed = null;
        this._weatherCode = null;
        this._hourlyData = [];
        this._error = null;
        this._fetching = false;
        this._dataTime = 0;
        this._redrawCallback = null;
        this._cityName = null;
        this._updateTimer = 0;
        this._startTimer();
        // Immediate first fetch
        this._fetchWeather();
    }

    setRedrawCallback(cb) {
        this._redrawCallback = cb;
    }

    _startTimer() {
        if (this._updateTimer) {
            GLib.source_remove(this._updateTimer);
        }
        // Every 5 minutes
        this._updateTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 300, () => {
            this._fetchWeather();
            return GLib.SOURCE_CONTINUE;
        });
    }

    update() {
        let now = GLib.get_monotonic_time();
        if (!this._fetching && (now - this._dataTime > 180 * 1000000)) {
            this._fetchWeather();
        }
    }

    _fetchWeather() {
        if (this._fetching) return;
        this._fetching = true;

        let configuredCity = '';
        let lat = '';
        let lon = '';
        try {
            configuredCity = Prefs.desktopSettings.get_string('weather-widget-city') || '';
            lat = Prefs.desktopSettings.get_string('weather-widget-lat') || '';
            lon = Prefs.desktopSettings.get_string('weather-widget-lon') || '';
        } catch(e) {}

        if (configuredCity && configuredCity.trim() !== '') {
            let geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(configuredCity.trim())}&count=1&language=es&format=json`;
            this._fetchUrl(geoUrl, (ok, body) => {
                if (ok && body) {
                    try {
                        let res = JSON.parse(body);
                        if (res.results && res.results.length > 0) {
                            let loc = res.results[0];
                            this._cityName = loc.name;
                            this._fetchForecast(loc.latitude, loc.longitude);
                            return;
                        }
                    } catch (e) {}
                }
                this._fetchFallbackLocation(lat, lon);
            });
        } else if (lat && lon) {
            this._cityName = configuredCity || null;
            this._fetchForecast(lat, lon);
        } else {
            this._fetchFallbackLocation(lat, lon);
        }
    }

    _fetchFallbackLocation(savedLat, savedLon) {
        let ipUrl = `http://ip-api.com/json/`;
        this._fetchUrl(ipUrl, (ok, body) => {
            if (ok && body) {
                try {
                    let res = JSON.parse(body);
                    if (res && res.lat && res.lon) {
                        this._cityName = res.city || 'WEATHER';
                        this._fetchForecast(res.lat, res.lon);
                        return;
                    }
                } catch(e) {}
            }
            let defaultLat = savedLat || '-34.6037';
            let defaultLon = savedLon || '-58.3816';
            this._cityName = 'WEATHER';
            this._fetchForecast(defaultLat, defaultLon);
        });
    }

    _fetchForecast(lat, lon) {
        let url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto&forecast_hours=12`;

        this._fetchUrl(url, (ok, body) => {
            this._fetching = false;
            if (ok && body) {
                try {
                    let data = JSON.parse(body);
                    this._processData(data);
                    this._dataTime = GLib.get_monotonic_time();
                } catch (e) {
                    this._error = 'Parse error';
                }
            } else {
                this._error = 'No data';
            }
            if (this._redrawCallback) this._redrawCallback();
        });
    }

    _fetchUrl(url, callback) {
        try {
            let proc = new Gio.Subprocess({
                argv: ['curl', '-s', '-m', '8', '--connect-timeout', '5', url],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (obj, res) => {
                try {
                    let [ok, stdout, stderr] = obj.communicate_utf8_finish(res);
                    callback(ok && stdout && stdout.length > 0, stdout || null);
                } catch (e) {
                    callback(false, null);
                }
            });
        } catch (e) {
            this._fetching = false;
            this._error = 'Curl not found';
            if (this._redrawCallback) this._redrawCallback();
        }
    }

    _processData(data) {
        if (!data || !data.current) {
            this._error = 'Invalid response';
            return;
        }
        this._error = null;
        let cur = data.current;
        this._temperature = cur.temperature_2m;
        this._apparentTemp = cur.apparent_temperature;
        this._humidity = cur.relative_humidity_2m;
        this._windSpeed = cur.wind_speed_10m;
        this._weatherCode = cur.weather_code;

        // Parse hourly data
        this._hourlyData = [];
        if (data.hourly && data.hourly.time) {
            let times = data.hourly.time;
            let temps = data.hourly.temperature_2m;
            let codes = data.hourly.weather_code;
            let now = new Date();
            let currentHour = now.getHours();

            // Find the next hourly slot after now
            let startIdx = 0;
            for (let i = 0; i < times.length; i++) {
                let h = new Date(times[i]).getHours();
                if (h > currentHour || (h === currentHour && new Date(times[i]) > now)) {
                    startIdx = i;
                    break;
                }
            }

            // Get up to 12 hours
            for (let i = startIdx; i < Math.min(startIdx + 12, times.length); i++) {
                this._hourlyData.push({
                    time: times[i],
                    temp: Math.round(temps[i]),
                    code: codes[i]
                });
            }
        }
    }

    /**
     * Draw a simple weather icon using Cairo paths.
     * Supports: sunny, partly_cloudy, cloudy, rainy, snowy, stormy, foggy
     */
    _drawWeatherIcon(cr, cx, cy, size, code) {
        let iconType = this._classifyWeather(code);

        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);

        switch (iconType) {
            case 'sunny':
                this._drawSun(cr, cx, cy, size);
                break;
            case 'partly_cloudy':
                this._drawSun(cr, cx - size * 0.1, cy - size * 0.1, size * 0.65);
                this._drawCloud(cr, cx + size * 0.1, cy + size * 0.05, size * 0.7, 0.85);
                break;
            case 'cloudy':
                this._drawCloud(cr, cx, cy, size, 1.0);
                break;
            case 'rainy':
                this._drawCloud(cr, cx, cy - size * 0.05, size * 0.75, 0.8);
                this._drawRain(cr, cx, cy + size * 0.25, size * 0.5);
                break;
            case 'snowy':
                this._drawCloud(cr, cx, cy - size * 0.05, size * 0.75, 0.8);
                this._drawSnow(cr, cx, cy + size * 0.25, size * 0.5);
                break;
            case 'stormy':
                this._drawCloud(cr, cx, cy - size * 0.08, size * 0.85, 0.7);
                this._drawLightning(cr, cx, cy + size * 0.15, size * 0.4);
                break;
            case 'foggy':
                this._drawFog(cr, cx, cy, size);
                break;
            default:
                this._drawCloud(cr, cx, cy, size, 1.0);
        }
    }

    _classifyWeather(code) {
        if (code === 0) return 'sunny';
        if (code <= 2) return 'partly_cloudy';
        if (code === 3) return 'cloudy';
        if (code >= 45 && code <= 48) return 'foggy';
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
        if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snowy';
        if (code >= 95 && code <= 99) return 'stormy';
        return 'cloudy';
    }

    _drawSun(cr, cx, cy, size) {
        let r = size * 0.3;
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 0.85, blue: 0.2, alpha: 1 }));
        cr.arc(cx, cy, r, 0, 2 * Math.PI);
        cr.fill();

        // Rays
        cr.setLineWidth(size * 0.06);
        for (let i = 0; i < 8; i++) {
            let angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
            let inner = r + size * 0.08;
            let outer = r + size * 0.35;
            cr.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
            cr.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        }
        cr.stroke();
    }

    _drawCloud(cr, cx, cy, size, alpha) {
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 200/255, green: 200/255, blue: 205/255, alpha: alpha }));
        let s = size * 0.4;
        cr.arc(cx - s * 0.5, cy + s * 0.1, s * 0.45, 0, 2 * Math.PI);
        cr.arc(cx + s * 0.5, cy + s * 0.1, s * 0.45, 0, 2 * Math.PI);
        cr.arc(cx, cy - s * 0.25, s * 0.5, 0, 2 * Math.PI);
        cr.fill();
    }

    _drawRain(cr, cx, cy, size) {
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 100/255, green: 160/255, blue: 255/255, alpha: 0.8 }));
        cr.setLineWidth(size * 0.07);
        cr.setLineCap(Cairo.LineCap.ROUND);
        let count = 5;
        for (let i = 0; i < count; i++) {
            let x = cx - size * 0.3 + (i / (count - 1)) * size * 0.6;
            let len = size * (0.2 + Math.sin(i * 2.3) * 0.1);
            cr.moveTo(x, cy);
            cr.lineTo(x - size * 0.06, cy + len);
        }
        cr.stroke();
    }

    _drawSnow(cr, cx, cy, size) {
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 200/255, green: 220/255, blue: 255/255, alpha: 0.9 }));
        cr.setLineWidth(size * 0.05);
        let count = 4;
        for (let i = 0; i < count; i++) {
            let x = cx - size * 0.25 + (i / (count - 1)) * size * 0.5;
            let y = cy + (i % 2) * size * 0.15;
            // Asterisk
            for (let a = 0; a < 6; a++) {
                let angle = (a / 6) * 2 * Math.PI;
                let r2 = size * 0.12;
                cr.moveTo(x, y);
                cr.lineTo(x + Math.cos(angle) * r2, y + Math.sin(angle) * r2);
            }
            cr.stroke();
        }
    }

    _drawLightning(cr, cx, cy, size) {
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 0.85, blue: 0.2, alpha: 1 }));
        cr.setLineWidth(size * 0.12);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        let s = size * 0.5;
        cr.moveTo(cx + s * 0.15, cy - s);
        cr.lineTo(cx - s * 0.1, cy - s * 0.1);
        cr.lineTo(cx + s * 0.05, cy - s * 0.05);
        cr.lineTo(cx - s * 0.15, cy + s);
        cr.lineTo(cx + s * 0.15, cy + s * 0.15);
        cr.stroke();
    }

    _drawFog(cr, cx, cy, size) {
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 170/255, green: 170/255, blue: 180/255, alpha: 0.7 }));
        cr.setLineWidth(size * 0.06);
        cr.setLineCap(Cairo.LineCap.ROUND);
        let s = size * 0.35;
        for (let i = 0; i < 3; i++) {
            let y = cy - s * 0.4 + i * s * 0.4;
            let w = s * 1.6 - i * s * 0.15;
            cr.moveTo(cx - w / 2, y);
            cr.lineTo(cx + w / 2, y);
        }
        cr.stroke();
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);
        let scale = s / 120;

        let cx = dx + padding/2 + sw/2;
        // Title
        let layoutTitle = PangoCairo.create_layout(cr);
        layoutTitle.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(9 * scale)}`));
        let titleText = (this._cityName && this._cityName.length > 0) ? this._cityName.toUpperCase() : 'WEATHER';
        layoutTitle.set_text(titleText, -1);
        let [tw, th] = layoutTitle.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(cx - tw / 2, dy + padding/2 + 10 * scale);
        PangoCairo.show_layout(cr, layoutTitle);

        if (!this._temperature === null || this._error) {
            // Show loading/error state
            let statusText = this._fetching ? 'Loading...' : (this._error || 'No data');
            let layoutStatus = PangoCairo.create_layout(cr);
            layoutStatus.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(9 * scale)}`));
            layoutStatus.set_text(statusText, -1);
            let [statusW, statusH] = layoutStatus.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 142/255, green: 142/255, blue: 147/255, alpha: 1 }));
            cr.moveTo(cx - statusW / 2, dy + padding/2 + sh / 2 - statusH / 2);
            PangoCairo.show_layout(cr, layoutStatus);
            return;
        }

        if (gridWidth === 2 && gridHeight === 2) {
            this._drawCompact(cr, dx, dy, padding, sw, sh, accentColor, scale, cx);
        } else if (gridWidth >= 4 && gridHeight === 2) {
            this._drawWithTimeline(cr, dx, dy, padding, sw, sh, accentColor, scale, true);
        } else {
            this._drawFull(cr, dx, dy, padding, sw, sh, accentColor, scale);
        }
    }

    _drawCompact(cr, dx, dy, padding, sw, sh, accentColor, scale, cx) {
        // Weather icon
        let iconSize = Math.min(sw, sh) * 0.32;
        if (this._weatherCode !== null) {
            this._drawWeatherIcon(cr, cx, dy + padding/2 + sh * 0.42, iconSize, this._weatherCode);
        }

        // Temperature
        let tempText = this._temperature !== null ? `${Math.round(this._temperature)}°` : '--°';
        let layoutTemp = PangoCairo.create_layout(cr);
        layoutTemp.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(22 * scale)}`));
        layoutTemp.set_text(tempText, -1);
        let [tempw, temph] = layoutTemp.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
        cr.moveTo(cx - tempw / 2, dy + padding/2 + sh * 0.72);
        PangoCairo.show_layout(cr, layoutTemp);
    }

    _drawWithTimeline(cr, dx, dy, padding, sw, sh, accentColor, scale, shortMode) {
        let pad = 14 * scale;

        // Layout: icon + temp on left, timeline on right
        let leftRatio = 0.32;
        let leftW = sw * leftRatio;
        let leftCx = dx + padding/2 + leftW / 2;

        // Weather icon
        let iconSize = Math.min(leftW, sh * 0.5) * 0.55;
        if (this._weatherCode !== null) {
            this._drawWeatherIcon(cr, leftCx, dy + padding/2 + sh * 0.42, iconSize, this._weatherCode);
        }

        // Temperature
        let tempText = this._temperature !== null ? `${Math.round(this._temperature)}°` : '--°';
        let layoutTemp = PangoCairo.create_layout(cr);
        layoutTemp.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(20 * scale)}`));
        layoutTemp.set_text(tempText, -1);
        let [tempw, temph] = layoutTemp.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
        cr.moveTo(leftCx - tempw / 2, dy + padding/2 + sh * 0.68);
        PangoCairo.show_layout(cr, layoutTemp);

        // Separator
        let sepX = dx + padding/2 + leftW + 4 * scale;
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 0.5 }));
        cr.setLineWidth(1.5);
        cr.moveTo(sepX, dy + padding/2 + sh * 0.15);
        cr.lineTo(sepX, dy + padding/2 + sh * 0.85);
        cr.stroke();

        // Timeline area
        let timelineX = sepX + 8 * scale;
        let timelineW = sw - (timelineX - (dx + padding/2)) - pad;

        let hoursToShow = shortMode ? 6 : 8;
        let items = this._hourlyData.slice(0, hoursToShow);
        if (items.length === 0) return;

        let itemW = timelineW / items.length;

        for (let i = 0; i < items.length; i++) {
            let h = items[i];
            let ix = timelineX + i * itemW;
            let label = this._formatHour(h.time);

            // Hour label
            let layoutHour = PangoCairo.create_layout(cr);
            layoutHour.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(7.5 * scale)}`));
            layoutHour.set_text(label, -1);
            let [hw, hh] = layoutHour.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 174/255, green: 174/255, blue: 178/255, alpha: 1 }));
            cr.moveTo(ix + itemW / 2 - hw / 2, dy + padding/2 + sh * 0.18);
            PangoCairo.show_layout(cr, layoutHour);

            // Small weather icon
            let iconS = itemW * 0.35;
            this._drawWeatherIcon(cr, ix + itemW / 2, dy + padding/2 + sh * 0.45, iconS, h.code);

            // Temperature
            let layoutHTemp = PangoCairo.create_layout(cr);
            layoutHTemp.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(9 * scale)}`));
            layoutHTemp.set_text(`${h.temp}°`, -1);
            let [htw, hth] = layoutHTemp.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
            cr.moveTo(ix + itemW / 2 - htw / 2, dy + padding/2 + sh * 0.68);
            PangoCairo.show_layout(cr, layoutHTemp);
        }
    }

    _drawFull(cr, dx, dy, padding, sw, sh, accentColor, scale) {
        let pad = 14 * scale;

        // Top section: icon + main info
        let iconSize = Math.min(sw * 0.12, sh * 0.22);
        let infoY = dy + padding/2 + 30 * scale;

        // Weather icon
        if (this._weatherCode !== null) {
            this._drawWeatherIcon(cr, dx + padding/2 + sw * 0.18, infoY + iconSize / 2, iconSize, this._weatherCode);
        }

        // Temperature (large)
        let tempText = this._temperature !== null ? `${Math.round(this._temperature)}°` : '--°';
        let layoutTemp = PangoCairo.create_layout(cr);
        layoutTemp.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(28 * scale)}`));
        layoutTemp.set_text(tempText, -1);
        let [tempw, temph] = layoutTemp.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
        cr.moveTo(dx + padding/2 + sw * 0.30, infoY + iconSize * 0.15);
        PangoCairo.show_layout(cr, layoutTemp);

        // Feels like
        if (this._apparentTemp !== null) {
            let feelsLike = `Feels like ${Math.round(this._apparentTemp)}°`;
            let layoutFeels = PangoCairo.create_layout(cr);
            layoutFeels.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(7.5 * scale)}`));
            layoutFeels.set_text(feelsLike, -1);
            let [fw, fh] = layoutFeels.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 174/255, green: 174/255, blue: 178/255, alpha: 1 }));
            cr.moveTo(dx + padding/2 + sw * 0.30, infoY + iconSize * 0.15 + temph + 2 * scale);
            PangoCairo.show_layout(cr, layoutFeels);
        }

        // Detail chips (humidity, wind) - right side of top
        let chipX = dx + padding/2 + sw * 0.55;
        let chipY = infoY;

        // Humidity chip
        if (this._humidity !== null) {
            let chipR = 6 * scale;
            let chipH = 22 * scale;
            let chipW = 80 * scale;

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 40/255, green: 42/255, blue: 45/255, alpha: 1 }));
            this._roundedRectangle(cr, chipX, chipY, chipW, chipH, chipR);
            cr.fill();

            let humidityText = `💧 ${this._humidity}%`;
            let layoutHumidity = PangoCairo.create_layout(cr);
            layoutHumidity.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7.5 * scale)}`));
            layoutHumidity.set_text(humidityText, -1);
            let [huw, huh] = layoutHumidity.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 0.9 }));
            cr.moveTo(chipX + chipW / 2 - huw / 2, chipY + chipH / 2 - huh / 2);
            PangoCairo.show_layout(cr, layoutHumidity);
        }

        // Wind chip
        if (this._windSpeed !== null) {
            let chipR = 6 * scale;
            let chipH = 22 * scale;
            let chipW = 80 * scale;
            let chipX2 = chipX + chipW + 8 * scale;

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 40/255, green: 42/255, blue: 45/255, alpha: 1 }));
            this._roundedRectangle(cr, chipX2, chipY, chipW, chipH, chipR);
            cr.fill();

            let windText = `💨 ${Math.round(this._windSpeed)} km/h`;
            let layoutWind = PangoCairo.create_layout(cr);
            layoutWind.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7.5 * scale)}`));
            layoutWind.set_text(windText, -1);
            let [wiw, wih] = layoutWind.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 0.9 }));
            cr.moveTo(chipX2 + chipW / 2 - wiw / 2, chipY + chipH / 2 - wih / 2);
            PangoCairo.show_layout(cr, layoutWind);
        }

        // Separator line
        let sepY = infoY + iconSize + 12 * scale;
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 0.4 }));
        cr.setLineWidth(1);
        cr.moveTo(dx + padding/2 + pad, sepY);
        cr.lineTo(dx + padding/2 + sw - pad, sepY);
        cr.stroke();

        // Full timeline
        let timelineTop = sepY + 8 * scale;
        let timelineBottom = dy + padding/2 + sh - pad;
        let timelineH = timelineBottom - timelineTop;

        let items = this._hourlyData.slice(0, 12);
        if (items.length === 0) return;

        let itemW = (sw - pad * 2) / items.length;

        // "HOURS" label
        let layoutHoursLabel = PangoCairo.create_layout(cr);
        layoutHoursLabel.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7 * scale)}`));
        layoutHoursLabel.set_text('HOURS', -1);
        let [hlw, hlh] = layoutHoursLabel.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(dx + padding/2 + sw / 2 - hlw / 2, timelineTop);
        PangoCairo.show_layout(cr, layoutHoursLabel);

        let hourRowY = timelineTop + hlh + 6 * scale;
        let iconRowY = hourRowY + 14 * scale;
        let tempRowY = iconRowY + 16 * scale;

        for (let i = 0; i < items.length; i++) {
            let h = items[i];
            let ix = dx + padding/2 + pad + i * itemW;

            // Hour label
            let label = this._formatHour(h.time);
            let layoutHour = PangoCairo.create_layout(cr);
            layoutHour.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(7 * scale)}`));
            layoutHour.set_text(label, -1);
            let [hw, hh] = layoutHour.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 174/255, green: 174/255, blue: 178/255, alpha: 1 }));
            cr.moveTo(ix + itemW / 2 - hw / 2, hourRowY);
            PangoCairo.show_layout(cr, layoutHour);

            // Small weather icon
            let iconS = itemW * 0.4;
            this._drawWeatherIcon(cr, ix + itemW / 2, iconRowY + iconS / 2, iconS, h.code);

            // Temperature
            let layoutHTemp = PangoCairo.create_layout(cr);
            layoutHTemp.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
            layoutHTemp.set_text(`${h.temp}°`, -1);
            let [htw, hth] = layoutHTemp.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
            cr.moveTo(ix + itemW / 2 - htw / 2, tempRowY);
            PangoCairo.show_layout(cr, layoutHTemp);
        }
    }

    _formatHour(timeStr) {
        try {
            let d = new Date(timeStr);
            let h = d.getHours();
            return `${h.toString().padStart(2, '0')}:00`;
        } catch (e) {
            return '--:--';
        }
    }
};
