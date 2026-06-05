'use strict';

const { Gdk, GLib, Pango, PangoCairo, EDataServer, ECal } = imports.gi;
const BaseWidget = imports.widgets.baseWidget;
const Cairo = imports.gi.cairo;

/**
 * Logic for the Calendar widget. This class handles date calculation and UI rendering for a monthly view 
 * using Cairo and Pango for text layouts. It calculates a scaling factor based on a standard 200px 
 * size for consistent rendering across different dimensions, manages the grid alignment starting 
 * on Monday, and handles visual styling including a smooth border radius and highlighting 
 * for the current day of the month.
 */
const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const DAYS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];

var CalendarWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this.today = new Date();
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        this.today = new Date();
        let r = 20;

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 26/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, 5, 5, width - 10, height - 10, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        let now = new Date();
        let month = now.getMonth();
        let year = now.getFullYear();
        let dayOfMonth = now.getDate();

        if (gridWidth === 4 && gridHeight === 2) {
            let scale = height / 120;
            let leftW = width * 0.4;
            let leftCX = 15 + (leftW - 20) / 2;

            
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 32/255, green: 34/255, blue: 37/255, alpha: 1 }));
            this._roundedRectangle(cr, 15, 15, leftW - 20, height - 30, 15);
            cr.fillPreserve();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 0.3 }));
            cr.setLineWidth(1);
            cr.stroke();

            let dayName = DAYS[now.getDay()];
            let dayNum = dayOfMonth.toString().padStart(2, '0');
            let monthYear = `${MONTHS[month]} ${year}`;

            let layoutDayName = PangoCairo.create_layout(cr);
            layoutDayName.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8.5 * scale)}`));
            layoutDayName.set_text(dayName, -1);
            let [dnw, dnh] = layoutDayName.get_pixel_size();

            let layoutDayNum = PangoCairo.create_layout(cr);
            layoutDayNum.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(28 * scale)}`));
            layoutDayNum.set_text(dayNum, -1);
            let [dnumw, dnumh] = layoutDayNum.get_pixel_size();

            let layoutMonthYear = PangoCairo.create_layout(cr);
            layoutMonthYear.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7 * scale)}`));
            layoutMonthYear.set_text(monthYear, -1);
            let [mynw, mynh] = layoutMonthYear.get_pixel_size();

            let totalLeftHeight = dnh + dnumh + mynh;
            let startY = (height - totalLeftHeight) / 2;

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 235/255, green: 235/255, blue: 245/255, alpha: 0.6 }));
            cr.moveTo(leftCX - dnw / 2, startY);
            PangoCairo.update_layout(cr, layoutDayName);
            PangoCairo.show_layout(cr, layoutDayName);

            Gdk.cairo_set_source_rgba(cr, accentColor);
            cr.moveTo(leftCX - dnumw / 2, startY + dnh - 2 * scale);
            PangoCairo.update_layout(cr, layoutDayNum);
            PangoCairo.show_layout(cr, layoutDayNum);

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
            cr.moveTo(leftCX - mynw / 2, startY + dnh + dnumh - 4 * scale);
            PangoCairo.update_layout(cr, layoutMonthYear);
            PangoCairo.show_layout(cr, layoutMonthYear);

            let rightX = leftW + 10;
            let events = [];

            try {
                let registry = EDataServer.SourceRegistry.new_sync(null);
                let sources = registry.list_sources(EDataServer.SOURCE_EXTENSION_CALENDAR);
                let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                let endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                let startTimestamp = Math.floor(startOfDay.getTime() / 1000);
                let endTimestamp = Math.floor(endOfDay.getTime() / 1000);
                let sexp = `(occur-in-time-range? ${startTimestamp} ${endTimestamp})`;

                for (let source of sources) {
                    try {
                        let client = ECal.Client.connect_sync(source, ECal.ClientSourceType.EVENTS, 1, null);
                        let [success, comps] = client.get_object_list_as_comps_sync(sexp, null);
                        if (success && comps) {
                            for (let comp of comps) {
                                let icalComp = comp.get_icalcomponent();
                                let dtstart = icalComp.get_dtstart();
                                let timeStr = "Todo el día";
                                if (dtstart && dtstart.value && !dtstart.value.is_date) {
                                    let t = dtstart.value;
                                    timeStr = `${t.hour.toString().padStart(2, '0')}:${t.minute.toString().padStart(2, '0')}`;
                                }
                                events.push({ time: timeStr, title: icalComp.get_summary() });
                            }
                        }
                    } catch (e) { /* Ignorar errores de fuentes específicas */ }
                }
                events.sort((a, b) => a.time.localeCompare(b.time));
            } catch (e) {
                console.error(`[Widgets-Desktop] Error al cargar eventos: ${e.message}`);
            }

            if (events.length === 0) {
                events = [{ time: "--:--", title: "Sin eventos hoy" }];
            }

            // Limitamos a 3 eventos para que el diseño se mantenga limpio
            events = events.slice(0, 3);

            // Draw "PRÓXIMOS EVENTOS" header
            let layoutHeader = PangoCairo.create_layout(cr);
            layoutHeader.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(7.5 * scale)}`));
            layoutHeader.set_text("EVENTOS DE HOY", -1);
            let [hw, hh] = layoutHeader.get_pixel_size();

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 142/255, green: 142/255, blue: 147/255, alpha: 1 }));
            cr.moveTo(rightX + 10, 20);
            PangoCairo.update_layout(cr, layoutHeader);
            PangoCairo.show_layout(cr, layoutHeader);

            let eventStartY = 20 + hh + 10 * scale;
            let spacing = (height - eventStartY - 10) / events.length;

            events.forEach((ev, i) => {
                let yPos = eventStartY + i * spacing;

                Gdk.cairo_set_source_rgba(cr, accentColor);
                cr.setLineWidth(3);
                cr.setLineCap(Cairo.LineCap.ROUND);
                cr.moveTo(rightX + 10, yPos + 3 * scale);
                cr.lineTo(rightX + 10, yPos + 22 * scale);
                cr.stroke();

                let layoutTime = PangoCairo.create_layout(cr);
                layoutTime.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(7.5 * scale)}`));
                layoutTime.set_text(ev.time, -1);
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 198/255, green: 198/255, blue: 201/255, alpha: 1 }));
                cr.moveTo(rightX + 18, yPos);
                PangoCairo.update_layout(cr, layoutTime);
                PangoCairo.show_layout(cr, layoutTime);

                let layoutTitle = PangoCairo.create_layout(cr);
                layoutTitle.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(9 * scale)}`));
                layoutTitle.set_text(ev.title, -1);
                Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 1, green: 1, blue: 1, alpha: 1 }));
                cr.moveTo(rightX + 18, yPos + 10 * scale);
                PangoCairo.update_layout(cr, layoutTitle);
                PangoCairo.show_layout(cr, layoutTitle);
            });
        } else {
            let size = Math.min(width, height) - 10;
            let x = (width - size) / 2;
            let y = (height - size) / 2;

            let scale = size / 200;

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 255/255, green: 255/255, blue: 255/255, alpha: 1 }));
            let headerText = `${MONTHS[month]} ${year}`;
            let layoutHeader = PangoCairo.create_layout(cr);
            layoutHeader.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(11 * scale)}`));
            layoutHeader.set_text(headerText, -1);
            cr.moveTo(x + (20 * scale), y + (25 * scale));
            PangoCairo.update_layout(cr, layoutHeader);
            PangoCairo.show_layout(cr, layoutHeader);

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 174/255, green: 174/255, blue: 178/255, alpha: 1 }));
            let daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];
            let spacingX = (size - (30 * scale)) / 7;
            let gridStartY = y + (52 * scale);

            let dayLayout = PangoCairo.create_layout(cr);
            dayLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(9 * scale)}`));

            daysOfWeek.forEach((day, i) => {
                dayLayout.set_text(day, -1);
                let [tw, th] = dayLayout.get_pixel_size();
                cr.moveTo(x + (15 * scale) + (i * spacingX) + (spacingX/2 - tw/2), gridStartY);
                PangoCairo.update_layout(cr, dayLayout);
                PangoCairo.show_layout(cr, dayLayout);
            });

            let firstDay = new Date(year, month, 1);
            let startOffset = (firstDay.getDay() + 6) % 7;
            let lastDayOfMonth = new Date(year, month + 1, 0).getDate();

            let numLayout = PangoCairo.create_layout(cr);
            numLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(10 * scale)}`));

            for (let day = 1; day <= lastDayOfMonth; day++) {
                let column = (day - 1 + startOffset) % 7;
                let row = Math.floor((day - 1 + startOffset) / 7);
                let dx = x + (15 * scale) + (column * spacingX) + spacingX/2;
                let dy = gridStartY + (22 * scale) + (row * (20 * scale));
                
                numLayout.set_text(day.toString(), -1);
                let [nw, nh] = numLayout.get_pixel_size();

                if (day === dayOfMonth) {
                    Gdk.cairo_set_source_rgba(cr, accentColor);
                    cr.arc(dx, dy + nh/2 + 1, 9 * scale, 0, 2 * Math.PI);
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