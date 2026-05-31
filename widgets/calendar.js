'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;

/**
 * Calendar logic
 */
var CalendarWidget = class {
    constructor() {
        this.today = new Date();
    }

    draw(cr, cx, cy, size) {
        this.today = new Date();
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20; // Smooth border radius

        // 1. Main background
        cr.set_source_rgb(245/255, 245/255, 247/255);
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fill_preserve();
        cr.set_source_rgb(210/255, 210/255, 215/255);
        cr.set_line_width(1);
        cr.stroke();

        // 2. Header: Month and Year
        cr.set_source_rgb(29/255, 29/255, 31/255);
        let monthName = this.today.toLocaleDateString(undefined, { month: 'long' }).toUpperCase();
        let headerText = `${monthName} ${this.today.getFullYear()}`;
        let layoutHeader = PangoCairo.create_layout(cr); // FIX: Use PangoCairo.create_layout(cr)
        layoutHeader.set_font_description(Pango.FontDescription.from_string("Sans Bold 14"));
        layoutHeader.set_text(headerText, -1);
        cr.move_to(x + 25, y + 20);
        PangoCairo.show_layout(cr, layoutHeader);

        // 3. Days of the week
        cr.set_source_rgb(134/255, 134/255, 139/255);
        let daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];
        let spacingX = (size - 40) / 7;
        let gridStartY = y + 60;

        daysOfWeek.forEach((day, i) => {
            let dayLayout = PangoCairo.create_layout(cr); // FIX: Use PangoCairo.create_layout(cr)
            dayLayout.set_font_description(Pango.FontDescription.from_string("Sans Bold 10"));
            dayLayout.set_text(day, -1);
            let [tw, th] = dayLayout.get_pixel_size();
            cr.move_to(x + 20 + (i * spacingX) + (spacingX/2 - tw/2), gridStartY);
            PangoCairo.show_layout(cr, dayLayout);
        });

        // 4. Days of the month
        let firstDay = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
        let startOffset = (firstDay.getDay() + 6) % 7; // Adjust for Monday starting at 0
        let lastDayOfMonth = new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0).getDate();

        for (let day = 1; day <= lastDayOfMonth; day++) {
            let column = (day - 1 + startOffset) % 7;
            let row = Math.floor((day - 1 + startOffset) / 7);
            let dx = x + 20 + (column * spacingX) + spacingX/2;
            let dy = gridStartY + 30 + (row * 25);

            let numLayout = PangoCairo.create_layout(cr); // FIX: Use PangoCairo.create_layout(cr)
            numLayout.set_font_description(Pango.FontDescription.from_string("Sans 11"));
            numLayout.set_text(day.toString(), -1);
            let [nw, nh] = numLayout.get_pixel_size();

            if (day === this.today.getDate()) {
                cr.set_source_rgb(255/255, 59/255, 48/255);
                cr.arc(dx, dy + nh/2 - 2, 12, 0, 2 * Math.PI);
                cr.fill();
                cr.set_source_rgb(1, 1, 1);
            } else {
                cr.set_source_rgb(29/255, 29/255, 31/255);
            }
            cr.move_to(dx - nw/2, dy);
            PangoCairo.show_layout(cr, numLayout);
        }
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