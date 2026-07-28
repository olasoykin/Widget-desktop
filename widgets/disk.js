'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;

/**
 * Disk usage widget.
 * Completely redesigned Material You card:
 *  - Header chip & percentage
 *  - Prominent GB usage typography
 *  - Horizontal pill progress bar
 *  - Storage status badge
 */
var DiskWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._percent = 0;
        this._usedGb = 0;
        this._totalGb = 0;
        this.update();
    }

    update() {
        try {
            let file = imports.gi.Gio.File.new_for_path('/');
            let info = file.query_filesystem_info('filesystem::*', null);
            let total = info.get_attribute_uint64('filesystem::size');
            let free = info.get_attribute_uint64('filesystem::free');
            let used = total - free;
            this._totalGb = parseFloat((total / 1024 / 1024 / 1024).toFixed(1));
            this._usedGb = parseFloat((used / 1024 / 1024 / 1024).toFixed(1));
            this._percent = total > 0 ? Math.round(100 * used / total) : 0;
        } catch (e) {}
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);

        let scale = s / 120;
        let pad = 14 * scale;

        let chipLayout = PangoCairo.create_layout(cr);
        chipLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
        chipLayout.set_text('DISK', -1);
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

        let gbLayout = PangoCairo.create_layout(cr);
        gbLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(13 * scale)}`));
        gbLayout.set_text(`${this._usedGb} `, -1);
        let [gw, gh] = gbLayout.get_pixel_size();

        let totalLayout = PangoCairo.create_layout(cr);
        totalLayout.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(9 * scale)}`));
        totalLayout.set_text(`/ ${this._totalGb} GB`, -1);
        let [tw, th] = totalLayout.get_pixel_size();

        let textY = dy + padding / 2 + chipH + 18 * scale;
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 0.95, green: 0.95, blue: 0.98, alpha: 1 }));
        cr.moveTo(dx + padding / 2 + pad, textY);
        PangoCairo.show_layout(cr, gbLayout);

        let dimColor = accentColor.copy();
        dimColor.alpha = 0.65;
        Gdk.cairo_set_source_rgba(cr, dimColor);
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
        if (this._percent > 90) {
            fillColor = new Gdk.RGBA({ red: 0.92, green: 0.22, blue: 0.20, alpha: 1 });
        } else if (this._percent > 75) {
            fillColor = new Gdk.RGBA({ red: 0.98, green: 0.76, blue: 0.0, alpha: 1 });
        } else {
            fillColor = accentColor;
        }

        Gdk.cairo_set_source_rgba(cr, fillColor);
        this._roundedRectangle(cr, barX, barY, fillW, barH, barR);
        cr.fill();

        let freeGb = (this._totalGb - this._usedGb).toFixed(1);
        let freeStr = `Libre: ${freeGb} GB`;

        let freeLayout = PangoCairo.create_layout(cr);
        freeLayout.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(7.5 * scale)}`));
        freeLayout.set_text(freeStr, -1);
        let [fw, fh] = freeLayout.get_pixel_size();

        Gdk.cairo_set_source_rgba(cr, dimColor);
        cr.moveTo(dx + padding / 2 + pad, barY + barH + 8 * scale);
        PangoCairo.show_layout(cr, freeLayout);
    }
};
