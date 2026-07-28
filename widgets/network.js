'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;

/**
 * Real-time network speed widget.
 * Shows download (↓) and upload (↑) speeds + visual traffic bars.
 */
var NetworkWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._lastRx = 0;
        this._lastTx = 0;
        this._lastTime = 0;
        this._rxSpeed = 0;
        this._txSpeed = 0;
        this._rxHistory = new Array(20).fill(0);
        this._txHistory = new Array(20).fill(0);
        this.update();
    }

    update() {
        try {
            let [ok, content] = GLib.file_get_contents('/proc/net/dev');
            if (!ok) return;
            let lines = content.toString().split('\n');
            let totalRx = 0, totalTx = 0;
            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('Inter') || line.startsWith('face')) continue;
                let parts = line.split(/\s+/);
                let iface = parts[0].replace(':', '');
                if (iface === 'lo') continue;
                totalRx += parseInt(parts[1]) || 0;
                totalTx += parseInt(parts[9]) || 0;
            }
            let now = GLib.get_monotonic_time() / 1000000;
            if (this._lastTime > 0) {
                let dt = now - this._lastTime;
                if (dt > 0) {
                    this._rxSpeed = Math.max(0, (totalRx - this._lastRx) / dt);
                    this._txSpeed = Math.max(0, (totalTx - this._lastTx) / dt);
                    this._rxHistory.shift();
                    this._rxHistory.push(this._rxSpeed);
                    this._txHistory.shift();
                    this._txHistory.push(this._txSpeed);
                }
            }
            this._lastRx = totalRx;
            this._lastTx = totalTx;
            this._lastTime = now;
        } catch (e) {}
    }

    _formatSpeed(bps) {
        if (bps > 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
        if (bps > 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
        return `${Math.round(bps)} B/s`;
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);

        let scale = s / 120;
        let pad = 12 * scale;

        let netLayout = PangoCairo.create_layout(cr);
        netLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7.5 * scale)}`));
        netLayout.set_text('NET', -1);
        let [nlw, nlh] = netLayout.get_pixel_size();
        let lpx = 5 * scale, lpy = 1.5 * scale;
        let chipW = nlw + lpx * 2, chipH = nlh + lpy * 2;
        let chipBg = accentColor.copy();
        chipBg.alpha = 0.18;
        Gdk.cairo_set_source_rgba(cr, chipBg);
        this._roundedRectangle(cr, dx + padding / 2 + pad, dy + padding / 2 + 8 * scale, chipW, chipH, chipH / 2);
        cr.fill();
        let labelColor = accentColor.copy();
        labelColor.alpha = 0.85;
        Gdk.cairo_set_source_rgba(cr, labelColor);
        cr.moveTo(dx + padding / 2 + pad + lpx, dy + padding / 2 + 8 * scale + lpy);
        PangoCairo.show_layout(cr, netLayout);

        let graphTop = dy + padding / 2 + chipH + 16 * scale;
        let graphBottom = dy + padding / 2 + sh - 22 * scale;
        let graphH = Math.max(10, graphBottom - graphTop);
        let graphW = sw - pad * 2;
        let barW = graphW / 20;
        let barRealW = Math.max(1, barW * 0.7);

        let maxVal = Math.max(...this._rxHistory, ...this._txHistory, 1024);

        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineWidth(barRealW);

        let txColor = accentColor.copy();
        txColor.alpha = 0.25;
        Gdk.cairo_set_source_rgba(cr, txColor);
        for (let i = 0; i < 20; i++) {
            let barH = Math.max(barRealW, (this._txHistory[i] / maxVal) * graphH);
            let x = dx + padding / 2 + pad + i * barW + barRealW / 2;
            cr.moveTo(x, graphBottom);
            cr.lineTo(x, graphBottom - barH);
            cr.stroke();
        }

        Gdk.cairo_set_source_rgba(cr, accentColor);
        for (let i = 0; i < 20; i++) {
            let barH = Math.max(barRealW, (this._rxHistory[i] / maxVal) * graphH);
            let x = dx + padding / 2 + pad + i * barW + barRealW / 2;
            cr.moveTo(x, graphBottom);
            cr.lineTo(x, graphBottom - barH);
            cr.stroke();
        }

        let rxLabel = `↓ ${this._formatSpeed(this._rxSpeed)}`;
        let txLabel = `↑ ${this._formatSpeed(this._txSpeed)}`;

        let layoutRx = PangoCairo.create_layout(cr);
        layoutRx.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(6.5 * scale)}`));
        layoutRx.set_text(rxLabel, -1);
        let [rlw, rlh] = layoutRx.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(dx + padding / 2 + pad, graphBottom + 4 * scale);
        PangoCairo.show_layout(cr, layoutRx);

        let layoutTx = PangoCairo.create_layout(cr);
        layoutTx.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(6.5 * scale)}`));
        layoutTx.set_text(txLabel, -1);
        let [tlw, tlh] = layoutTx.get_pixel_size();
        let txLabelColor = accentColor.copy();
        txLabelColor.alpha = 0.6;
        Gdk.cairo_set_source_rgba(cr, txLabelColor);
        cr.moveTo(dx + padding / 2 + sw - pad - tlw, graphBottom + 4 * scale);
        PangoCairo.show_layout(cr, layoutTx);
    }
};
