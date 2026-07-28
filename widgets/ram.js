'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;

/**
 * Real-time RAM usage widget. Material You card.
 * Uses soft pastel text colors derived from accentColor.
 */
var RamWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._total = 0;
        this._used = 0;
        this._percent = 0;
        this.update();
    }

    update() {
        try {
            let [ok, content] = GLib.file_get_contents('/proc/meminfo');
            if (!ok) return;
            let lines = content.toString().split('\n');
            let values = {};
            for (let line of lines) {
                let parts = line.split(':');
                if (parts.length === 2) {
                    values[parts[0].trim()] = parseInt(parts[1].trim());
                }
            }
            let total = values['MemTotal'] || 0;
            let free = values['MemFree'] || 0;
            let buffers = values['Buffers'] || 0;
            let cached = values['Cached'] || 0;
            let sReclaimable = values['SReclaimable'] || 0;
            let shmem = values['Shmem'] || 0;
            let available = free + buffers + cached + sReclaimable - shmem;
            this._total = total;
            this._used = total - available;
            this._percent = total > 0 ? Math.round(100 * this._used / total) : 0;
        } catch (e) {}
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);

        let scale = s / 120;
        let pad = 14 * scale;
        let pastelText = this._getPastelColor(accentColor);
        let pastelDim = this._getPastelDimColor(accentColor);

        let chipLayout = PangoCairo.create_layout(cr);
        chipLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
        chipLayout.set_text('RAM', -1);
        let [clw, clh] = chipLayout.get_pixel_size();
        let cpx = 6 * scale, cpy = 2 * scale;
        let chipW = clw + cpx * 2, chipH = clh + cpy * 2;
        let chipX = dx + padding / 2 + pad;
        let chipY = dy + padding / 2 + 10 * scale;

        let chipBg = accentColor.copy();
        chipBg.alpha = 0.18;
        Gdk.cairo_set_source_rgba(cr, chipBg);
        this._roundedRectangle(cr, chipX, chipY, chipW, chipH, chipH / 2);
        cr.fill();

        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(chipX + cpx, chipY + cpy);
        PangoCairo.show_layout(cr, chipLayout);

        let pctLayout = PangoCairo.create_layout(cr);
        pctLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(16 * scale)}`));
        pctLayout.set_text(`${this._percent}%`, -1);
        let [pw, ph] = pctLayout.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(dx + padding / 2 + sw - pad - pw, dy + padding / 2 + 6 * scale);
        PangoCairo.show_layout(cr, pctLayout);

        let usedGb = (this._used / 1024 / 1024).toFixed(1);
        let totalGb = (this._total / 1024 / 1024).toFixed(1);

        let gbLayout = PangoCairo.create_layout(cr);
        gbLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(13 * scale)}`));
        gbLayout.set_text(`${usedGb} `, -1);
        let [gw, gh] = gbLayout.get_pixel_size();

        let totalLayout = PangoCairo.create_layout(cr);
        totalLayout.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(9 * scale)}`));
        totalLayout.set_text(`/ ${totalGb} GB`, -1);
        let [tw, th] = totalLayout.get_pixel_size();

        let textY = dy + padding / 2 + chipH + 18 * scale;
        Gdk.cairo_set_source_rgba(cr, pastelText);
        cr.moveTo(dx + padding / 2 + pad, textY);
        PangoCairo.show_layout(cr, gbLayout);

        Gdk.cairo_set_source_rgba(cr, pastelDim);
        cr.moveTo(dx + padding / 2 + pad + gw, textY + gh - th);
        PangoCairo.show_layout(cr, totalLayout);

        let barY = textY + gh + 10 * scale;
        let barW = sw - pad * 2;
        let barH = 12 * scale;
        let barX = dx + padding / 2 + pad;
        let barR = barH / 2;

        let trackColor = accentColor.copy();
        trackColor.alpha = 0.16;
        Gdk.cairo_set_source_rgba(cr, trackColor);
        this._roundedRectangle(cr, barX, barY, barW, barH, barR);
        cr.fill();

        let fillW = Math.max(barH, (this._percent / 100) * barW);
        let fillColor;
        if (this._percent > 85) {
            fillColor = new Gdk.RGBA({ red: 0.92, green: 0.22, blue: 0.20, alpha: 1 });
        } else if (this._percent > 65) {
            fillColor = new Gdk.RGBA({ red: 0.98, green: 0.76, blue: 0.0, alpha: 1 });
        } else {
            fillColor = accentColor;
        }

        Gdk.cairo_set_source_rgba(cr, fillColor);
        this._roundedRectangle(cr, barX, barY, fillW, barH, barR);
        cr.fill();

        let freeGb = ((this._total - this._used) / 1024 / 1024).toFixed(1);
        let freeStr = `Libre: ${freeGb} GB`;

        let freeLayout = PangoCairo.create_layout(cr);
        freeLayout.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(7.5 * scale)}`));
        freeLayout.set_text(freeStr, -1);
        let [fw, fh] = freeLayout.get_pixel_size();

        Gdk.cairo_set_source_rgba(cr, pastelDim);
        cr.moveTo(dx + padding / 2 + pad, barY + barH + 8 * scale);
        PangoCairo.show_layout(cr, freeLayout);
    }
};
