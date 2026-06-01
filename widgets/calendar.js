'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;

/**
 * Logic for the Calendar widget, handles date calculation and UI rendering 
 * for a monthly view using Cairo and Pango for text layouts.
 */
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
var CalendarWidget = class {
    constructor() {
        this.today = new Date();
    }

    draw(cr, cx, cy, size) {
        this.today = new Date();
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20; // Smooth border radius

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 28/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        let now = new Date();
        let month = now.getMonth();
        let year = now.getFullYear();
        let dayOfMonth = now.getDate();

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 255/255, green: 255/255, blue: 255/255, alpha: 1 }));
        let headerText = `${MONTHS[month]} ${year}`;
        let layoutHeader = PangoCairo.create_layout(cr);
        layoutHeader.set_font_description(Pango.FontDescription.from_string("Sans Bold 12"));
        layoutHeader.set_text(headerText, -1);
        cr.moveTo(x + 20, y + 15);
        PangoCairo.update_layout(cr, layoutHeader);
        PangoCairo.show_layout(cr, layoutHeader);

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 174/255, green: 174/255, blue: 178/255, alpha: 1 }));
        let daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];
        let spacingX = (size - 30) / 7;
        let gridStartY = y + 42;

        let dayLayout = PangoCairo.create_layout(cr);
        dayLayout.set_font_description(Pango.FontDescription.from_string("Sans Bold 9"));

        daysOfWeek.forEach((day, i) => {
            dayLayout.set_text(day, -1);
            let [tw, th] = dayLayout.get_pixel_size();
            cr.moveTo(x + 15 + (i * spacingX) + (spacingX/2 - tw/2), gridStartY);
            PangoCairo.update_layout(cr, dayLayout);
            PangoCairo.show_layout(cr, dayLayout);
        });

        let firstDay = new Date(year, month, 1);
        let startOffset = (firstDay.getDay() + 6) % 7; // Adjust for Monday starting at 0
        let lastDayOfMonth = new Date(year, month + 1, 0).getDate();

        let numLayout = PangoCairo.create_layout(cr);
        numLayout.set_font_description(Pango.FontDescription.from_string("Sans 10"));

        for (let day = 1; day <= lastDayOfMonth; day++) {
            let column = (day - 1 + startOffset) % 7;
            let row = Math.floor((day - 1 + startOffset) / 7);
            let dx = x + 15 + (column * spacingX) + spacingX/2;
            let dy = gridStartY + 20 + (row * 19);
            
            numLayout.set_text(day.toString(), -1);
            let [nw, nh] = numLayout.get_pixel_size();

            if (day === dayOfMonth) {
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 255/255, green: 59/255, blue: 48/255, alpha: 1 }));
                cr.arc(dx, dy + nh/2 + 1, 9, 0, 2 * Math.PI);
                cr.fill();
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
            } else {
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 235/255, green: 235/255, blue: 245/255, alpha: 1 }));
            }
            cr.moveTo(dx - nw/2, dy);
            PangoCairo.update_layout(cr, numLayout);
            PangoCairo.show_layout(cr, numLayout);
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