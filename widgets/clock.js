'use strict';

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;
const Prefs = imports.preferences;

var ClockWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._fontCache = {};
        this._settings = null;
    }

    _getSystemUse24h() {
        try {
            if (!this._settings) {
                this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
            }
            return this._settings.get_string('clock-format') !== '12h';
        } catch (e) {
            return true;
        }
    }

    _getStyle() {
        try {
            if (Prefs && Prefs.desktopSettings) {
                return Prefs.desktopSettings.get_int('clock-style');
            }
        } catch (e) {}
        return 0; 
    }

    _getCachedFont(fontString) {
        if (!this._fontCache[fontString]) {
            this._fontCache[fontString] = Pango.FontDescription.from_string(fontString);
        }
        return this._fontCache[fontString];
    }

    _setSolidVariant(cr, accent, factor, base = 0.1) {
        let r = Math.min(1.0, accent.red * factor + base);
        let g = Math.min(1.0, accent.green * factor + base);
        let b = Math.min(1.0, accent.blue * factor + base);
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: r, green: g, blue: b, alpha: 1.0 }));
    }

    _createLayout(cr, text, fontStr) {
        let layout = PangoCairo.create_layout(cr);
        layout.set_font_description(this._getCachedFont(fontStr));
        layout.set_text(text, -1);
        return layout;
    }

    _showLayout(cr, layout, cx, cy) {
        let [w, h] = layout.get_pixel_size();
        cr.moveTo(cx - w / 2, cy - h / 2);
        PangoCairo.show_layout(cr, layout);
    }

    _drawCenteredText(cr, text, fontStr, cx, cy) {
        let layout = this._createLayout(cr, text, fontStr);
        this._showLayout(cr, layout, cx, cy);
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let safeAccent = accentColor || { red: 0.5, green: 0.5, blue: 0.5 };
        let bgInfo = this._drawMaterialBackground(cr, width, height, safeAccent, gridWidth, gridHeight);
        
        if (!bgInfo || bgInfo.sw <= 0 || bgInfo.sh <= 0) return;

        let use24h = this._getSystemUse24h();
        let now = new Date();
        let style = this._getStyle();

        if (gridWidth === 4 && gridHeight === 2) {
            this._draw4x2Safe(cr, bgInfo, safeAccent, now, use24h, style);
            return;
        }

        let cx = bgInfo.dx + bgInfo.padding / 2 + bgInfo.sw / 2;
        let cy = bgInfo.dy + bgInfo.padding / 2 + bgInfo.sh / 2;
        let scale = bgInfo.s / 120;

        switch (style) {
            case 1: this._drawAnalogNumbers(cr, cx, cy, bgInfo.s, scale, safeAccent, now); break;
            case 2: this._drawAnalogBadge(cr, cx, cy, bgInfo.s, scale, safeAccent, now); break;
            case 3: this._drawAnalogPill(cr, cx, cy, bgInfo.s, scale, safeAccent, now); break;
            case 4: this._drawDigitalLine(cr, cx, cy, scale, safeAccent, now, use24h); break;
            case 0:
            default:
                this._drawDigitalStacked(cr, cx, cy, scale, safeAccent, now, use24h); break;
        }
    }

    _drawDigitalStacked(cr, cx, cy, scale, accent, now, use24h) {
        let h = now.getHours();
        if (!use24h) h = h % 12 || 12;
        
        let hStr = h.toString().padStart(2, '0');
        let mStr = now.getMinutes().toString().padStart(2, '0');

        let layoutH = this._createLayout(cr, hStr, `Sans Heavy ${Math.floor(46 * scale)}`);
        let layoutM = this._createLayout(cr, mStr, `Sans Medium ${Math.floor(46 * scale)}`);

        let [, hh] = layoutH.get_pixel_size();
        let [, mh] = layoutM.get_pixel_size();
        
        let overlap = 35 * scale; 
        let totalHeight = hh + mh - overlap;
        let startY = cy - totalHeight / 2;

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
        this._showLayout(cr, layoutH, cx, startY + hh / 2);

        this._setSolidVariant(cr, accent, 0.6, 0.25);
        this._showLayout(cr, layoutM, cx, startY + hh - overlap + mh / 2);
    }

    _drawHands(cr, cx, cy, radius, scale, accent, now, drawSeconds) {
        let h = now.getHours() % 12;
        let m = now.getMinutes();
        let sec = now.getSeconds();

        let hAngle = ((h + m / 60) / 12) * 2 * Math.PI - Math.PI / 2;
        let mAngle = ((m + sec / 60) / 60) * 2 * Math.PI - Math.PI / 2;
        let sAngle = (sec / 60) * 2 * Math.PI - Math.PI / 2;

        cr.setLineCap(Cairo.LineCap.ROUND);
        this._setSolidVariant(cr, accent, 0.25, 0.1);

        cr.setLineWidth(7 * scale);
        cr.moveTo(cx, cy);
        cr.lineTo(cx + Math.cos(hAngle) * radius * 0.55, cy + Math.sin(hAngle) * radius * 0.55);
        cr.stroke();

        cr.setLineWidth(4.5 * scale);
        cr.moveTo(cx, cy);
        cr.lineTo(cx + Math.cos(mAngle) * radius * 0.85, cy + Math.sin(mAngle) * radius * 0.85);
        cr.stroke();

        if (drawSeconds) {
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
            cr.setLineWidth(2 * scale);
            cr.moveTo(cx - Math.cos(sAngle) * radius * 0.15, cy - Math.sin(sAngle) * radius * 0.15);
            cr.lineTo(cx + Math.cos(sAngle) * radius * 0.9, cy + Math.sin(sAngle) * radius * 0.9);
            cr.stroke();
        }

        this._setSolidVariant(cr, accent, 0.25, 0.1);
        cr.arc(cx, cy, 4 * scale, 0, Math.PI * 2);
        cr.fill();
    }

    _drawAnalogNumbers(cr, cx, cy, s, scale, accent, now) {
        let radius = s * 0.36;
        let cardinals = [{ n: '12', a: -Math.PI / 2 }, { n: '3', a: 0 }, { n: '6', a: Math.PI / 2 }, { n: '9', a: Math.PI }];
        let fontNum = `Sans Heavy ${Math.floor(16 * scale)}`;
        
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
        for (let c of cardinals) {
            this._drawCenteredText(cr, c.n, fontNum, cx + Math.cos(c.a) * (radius * 1.02), cy + Math.sin(c.a) * (radius * 1.02));
        }

        this._drawHands(cr, cx, cy, radius, scale, accent, now, true);
    }

    _drawAnalogBadge(cr, cx, cy, s, scale, accent, now) {
        let radius = s * 0.36;
        this._drawHands(cr, cx, cy, radius, scale, accent, now, true);

        let layout = this._createLayout(cr, now.getDate().toString(), `Sans Bold ${Math.floor(8 * scale)}`);
        let [bw, bh] = layout.get_pixel_size();
        let padX = 5 * scale, padY = 2 * scale;
        let badgeW = bw + padX * 2;
        let badgeH = bh + padY * 2;

        let badgeX = cx + radius * 0.45;
        let badgeY = cy - badgeH / 2;

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
        this._roundedRectangle(cr, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
        cr.fill();

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 0.08, green: 0.08, blue: 0.08, alpha: 1.0 }));
        this._showLayout(cr, layout, badgeX + badgeW / 2, badgeY + badgeH / 2);
    }

    _drawAnalogPill(cr, cx, cy, s, scale, accent, now) {
        let h = now.getHours() % 12;
        let m = now.getMinutes();

        let radius = s * 0.36;
        let hAngle = ((h + m / 60) / 12) * 2 * Math.PI - Math.PI / 2;
        let mAngle = (m / 60) * 2 * Math.PI - Math.PI / 2;

        let drawPill = (angle, len, wid) => {
            cr.save();
            cr.translate(cx, cy);
            cr.rotate(angle);
            this._roundedRectangle(cr, -wid / 2, -len * 0.75, wid, len, wid / 2);
            cr.fill();
            cr.restore();
        };

        this._setSolidVariant(cr, accent, 0.3, 0.12);
        drawPill(hAngle + Math.PI / 2, radius * 0.58, 12 * scale);
        drawPill(mAngle + Math.PI / 2, radius * 0.88, 8 * scale);

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
        cr.arc(cx, cy, 5 * scale, 0, Math.PI * 2);
        cr.fill();
    }

    _drawDigitalLine(cr, cx, cy, scale, accent, now, use24h) {
        let h = now.getHours();
        if (!use24h) h = h % 12 || 12;
        let timeStr = `${h.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
        this._drawCenteredText(cr, timeStr, `Sans Heavy ${Math.floor(26 * scale)}`, cx, cy);
    }

    _draw4x2Safe(cr, bg, accent, now, use24h, style) {
        let padding = bg.padding;
        
        let leftCX = bg.dx + padding / 2 + (bg.sw / 4);
        let rightCX = bg.dx + padding / 2 + (bg.sw * 3 / 4);
        let cy = bg.dy + padding / 2 + (bg.sh / 2);
        
        let size = bg.sh * 0.85; 
        let scale = size / 120;

        if (style === 0 || style === 4) {
            let h = now.getHours();
            if (!use24h) h = h % 12 || 12;
            let timeStr = `${h.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
            this._drawCenteredText(cr, timeStr, `Sans Heavy ${Math.floor(38 * scale)}`, leftCX, cy);
        } else if (style === 1) {
            this._drawAnalogNumbers(cr, leftCX, cy, size, scale, accent, now);
        } else if (style === 2) {
            this._drawAnalogBadge(cr, leftCX, cy, size, scale, accent, now);
        } else {
            this._drawAnalogPill(cr, leftCX, cy, size, scale, accent, now);
        }

        const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
        const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        
        let dayName = DAYS[now.getDay()];
        let monthName = MONTHS[now.getMonth()];
        let dayNum = now.getDate().toString();

        this._setSolidVariant(cr, accent, 0.7, 0.2);
        this._drawCenteredText(cr, dayName, `Sans Bold ${Math.floor(10 * scale)}`, rightCX, cy - (28 * scale));

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: accent.red, green: accent.green, blue: accent.blue, alpha: 1.0 }));
        this._drawCenteredText(cr, dayNum, `Sans Heavy ${Math.floor(38 * scale)}`, rightCX, cy);

        this._setSolidVariant(cr, accent, 0.85, 0.1);
        this._drawCenteredText(cr, monthName, `Sans Bold ${Math.floor(10 * scale)}`, rightCX, cy + (28 * scale));
    }
};
