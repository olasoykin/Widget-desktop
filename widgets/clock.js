'use strict';

const { Gdk, GLib } = imports.gi;
const Cairo = imports.gi.cairo;

/**
 * Clock logic
 */
var ClockWidget = class {
    draw(cr, cx, cy, size) {
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20;

        // 1. Main background
        cr.set_source_rgb(245/255, 245/255, 247/255);
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fill_preserve();
        cr.set_source_rgb(210/255, 210/255, 215/255);
        cr.set_line_width(1);
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

        cr.set_line_cap(Cairo.LineCap.ROUND);

        // 4. Hours hand
        cr.set_source_rgb(0, 0, 0);
        cr.set_line_width(6);
        cr.move_to(cx, cy);
        cr.line_to(cx + Math.cos(hAngle) * (size * 0.25), cy + Math.sin(hAngle) * (size * 0.25));
        cr.stroke();

        // 5. Minutes hand
        cr.set_line_width(4);
        cr.move_to(cx, cy);
        cr.line_to(cx + Math.cos(mAngle) * (size * 0.38), cy + Math.sin(mAngle) * (size * 0.38));
        cr.stroke();

        // 6. Seconds hand
        cr.set_source_rgb(255/255, 69/255, 0);
        cr.set_line_width(2);
        cr.move_to(cx, cy);
        cr.line_to(cx + Math.cos(sAngle) * (size * 0.42), cy + Math.sin(sAngle) * (size * 0.42));
        cr.stroke();
    }

    _roundedRectangle(cr, x, y, w, h, r) {
        cr.new_sub_path();
        cr.arc(x + w - r, y + r, r, -Math.PI/2, 0);
        cr.arc(x + w - r, y + h - r, r, 0, Math.PI/2);
        cr.arc(x + r, y + h - r, r, Math.PI/2, Math.PI);
        cr.arc(x + r, y + r, r, Math.PI, 3*Math.PI/2);
        cr.close_path();
    }
};