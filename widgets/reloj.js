'use strict';

const { Gdk, GLib } = imports.gi;
const Cairo = imports.gi.cairo;

/**
 * Clock logic
 */
var RelojWidget = class {
    draw(cr, cx, cy, size) {
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20;

        // 1. Main background
        cr.setSourceRGB(245/255, 245/255, 247/255);
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fillPreserve();
        cr.setSourceRGB(210/255, 210/255, 215/255);
        cr.setLineWidth(1);
        cr.stroke();

        // 2. Current time
        let now = new Date();
        let h = now.getHours() % 12;
        let m = now.getMinutes();
        let s = now.getSeconds();

        // 3. Hand angles
        let hAngle = (h * 30 + m * 0.5 - 90) * Math.PI / 180;
        let mAngle = (m * 6 - 90) * Math.PI / 180;
        let sAngle = (s * 6 - 90) * Math.PI / 180;

        cr.setLineCap(Cairo.LineCap.ROUND);

        // 4. Hours hand
        cr.setSourceRGB(0, 0, 0);
        cr.setLineWidth(6);
        cr.moveTo(cx, cy);
        cr.lineTo(cx + Math.cos(hAngle) * (size * 0.25), cy + Math.sin(hAngle) * (size * 0.25));
        cr.stroke();

        // 5. Minutes hand
        cr.setLineWidth(4);
        cr.moveTo(cx, cy);
        cr.lineTo(cx + Math.cos(mAngle) * (size * 0.38), cy + Math.sin(mAngle) * (size * 0.38));
        cr.stroke();

        // 6. Seconds hand
        cr.setSourceRGB(255/255, 69/255, 0);
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
        cr.closeSubPath();
    }
};