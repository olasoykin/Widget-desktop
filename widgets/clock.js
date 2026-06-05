'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;

var ClockWidget = class {
    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let r = 20;

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 26/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, 5, 5, width - 10, height - 10, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        let now = new Date();

        if (gridWidth === 4 && gridHeight === 2) {
            let scale = height / 120;
            let leftW = width * 0.4;
            let leftCX = leftW / 2;

            let hours = now.getHours().toString().padStart(2, '0');
            let minutes = now.getMinutes().toString().padStart(2, '0');

            let layoutH = PangoCairo.create_layout(cr);
            layoutH.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(26 * scale)}`));
            layoutH.set_text(hours, -1);
            let [hw, hh] = layoutH.get_pixel_size();

            let layoutM = PangoCairo.create_layout(cr);
            layoutM.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(26 * scale)}`));
            layoutM.set_text(minutes, -1);
            let [mw, mh] = layoutM.get_pixel_size();

            let totalTimeHeight = hh + mh - 5 * scale;
            let startY = (height - totalTimeHeight) / 2;

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
            cr.moveTo(leftCX - hw / 2, startY);
            PangoCairo.update_layout(cr, layoutH);
            PangoCairo.show_layout(cr, layoutH);

            Gdk.cairo_set_source_rgba(cr, accentColor);
            cr.moveTo(leftCX - mw / 2, startY + hh - 5 * scale);
            PangoCairo.update_layout(cr, layoutM);
            PangoCairo.show_layout(cr, layoutM);

            let sepX = width * 0.4;
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 0.5 }));
            cr.setLineWidth(1.5);
            cr.moveTo(sepX, 20);
            cr.lineTo(sepX, height - 20);
            cr.stroke();

            let rightCX = sepX + (width - sepX) / 2;
            let rightCY = height / 2;
            let analogSize = Math.min(width - sepX, height) - 20;

            let h = now.getHours() % 12;
            let m = now.getMinutes();
            let s = now.getSeconds();

            let hAngle = (h * 30 + m * 0.5 - 90) * Math.PI / 180;
            let mAngle = (m * 6 - 90) * Math.PI / 180;
            let sAngle = (s * 6 - 90) * Math.PI / 180;

            cr.setLineCap(Cairo.LineCap.ROUND);

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
            cr.setLineWidth(5 * scale);
            cr.moveTo(rightCX, rightCY);
            cr.lineTo(rightCX + Math.cos(hAngle) * (analogSize * 0.25), rightCY + Math.sin(hAngle) * (analogSize * 0.25));
            cr.stroke();

            cr.setLineWidth(3 * scale);
            cr.moveTo(rightCX, rightCY);
            cr.lineTo(rightCX + Math.cos(mAngle) * (analogSize * 0.38), rightCY + Math.sin(mAngle) * (analogSize * 0.38));
            cr.stroke();

            Gdk.cairo_set_source_rgba(cr, accentColor);
            cr.setLineWidth(1.5 * scale);
            cr.moveTo(rightCX, rightCY);
            cr.lineTo(rightCX + Math.cos(sAngle) * (analogSize * 0.42), rightCY + Math.sin(sAngle) * (analogSize * 0.42));
            cr.stroke();
        } else {
            let size = Math.min(width, height) - 10;
            let cx = width / 2;
            let cy = height / 2;

            let h = now.getHours() % 12;
            let m = now.getMinutes();
            let s = now.getSeconds();

            let hAngle = (h * 30 + m * 0.5 - 90) * Math.PI / 180;
            let mAngle = (m * 6 - 90) * Math.PI / 180;
            let sAngle = (s * 6 - 90) * Math.PI / 180;

            cr.setLineCap(Cairo.LineCap.ROUND);

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 255/255, green: 255/255, blue: 255/255, alpha: 1 }));
            cr.setLineWidth(6);
            cr.moveTo(cx, cy);
            cr.lineTo(cx + Math.cos(hAngle) * (size * 0.25), cy + Math.sin(hAngle) * (size * 0.25));
            cr.stroke();

            cr.setLineWidth(4);
            cr.moveTo(cx, cy);
            cr.lineTo(cx + Math.cos(mAngle) * (size * 0.38), cy + Math.sin(mAngle) * (size * 0.38));
            cr.stroke();

            Gdk.cairo_set_source_rgba(cr, accentColor);
            cr.setLineWidth(2);
            cr.moveTo(cx, cy);
            cr.lineTo(cx + Math.cos(sAngle) * (size * 0.42), cy + Math.sin(sAngle) * (size * 0.42));
            cr.stroke();
        }
    }

    _roundedRectangle(cr, x, y, w, h, r) {
        cr.newSubPath();
        cr.arc(x + w - r, y + r, r, -Math.PI/2, 0);
        cr.arc(x + w - r, y + h - r, r, 0, Math.PI/2);
        cr.arc(x + r, y + h - r, r, Math.PI/2, Math.PI);
        cr.arc(x + r, y + r, r, Math.PI, 3*Math.PI/2);
        cr.closePath();
    }
};