'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;

/**
 * CPU widget. Material You design.
 * Shows CPU usage history bars + usage percentage & temperature.
 */
var CpuWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._lastTotal = 0;
        this._lastIdle = 0;
        this._usage = 0;
        this._temp = null;
        this._history = new Array(20).fill(0);
    }

    update() {
        this._usage = this._getCPUUsage();
        this._temp = this._getCPUTemp();
        this._history.shift();
        this._history.push(this._usage);
    }

    _getCPUUsage() {
        try {
            let [success, content] = GLib.file_get_contents('/proc/stat');
            if (!success) return 0;
            let line = content.toString().split('\n')[0];
            let parts = line.split(/\s+/).filter(x => x.length > 0).slice(1).map(Number);
            let idle = parts[3] + parts[4];
            let total = parts.reduce((a, b) => a + b, 0);

            let usage = 0;
            if (this._lastTotal > 0) {
                let diffTotal = total - this._lastTotal;
                let diffIdle = idle - this._lastIdle;
                if (diffTotal > 0)
                    usage = Math.round(100 * (diffTotal - diffIdle) / diffTotal);
            }
            this._lastTotal = total;
            this._lastIdle = idle;
            return usage;
        } catch (e) {
            return 0;
        }
    }

    _getCPUTemp() {
        try {
            let paths = [
                '/sys/class/thermal/thermal_zone0/temp',
                '/sys/class/thermal/thermal_zone1/temp',
                '/sys/class/hwmon/hwmon0/temp1_input',
                '/sys/class/hwmon/hwmon1/temp1_input'
            ];
            for (let path of paths) {
                if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                    let [success, content] = GLib.file_get_contents(path);
                    if (success) {
                        return Math.round(parseInt(content.toString().trim()) / 1000);
                    }
                }
            }
        } catch (e) {}
        return null;
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);

        let scale = s / 120;
        let pad = 12 * scale;

        let labelLayout = PangoCairo.create_layout(cr);
        labelLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
        labelLayout.set_text('CPU', -1);
        let [lw, lh] = labelLayout.get_pixel_size();
        let labelColor = accentColor.copy();
        labelColor.alpha = 0.7;
        Gdk.cairo_set_source_rgba(cr, labelColor);
        cr.moveTo(dx + padding / 2 + pad, dy + padding / 2 + 10 * scale);
        PangoCairo.show_layout(cr, labelLayout);

        let pctLayout = PangoCairo.create_layout(cr);
        pctLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(10 * scale)}`));
        pctLayout.set_text(`${this._usage}%`, -1);
        let [pw, ph] = pctLayout.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(dx + padding / 2 + sw - pad - pw, dy + padding / 2 + 8 * scale);
        PangoCairo.show_layout(cr, pctLayout);

        let headerHeight = Math.max(lh, ph);
        let graphTop = dy + padding / 2 + 10 * scale + headerHeight + 10 * scale;
        let graphBottom = dy + padding / 2 + sh - (this._temp !== null ? 22 * scale : 12 * scale);
        let graphH = Math.max(10, graphBottom - graphTop);
        let graphW = sw - pad * 2;
        let barW = graphW / 20;
        let barGap = barW * 0.25;
        let barRealW = Math.max(1, barW - barGap);

        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineWidth(barRealW);

        for (let i = 0; i < 20; i++) {
            let val = this._history[i];
            let barH = Math.max(barRealW, (val / 100) * graphH);
            let x = dx + padding / 2 + pad + i * barW + barRealW / 2 + barGap / 2;
            let y = graphBottom - barH;

            let bgColor = accentColor.copy();
            bgColor.alpha = 0.16;
            Gdk.cairo_set_source_rgba(cr, bgColor);
            cr.moveTo(x, graphBottom);
            cr.lineTo(x, graphTop);
            cr.stroke();

            let fillColor;
            if (val > 85) {
                fillColor = new Gdk.RGBA({ red: 0.92, green: 0.22, blue: 0.20, alpha: 1 });
            } else if (val > 60) {
                fillColor = new Gdk.RGBA({ red: 0.98, green: 0.76, blue: 0.0, alpha: 1 });
            } else {
                fillColor = accentColor;
            }
            Gdk.cairo_set_source_rgba(cr, fillColor);
            cr.moveTo(x, graphBottom);
            cr.lineTo(x, y);
            cr.stroke();
        }

        if (this._temp !== null) {
            let tempStr = `${this._temp}°C`;
            let tempLayout = PangoCairo.create_layout(cr);
            tempLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7.5 * scale)}`));
            tempLayout.set_text(tempStr, -1);
            let [tw, th] = tempLayout.get_pixel_size();
            let px = 5 * scale, py = 1.5 * scale;
            let pillW = tw + px * 2, pillH = th + py * 2;
            let pillX = dx + padding / 2 + sw - pad - pillW;
            let pillY = graphBottom + 4 * scale;

            let pillBg = accentColor.copy();
            pillBg.alpha = 0.18;
            Gdk.cairo_set_source_rgba(cr, pillBg);
            this._roundedRectangle(cr, pillX, pillY, pillW, pillH, pillH / 2);
            cr.fill();

            Gdk.cairo_set_source_rgba(cr, accentColor);
            cr.moveTo(pillX + px, pillY + py);
            PangoCairo.show_layout(cr, tempLayout);
        }
    }
};
