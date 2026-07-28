'use strict';

const { Gdk, GLib, Pango, PangoCairo } = imports.gi;
const BaseWidget = imports.widgets.baseWidget;
const Cairo = imports.gi.cairo;

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

var CalendarWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this.today = new Date();
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);

        let now = new Date();
        let month = now.getMonth();
        let year = now.getFullYear();
        let dayOfMonth = now.getDate();

        let pastelText = this._getPastelColor(accentColor);
        let pastelDim = this._getPastelDimColor(accentColor);

        if (gridWidth === 4 && gridHeight === 2) {
            this._draw4x2(cr, dx, dy, sw, sh, padding, accentColor, now, month, year, dayOfMonth, pastelText, pastelDim);
        } else {
            this._drawSquare(cr, dx, dy, sw, sh, padding, accentColor, month, year, dayOfMonth, pastelText, pastelDim);
        }
    }

    _draw4x2(cr, dx, dy, sw, sh, padding, accentColor, now, month, year, dayOfMonth, pastelText, pastelDim) {
        let scale = sh / 120;
        let leftW = sw * 0.38;
        let leftCX = dx + padding / 2 + leftW / 2;

        let dayName = DAYS_FULL[now.getDay()].toUpperCase();
        let dayNum = dayOfMonth.toString();
        let monthYearStr = `${MONTHS[month].toUpperCase()} ${year}`;

        let dnLayout = PangoCairo.create_layout(cr);
        dnLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(6.5 * scale)}`));
        dnLayout.set_text(dayName, -1);
        let [dnw, dnh] = dnLayout.get_pixel_size();
        let dnPX = 5 * scale, dnPY = 1.5 * scale;
        let dnChipH = dnh + dnPY * 2;

        let numLayout = PangoCairo.create_layout(cr);
        numLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(28 * scale)}`));
        numLayout.set_text(dayNum, -1);
        let [nnw, nnh] = numLayout.get_pixel_size();

        let myLayout = PangoCairo.create_layout(cr);
        myLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7 * scale)}`));
        myLayout.set_text(monthYearStr, -1);
        let [myw, myh] = myLayout.get_pixel_size();

        let totalLeftH = dnChipH + 3 * scale + nnh + 3 * scale + myh;
        let startY = dy + padding / 2 + (sh - totalLeftH) / 2;

        let dnChipW = dnw + dnPX * 2;
        let dnChipX = leftCX - dnChipW / 2;
        let chipBg = accentColor.copy();
        chipBg.alpha = 0.18;
        Gdk.cairo_set_source_rgba(cr, chipBg);
        this._roundedRectangle(cr, dnChipX, startY, dnChipW, dnChipH, dnChipH / 2);
        cr.fill();

        let dnTextColor = accentColor.copy();
        dnTextColor.alpha = 0.85;
        Gdk.cairo_set_source_rgba(cr, dnTextColor);
        cr.moveTo(dnChipX + dnPX, startY + dnPY);
        PangoCairo.show_layout(cr, dnLayout);

        Gdk.cairo_set_source_rgba(cr, accentColor);
        cr.moveTo(leftCX - nnw / 2, startY + dnChipH + 3 * scale);
        PangoCairo.show_layout(cr, numLayout);

        Gdk.cairo_set_source_rgba(cr, pastelText);
        cr.moveTo(leftCX - myw / 2, startY + dnChipH + 3 * scale + nnh + 3 * scale);
        PangoCairo.show_layout(cr, myLayout);

        let sepX = dx + padding / 2 + leftW + 6 * scale;
        let sepColor = accentColor.copy();
        sepColor.alpha = 0.14;
        Gdk.cairo_set_source_rgba(cr, sepColor);
        cr.setLineWidth(1);
        cr.moveTo(sepX, dy + padding / 2 + 10 * scale);
        cr.lineTo(sepX, dy + padding / 2 + sh - 10 * scale);
        cr.stroke();

        let rightX = sepX + 8 * scale;
        let rightW = sw - (rightX - dx - padding / 2) - 6 * scale;
        this._drawCalendarGrid(cr, rightX, dy + padding / 2, rightW, sh, scale, accentColor, month, year, dayOfMonth, pastelText, pastelDim);
    }

    _drawSquare(cr, dx, dy, sw, sh, padding, accentColor, month, year, dayOfMonth, pastelText, pastelDim) {
        let scale = Math.min(sw, sh) / 120;
        let startX = dx + padding / 2 + 6 * scale;
        let availW = sw - 12 * scale;
        this._drawCalendarGrid(cr, startX, dy + padding / 2, availW, sh, scale, accentColor, month, year, dayOfMonth, pastelText, pastelDim);
    }

    _drawCalendarGrid(cr, startX, startY, availW, availH, scale, accentColor, month, year, dayOfMonth, pastelText, pastelDim) {
        let headerText = `${MONTHS[month]} ${year}`;

        let headerLayout = PangoCairo.create_layout(cr);
        headerLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
        headerLayout.set_text(headerText, -1);
        let [hw, hh] = headerLayout.get_pixel_size();

        let rowSpacing = 13 * scale;
        let firstDay = new Date(year, month, 1);
        let startOffset = (firstDay.getDay() + 6) % 7;
        let lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        let totalRows = Math.ceil((lastDayOfMonth + startOffset) / 7);

        let dowH = 9 * scale;
        let totalGridH = hh + 5 * scale + dowH + 3 * scale + totalRows * rowSpacing;
        let gridTopY = startY + (availH - totalGridH) / 2;

        Gdk.cairo_set_source_rgba(cr, pastelText);
        cr.moveTo(startX + (availW - hw) / 2, gridTopY);
        PangoCairo.show_layout(cr, headerLayout);

        let spacingX = availW / 7;
        let daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        let dowY = gridTopY + hh + 5 * scale;

        let dowLayout = PangoCairo.create_layout(cr);
        dowLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(6 * scale)}`));
        let dowColor = accentColor.copy();
        dowColor.alpha = 0.55;
        Gdk.cairo_set_source_rgba(cr, dowColor);

        daysOfWeek.forEach((d, i) => {
            dowLayout.set_text(d, -1);
            let [dw, dh] = dowLayout.get_pixel_size();
            let cx = startX + i * spacingX + spacingX / 2;
            cr.moveTo(cx - dw / 2, dowY);
            PangoCairo.update_layout(cr, dowLayout);
            PangoCairo.show_layout(cr, dowLayout);
        });

        let numGridY = dowY + dowH + 3 * scale;
        let numLayout = PangoCairo.create_layout(cr);
        numLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7.5 * scale)}`));

        for (let day = 1; day <= lastDayOfMonth; day++) {
            let col = (day - 1 + startOffset) % 7;
            let row = Math.floor((day - 1 + startOffset) / 7);
            let cellCX = startX + col * spacingX + spacingX / 2;
            let cellCY = numGridY + row * rowSpacing + rowSpacing / 2;

            numLayout.set_text(day.toString(), -1);
            let [nw, nh] = numLayout.get_pixel_size();

            if (day === dayOfMonth) {
                let pillR = Math.min(spacingX * 0.38, 9 * scale);
                Gdk.cairo_set_source_rgba(cr, accentColor);
                cr.arc(cellCX, cellCY, pillR, 0, Math.PI * 2);
                cr.fill();
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 0.05, green: 0.05, blue: 0.05, alpha: 1 }));
            } else if (col >= 5) {
                Gdk.cairo_set_source_rgba(cr, pastelDim);
            } else {
                Gdk.cairo_set_source_rgba(cr, pastelText);
            }

            cr.moveTo(cellCX - nw / 2, cellCY - nh / 2);
            PangoCairo.update_layout(cr, numLayout);
            PangoCairo.show_layout(cr, numLayout);
        }
    }
};
