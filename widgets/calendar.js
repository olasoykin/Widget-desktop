'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;

/**
 * Calendar logic
 */
var CalendarioWidget = class {
    constructor() {
        this.hoy = new Date();
    }

    draw(widget, cr, cx, cy, size) {
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20; // Smooth border radius

        // 1. Main background
        cr.setSourceRGB(245/255, 245/255, 247/255);
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fillPreserve();
        cr.setSourceRGB(210/255, 210/255, 215/255);
        cr.setLineWidth(1);
        cr.stroke();

        // 2. Header: Month and Year
        cr.setSourceRGB(29/255, 29/255, 31/255);
        let monthName = this.hoy.toLocaleDateString(undefined, { month: 'long' }).toUpperCase();
        let headerText = `${monthName} ${this.hoy.getFullYear()}`;
        let layoutHeader = widget.create_pango_layout(headerText);
        layoutHeader.set_font_description(Pango.FontDescription.from_string("Sans Bold 14"));
        cr.moveTo(x + 25, y + 20);
        PangoCairo.show_layout(cr, layoutHeader);

        // 3. Days of the week
        cr.setSourceRGB(134/255, 134/255, 139/255);
        let diasSemana = ["L", "M", "M", "J", "V", "S", "D"];
        let espaciadoX = (size - 40) / 7;
        let inicioGridY = y + 60;

        diasSemana.forEach((dia, i) => {
            let layoutDia = widget.create_pango_layout(dia);
            layoutDia.set_font_description(Pango.FontDescription.from_string("Sans Bold 10"));
            let [tw, th] = layoutDia.get_pixel_size();
            cr.moveTo(x + 20 + (i * espaciadoX) + (espaciadoX/2 - tw/2), inicioGridY);
            PangoCairo.show_layout(cr, layoutDia);
        });

        // 4. Days of the month
        let primerDia = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);
        let despliegueInicio = (primerDia.getDay() + 6) % 7; // Adjust for Monday starting at 0
        let ultimoDiaMes = new Date(this.hoy.getFullYear(), this.hoy.getMonth() + 1, 0).getDate();

        for (let dia = 1; dia <= ultimoDiaMes; dia++) {
            let columna = (dia - 1 + despliegueInicio) % 7;
            let fila = Math.floor((dia - 1 + despliegueInicio) / 7);
            let dx = x + 20 + (columna * espaciadoX) + espaciadoX/2;
            let dy = inicioGridY + 30 + (fila * 25);

            let layoutNum = widget.create_pango_layout(dia.toString());
            layoutNum.set_font_description(Pango.FontDescription.from_string("Sans 11"));
            let [nw, nh] = layoutNum.get_pixel_size();

            if (dia === this.hoy.getDate()) {
                cr.setSourceRGB(255/255, 59/255, 48/255);
                cr.arc(dx, dy + nh/2 - 2, 12, 0, 2 * Math.PI);
                cr.fill();
                cr.setSourceRGB(1, 1, 1);
            } else {
                cr.setSourceRGB(29/255, 29/255, 31/255);
            }
            cr.moveTo(dx - nw/2, dy);
            PangoCairo.show_layout(cr, layoutNum);
        }
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