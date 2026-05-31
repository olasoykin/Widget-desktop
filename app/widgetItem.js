// Clase para gestionar la representación y el dibujo de los widgets de escritorio (Reloj y Calendario).
'use strict';
const { Gtk, Gdk, GLib, Gio, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const SignalManager = imports.signalManager;
const Enums = imports.enums;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext.domain('ding');
const _ = Gettext.gettext;

var WidgetItem = class extends SignalManager.SignalManager {
    constructor(desktopManager, type) {
        super();
        this._desktopManager = desktopManager;
        this.type = type;
        this.displayName = (type === 'clock') ? _('Clock widget') : _('Calendar widget');
        this.fileName = this.displayName;
        this.attributeContentType = `widget/${type}`;
        this.gridSize = 2;
        this.uri = `widget://${type}`;
        this.file = {
            get_uri: () => this.uri,
        };
        this._label = {
            get_text: () => this.fileName,
        };
        this._isSelected = false;
        this._isKeyboardSelected = false;
        this.isAllSelectable = false;
        this.isSpecial = true;
        this.isDirectory = false;
        this.isDrive = false;
        this.isTrash = false;
        this.canRename = false;
        this._grid = null;
        this._createWidget();
    }

    _createWidget() {
        this.container = new Gtk.EventBox({ visible: true, can_focus: true });
        this.container.set_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK);
        
        this._drawingArea = new Gtk.DrawingArea({ visible: true });
        this._drawingArea.set_hexpand(true);
        this._drawingArea.set_vexpand(true);
        this.container.add(this._drawingArea);

        this.connectSignal(this._drawingArea, 'draw', (widget, cr) => this._onDraw(widget, cr));

        if (this.type === 'clock') {
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this._drawingArea.queue_draw();
                return true;
            });
        } else if (this.type === 'calendar') {
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
                this._drawingArea.queue_draw();
                return true;
            });
        }

        this.connectSignal(this.container, 'button-press-event', (actor, event) => {
            let button = event.get_button()[1];
            let [a, x, y] = event.get_coords();
            this._buttonPressInitialX = x;
            this._buttonPressInitialY = y;

            if (button == 1) {
                this._desktopManager.selected(this, Enums.Selection.ALONE);
            }
            return false;
        });

        this.container.drag_source_set(Gdk.ModifierType.BUTTON1_MASK, null, Gdk.DragAction.MOVE);
        let targets = new Gtk.TargetList(null);
        targets.add(Gdk.atom_intern('x-special/ding-icon-list', false), Gtk.TargetFlags.SAME_APP, Enums.DndTargetInfo.DING_ICON_LIST);
        this.container.drag_source_set_target_list(targets);

        this.connectSignal(this.container, 'drag-begin', (w, context) => {
            this._desktopManager.onDragBegin(this);
            let [x, y] = [this._buttonPressInitialX, this._buttonPressInitialY];
            context.set_hotspot(x, y);
        });

        this.connectSignal(this.container, 'drag-data-get', (w, context, data, info, time) => {
            let dragData = this._desktopManager.fillDragDataGet(info);
            if (dragData != null) {
                data.set(dragData[0], 8, ByteArray.fromString(dragData[1]));
            }
        });

        this.connectSignal(this.container, 'drag-end', () => {
            this._desktopManager.onDragEnd();
        });
        this.container.show_all();
    }

    _onDraw(widget, cr) {
        let width = widget.get_allocated_width();
        let height = widget.get_allocated_height();
        let cx = width / 2;
        let cy = height / 2;
        let size = Math.min(width, height) - 40;

        if (this.type === 'clock') {
            this._drawClock(cr, cx, cy, size);
        } else {
            this._drawCalendar(cr, cx, cy, size);
        }
        return false;
    }

    _drawClock(cr, cx, cy, size) {
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20;

        cr.set_source_rgb(245/255, 245/255, 247/255);
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fill_preserve();
        cr.set_source_rgb(210/255, 210/255, 215/255);
        cr.set_line_width(1);
        cr.stroke();

        let now = new Date();
        let h = now.getHours() % 12;
        let m = now.getMinutes();
        let s = now.getSeconds();

        let hAngle = (h * 30 + m * 0.5 - 90) * Math.PI / 180;
        let mAngle = (m * 6 - 90) * Math.PI / 180;
        let sAngle = (s * 6 - 90) * Math.PI / 180;

        cr.set_source_rgb(0, 0, 0);
        cr.set_line_width(6);
        cr.set_line_cap(Cairo.LineCap.ROUND);
        cr.move_to(cx, cy);
        cr.line_to(cx + Math.cos(hAngle) * (size * 0.25), cy + Math.sin(hAngle) * (size * 0.25));
        cr.stroke();

        cr.set_line_width(4);
        cr.move_to(cx, cy);
        cr.line_to(cx + Math.cos(mAngle) * (size * 0.38), cy + Math.sin(mAngle) * (size * 0.38));
        cr.stroke();

        cr.set_source_rgb(255/255, 69/255, 0);
        cr.set_line_width(2);
        cr.move_to(cx, cy);
        cr.line_to(cx + Math.cos(sAngle) * (size * 0.42), cy + Math.sin(sAngle) * (size * 0.42));
        cr.stroke();

        cr.set_source_rgb(0, 0, 0);
        cr.arc(cx, cy, 5, 0, 2 * Math.PI);
        cr.fill();
    }

    _drawCalendar(cr, cx, cy, size) {
        let now = new Date();
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20;

        cr.set_source_rgb(245/255, 245/255, 247/255);
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fill_preserve();
        cr.set_source_rgb(210/255, 210/255, 215/255);
        cr.set_line_width(1);
        cr.stroke();

        cr.set_source_rgb(29/255, 29/255, 31/255);
        let monthName = now.toLocaleDateString(undefined, { month: 'long' }).toUpperCase();
        let headerText = `${monthName} ${now.getFullYear()}`;
        let layoutHeader = PangoCairo.create_layout(cr);
        layoutHeader.set_text(headerText, -1);
        layoutHeader.set_font_description(Pango.FontDescription.from_string("Sans Bold 14"));
        cr.move_to(x + 20, y + 20);
        PangoCairo.show_layout(cr, layoutHeader);

        cr.set_source_rgb(134/255, 134/255, 139/255);
        let diasSemana = ["L", "M", "M", "J", "V", "S", "D"];
        let espaciadoX = (size - 40) / 7;
        let inicioGridY = y + 60;

        diasSemana.forEach((dia, i) => {
            let layoutDia = PangoCairo.create_layout(cr);
            layoutDia.set_text(dia, -1);
            layoutDia.set_font_description(Pango.FontDescription.from_string("Sans Bold 10"));
            let [tw, th] = layoutDia.get_pixel_size();
            cr.move_to(x + 20 + (i * espaciadoX) + (espaciadoX/2 - tw/2), inicioGridY);
            PangoCairo.show_layout(cr, layoutDia);
        });

        let primerDia = new Date(now.getFullYear(), now.getMonth(), 1);
        let despliegueInicio = (primerDia.getDay() + 6) % 7;
        let ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        for (let dia = 1; dia <= ultimoDiaMes; dia++) {
            let columna = (dia - 1 + despliegueInicio) % 7;
            let fila = Math.floor((dia - 1 + despliegueInicio) / 7);

            let dx = x + 20 + (columna * espaciadoX) + espaciadoX/2;
            let dy = inicioGridY + 30 + (fila * 25);

            let layoutNum = PangoCairo.create_layout(cr);
            layoutNum.set_text(dia.toString(), -1);
            layoutNum.set_font_description(Pango.FontDescription.from_string("Sans 11"));
            let [nw, nh] = layoutNum.get_pixel_size();

            if (dia === now.getDate()) {
                cr.set_source_rgb(255/255, 59/255, 48/255);
                cr.arc(dx, dy + nh/2 - 2, 12, 0, 2 * Math.PI);
                cr.fill();
                cr.set_source_rgb(1, 1, 1);
            } else {
                cr.set_source_rgb(29/255, 29/255, 31/255);
            }

            cr.move_to(dx - nw/2, dy);
            PangoCairo.show_layout(cr, layoutNum);
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

    setCoordinates(x, y, width, height, margin, grid, relativeX) {
        this._x1 = x;
        this._y1 = y;
        this._x2 = x + width;
        this._y2 = y + height;
        this._relativeX = relativeX;
        this._grid = grid;
        this.container.set_size_request(width, height);
    }

    getCoordinates() {
        return [this._x1, this._y1, this._x2, this._y2, this._grid];
    }

    setSelected() {
        this._isSelected = true;
        this.container.get_style_context().add_class('desktop-icons-selected');
    }

    unsetSelected() {
        this._isSelected = false;
        this.container.get_style_context().remove_class('desktop-icons-selected');
    }

    toggleSelected() {
        if (this._isSelected) this.unsetSelected();
        else this.setSelected();
    }

    get isSelected() { return this._isSelected; }
    get isKeyboardSelected() { return this._isKeyboardSelected; }
    set isKeyboardSelected(v) { this._isKeyboardSelected = v; }

    get savedCoordinates() {
        let pos = Prefs.desktopSettings.get_string(`${this.type}-widget-position`);
        if (!pos || pos === '') return null;
        return pos.split(',').map(Number);
    }
    set savedCoordinates(pos) {
        if (pos) {
            Prefs.desktopSettings.set_string(`${this.type}-widget-position`, `${pos[0]},${pos[1]}`);
        } else {
            Prefs.desktopSettings.set_string(`${this.type}-widget-position`, '');
        }
    }

    updateIcon() {
        if (this._drawingArea) {
            this._drawingArea.queue_draw();
        }
    }

    doOpen() {
        return false;
    }

    _onDestroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this._drawingArea = null;
    }

    removeFromGrid(callOnDestroy = true) {
        if (this._grid) {
            this._grid.removeItem(this);
            this._grid = null;
        }
        if (callOnDestroy) {
            this._onDestroy();
        }
    }
};
