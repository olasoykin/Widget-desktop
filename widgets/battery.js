'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;

/**
 * Battery widget. Material You pill design.
 * Reads level and charging status from /sys/class/power_supply/.
 */
var BatteryWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._percent = 100;
        this._charging = false;
        this._hasBattery = false;
        this.update();
    }

    update() {
        try {
            let basePath = '/sys/class/power_supply';
            let dir = imports.gi.Gio.File.new_for_path(basePath);
            let enumerator = dir.enumerate_children('standard::name', 0, null);
            let info;
            while ((info = enumerator.next_file(null))) {
                let name = info.get_name();
                if (name.startsWith('BAT')) {
                    let capacityPath = `${basePath}/${name}/capacity`;
                    let statusPath = `${basePath}/${name}/status`;
                    let [okC, capContent] = GLib.file_get_contents(capacityPath);
                    let [okS, statContent] = GLib.file_get_contents(statusPath);
                    if (okC) {
                        this._percent = parseInt(capContent.toString().trim()) || 0;
                        this._hasBattery = true;
                    }
                    if (okS) {
                        let status = statContent.toString().trim();
                        this._charging = (status === 'Charging' || status === 'Full');
                    }
                    break;
                }
            }
        } catch (e) {
            this._hasBattery = false;
        }
    }

    _getBatteryColor(percent, accentColor) {
        if (percent > 50) return accentColor;
        if (percent > 20) return new Gdk.RGBA({ red: 0.98, green: 0.76, blue: 0.0, alpha: 1 });
        return new Gdk.RGBA({ red: 0.92, green: 0.22, blue: 0.20, alpha: 1 });
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);

        let cx = dx + padding / 2 + s / 2;
        let cy = dy + padding / 2 + s / 2;
        let scale = s / 120;

        let fillColor = this._getBatteryColor(this._percent, accentColor);

        let pillW = s * 0.38;
        let pillH = s * 0.65;
        let pillX = cx - pillW / 2;
        let pillY = cy - pillH / 2 + 4 * scale;
        let pillR = pillW / 2;

        let bgPill = fillColor.copy();
        bgPill.alpha = 0.18;
        Gdk.cairo_set_source_rgba(cr, bgPill);
        this._roundedRectangle(cr, pillX, pillY, pillW, pillH, pillR);
        cr.fill();

        let tipW = pillW * 0.38;
        let tipH = 6 * scale;
        let tipBg = fillColor.copy();
        tipBg.alpha = 0.35;
        Gdk.cairo_set_source_rgba(cr, tipBg);
        this._roundedRectangle(cr, cx - tipW / 2, pillY - tipH + 1, tipW, tipH * 1.5, tipH / 2);
        cr.fill();

        let fillHeight = pillH * (this._percent / 100);
        let fillY = pillY + pillH - fillHeight;

        cr.save();
        this._roundedRectangle(cr, pillX, pillY, pillW, pillH, pillR);
        cr.clip();
        Gdk.cairo_set_source_rgba(cr, fillColor);
        cr.rectangle(pillX, fillY, pillW, fillHeight);
        cr.fill();
        cr.restore();

        let pctText = this._hasBattery ? `${this._percent}` : 'AC';
        let layoutPct = PangoCairo.create_layout(cr);
        layoutPct.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(19 * scale)}`));
        layoutPct.set_text(pctText, -1);
        let [pw, ph] = layoutPct.get_pixel_size();

        let fillRatio = this._percent / 100;
        let textIsBelowFill = cy > fillY;
        let textColor;
        if (textIsBelowFill && fillRatio > 0.45) {
            textColor = new Gdk.RGBA({ red: 0.07, green: 0.07, blue: 0.07, alpha: 1 });
        } else {
            textColor = new Gdk.RGBA({ red: 0.9, green: 0.9, blue: 0.92, alpha: 1 });
        }
        Gdk.cairo_set_source_rgba(cr, textColor);
        cr.moveTo(cx - pw / 2, cy - ph / 2 + 4 * scale);
        PangoCairo.show_layout(cr, layoutPct);

        if (this._hasBattery) {
            let pctSignLayout = PangoCairo.create_layout(cr);
            pctSignLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
            pctSignLayout.set_text('%', -1);
            let [psw, psh] = pctSignLayout.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, textColor);
            cr.moveTo(cx + pw / 2 - psw / 2, cy - ph / 2 + 3 * scale);
            PangoCairo.show_layout(cr, pctSignLayout);
        }

        if (this._charging && this._hasBattery) {
            let boltColor = new Gdk.RGBA({ red: 0.07, green: 0.07, blue: 0.07, alpha: 0.85 });
            Gdk.cairo_set_source_rgba(cr, boltColor);
            let bY = cy + ph / 2 + 4 * scale;
            let bs = 8 * scale;
            cr.moveTo(cx + bs * 0.3, bY);
            cr.lineTo(cx - bs * 0.4, bY + bs * 0.7);
            cr.lineTo(cx + bs * 0.05, bY + bs * 0.7);
            cr.lineTo(cx - bs * 0.3, bY + bs * 1.4);
            cr.lineTo(cx + bs * 0.4, bY + bs * 0.6);
            cr.lineTo(cx + bs * 0.0, bY + bs * 0.6);
            cr.closePath();
            cr.fill();
        }

        let bottomLabel = this._hasBattery ? 'BAT' : 'AC';
        if (!this._hasBattery) {
            let labelLayout = PangoCairo.create_layout(cr);
            labelLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
            labelLayout.set_text(bottomLabel, -1);
            let [lw, lh] = labelLayout.get_pixel_size();
            let labelColor = accentColor.copy();
            labelColor.alpha = 0.6;
            Gdk.cairo_set_source_rgba(cr, labelColor);
            cr.moveTo(cx - lw / 2, pillY + pillH + 6 * scale);
            PangoCairo.show_layout(cr, labelLayout);
        }

        let borderColor = fillColor.copy();
        borderColor.alpha = 0.35;
        Gdk.cairo_set_source_rgba(cr, borderColor);
        this._roundedRectangle(cr, pillX, pillY, pillW, pillH, pillR);
        cr.setLineWidth(1.5);
        cr.stroke();
    }
};
