'use strict';

/**
 * Base class for all desktop widgets.
 * Provides common utilities and defines the interface for drawing and lifecycle management.
 */
var BaseWidget = class {
    constructor() {}

    /** @interface */
    draw(cr, width, height, accentColor, gridWidth, gridHeight) {

        console.warn(`${this.constructor.name} did not implement draw()`);
    }

    /** @interface */
    update() {

    }

    /** @interface */
    destroy() {

    }

  
    _roundedRectangle(cr, x, y, w, h, r) {
        const maxR = Math.min(w / 2, h / 2);
        const safeR = Math.max(0, Math.min(r, maxR));

        cr.newSubPath();
        cr.arc(x + w - safeR, y + safeR, safeR, -Math.PI / 2, 0);
        cr.arc(x + w - safeR, y + h - safeR, safeR, 0, Math.PI / 2);
        cr.arc(x + safeR, y + h - safeR, safeR, Math.PI / 2, Math.PI);
        cr.arc(x + safeR, y + safeR, safeR, Math.PI, 3 * Math.PI / 2);
        cr.closePath();
    }

    _getSafeAccentColor(accentColor) {
        const Gdk = imports.gi.Gdk;
        if (accentColor && typeof accentColor.red === 'number' && (accentColor.red > 0 || accentColor.green > 0 || accentColor.blue > 0)) {
            return new Gdk.RGBA({
                red: accentColor.red,
                green: accentColor.green,
                blue: accentColor.blue,
                alpha: 1.0
            });
        }
        return new Gdk.RGBA({ red: 0.21, green: 0.52, blue: 0.89, alpha: 1.0 });
    }

    _getPastelColor(accentColor, whiteAmount = 0.82) {
        const Gdk = imports.gi.Gdk;
        const color = this._getSafeAccentColor(accentColor);

        return new Gdk.RGBA({
            red: (color.red * (1 - whiteAmount)) + (1.0 * whiteAmount),
            green: (color.green * (1 - whiteAmount)) + (1.0 * whiteAmount),
            blue: (color.blue * (1 - whiteAmount)) + (1.0 * whiteAmount),
            alpha: 1.0
        });
    }

    _getPastelDimColor(accentColor, whiteAmount = 0.68) {
        const Gdk = imports.gi.Gdk;
        let c = this._getPastelColor(accentColor, whiteAmount);
        c.alpha = 1.0;
        return c;
    }

    _drawMaterialBackground(cr, width, height, accentColor, gridWidth = 2, gridHeight = 2, radiusScale = 0.20) {
        if (!cr || width <= 0 || height <= 0) return { dx: 0, dy: 0, size: 0, s: 0, padding: 0, sw: 0, sh: 0 };
        const Gdk = imports.gi.Gdk;

        const safeAccent = this._getSafeAccentColor(accentColor);
        let sizeW = width;
        let sizeH = height;
        let dx = 0;
        let dy = 0;

        if (gridWidth === gridHeight) {
            let size = Math.min(width, height);
            sizeW = size;
            sizeH = size;
            dx = (width - size) / 2;
            dy = (height - size) / 2;
        }

        let padding = 10;
        let sw = Math.max(0, sizeW - padding);
        let sh = Math.max(0, sizeH - padding);
        let r = Math.min(sw, sh) * radiusScale;

        let bg = new Gdk.RGBA({
            red: (safeAccent.red * 0.18) + 0.12,
            green: (safeAccent.green * 0.18) + 0.12,
            blue: (safeAccent.blue * 0.18) + 0.15,
            alpha: 1.0
        });

        cr.save();
        Gdk.cairo_set_source_rgba(cr, bg);
        this._roundedRectangle(cr, dx + padding / 2, dy + padding / 2, sw, sh, r);
        cr.fillPreserve();

        let border = new Gdk.RGBA({
            red: (safeAccent.red * 0.35) + 0.20,
            green: (safeAccent.green * 0.35) + 0.20,
            blue: (safeAccent.blue * 0.35) + 0.25,
            alpha: 1.0
        });
        Gdk.cairo_set_source_rgba(cr, border);
        cr.setLineWidth(1.5);
        cr.stroke();
        cr.restore();

        let size = Math.min(sw, sh);
        let s = size;
        return { dx, dy, size, s, padding, sw, sh };
    }
};