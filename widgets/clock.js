'use strict';

const { Gdk, GLib } = imports.gi;
const Cairo = imports.gi.cairo;

/**
 * Logic for the Clock widget, responsible for calculating time and drawing 
 * an analog clock using the Cairo graphics library.
 */
var ClockWidget = class {
    draw(cr, cx, cy, size) {
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20;

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 28/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        let now = new Date();
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

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 255/255, green: 69/255, blue: 0, alpha: 1 }));
        cr.setLineWidth(2);
        cr.moveTo(cx, cy);
        cr.lineTo(cx + Math.cos(sAngle) * (size * 0.42), cy + Math.sin(sAngle) * (size * 0.42));
        cr.stroke();
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