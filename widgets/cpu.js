'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const BaseWidget = imports.widgets.baseWidget;

/**
 * Lógica para el widget de CPU. Calcula el uso del procesador y la temperatura.
 * Muestra el porcentaje de uso y, al expandirse, la temperatura del procesador.
 */
var CpuWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._lastTotal = 0;
        this._lastIdle = 0;
        this._usage = 0;
        this._temp = null;
    }

    update() {
        this._usage = this._getCPUUsage();
        this._temp = this._getCPUTemp();
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
        let r = 20;
        
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 26/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, 5, 5, width - 10, height - 10, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        let scale = Math.min(width, height) / 120;

        
        this._drawCpuIcon(cr, 20, 20, 16 * scale, accentColor);

        
        let layoutUsage = PangoCairo.create_layout(cr);
        layoutUsage.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(24 * scale)}`));
        layoutUsage.set_text(`${this._usage}%`, -1);
        let [uw, uh] = layoutUsage.get_pixel_size();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
        cr.moveTo(width/2 - uw/2, height/2 - uh/2);
        PangoCairo.show_layout(cr, layoutUsage);

        
        if ((gridWidth > 2 || gridHeight > 2) && this._temp !== null) {
            let layoutTemp = PangoCairo.create_layout(cr);
            layoutTemp.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(10 * scale)}`));
            layoutTemp.set_text(`${this._temp}°C`, -1);
            let [tw, th] = layoutTemp.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, accentColor);
            cr.moveTo(width/2 - tw/2, height/2 + uh/2 + 5);
            PangoCairo.show_layout(cr, layoutTemp);
        }
    }

    _drawCpuIcon(cr, x, y, size, color) {
        Gdk.cairo_set_source_rgba(cr, color);
        cr.setLineWidth(1.5 * (size/16));
        cr.rectangle(x + size*0.2, y + size*0.2, size*0.6, size*0.6);
        cr.stroke();
        for (let i = 0; i < 3; i++) {
            let offset = size * 0.3 + i * size * 0.2;
            cr.moveTo(x + offset, y); cr.lineTo(x + offset, y + size*0.15);
            cr.moveTo(x + offset, y + size*0.85); cr.lineTo(x + offset, y + size);
            cr.moveTo(x, y + offset); cr.lineTo(x + size*0.15, y + offset);
            cr.moveTo(x + size*0.85, y + offset); cr.lineTo(x + size, y + offset);
        }
        cr.stroke();
    }
};