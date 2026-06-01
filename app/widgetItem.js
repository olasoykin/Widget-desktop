// Class to manage the representation and drawing of desktop widgets (Clock and Calendar).
'use strict';
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const PangoCairo = imports.gi.PangoCairo;
const Cairo = imports.gi.cairo;
const desktopIconItem = imports.desktopIconItem;
const SignalManager = imports.signalManager;
const Prefs = imports.preferences;
const Enums = imports.enums;
const ByteArray = imports.byteArray;
const Calendar = imports.widgets.calendar;
const Clock = imports.widgets.clock;

var WidgetItem = class extends desktopIconItem.desktopIconItem {
    constructor(desktopManager, type) {
        super(desktopManager, Enums.FileType.NONE);
        this.type = type;
        this.fileName = (type === 'clock') ? 'Clock widget' : 'Calendar widget';
        this.attributeContentType = `widget/${type}`;
        this.gridSize = 2;
        this.uri = `widget://${type}`;

        // Properties needed for desktop sorting logic
        this._modifiedTime = 0;
        this.fileSize = 0;
        this._isDirectory = false;
        this._isSpecial = true;
        
        // Mock de propiedades necesarias para la lógica nativa
        this.file = {
            get_uri: () => this.uri,
        };

        // Initialize external drawing logic before creating the widget
        if (this.type === 'clock') {
            this._clockLogic = new Clock.ClockWidget();
        } else if (this.type === 'calendar') {
            this._calendarLogic = new Calendar.CalendarWidget();
        }

        this._createWidget();

        // Forzar que el contenedor se expanda para llenar el espacio 2x2 del grid
        this.container.set_halign(Gtk.Align.FILL);
        this.container.set_valign(Gtk.Align.FILL);
    }

    _createWidget() {
        // Usamos la estructura nativa pero inyectamos nuestro DrawingArea
        this._createIconActor();

        // En lugar de destruir, ocultamos el icono y label originales
        this._icon.set_no_show_all(true);
        this._icon.hide();
        this._label.set_no_show_all(true);
        this._label.hide();
        this._shieldLabelEventBox.set_no_show_all(true);
        this._shieldLabelEventBox.hide();
        
        // Asegurar que el label tenga texto para evitar errores en funciones de ordenación (sort)
        this._setLabelName(this.fileName);

        this.container.set_halign(Gtk.Align.FILL);
        this.container.set_valign(Gtk.Align.FILL);

        this._shieldEventBox.set_halign(Gtk.Align.FILL);
        this._shieldEventBox.set_valign(Gtk.Align.FILL);
        this._shieldEventBox.set_hexpand(true);
        this._shieldEventBox.set_vexpand(true);

        this._eventBox.set_hexpand(true);
        this._eventBox.set_vexpand(true);
        this._eventBox.set_halign(Gtk.Align.FILL);
        this._eventBox.set_valign(Gtk.Align.FILL);

        // Aseguramos que el contenedor interno ocupe todo el espacio 2x2
        this._iconContainer.set_hexpand(true);
        this._iconContainer.set_vexpand(true);
        this._iconContainer.set_halign(Gtk.Align.FILL);
        this._iconContainer.set_valign(Gtk.Align.FILL);
        this._iconContainer.set_baseline_position(Gtk.BaselinePosition.CENTER);

        // Cambiar el empaquetado en el contenedor principal para que se expanda y llene el espacio del grid
        this.container.set_child_packing(this._shieldEventBox, true, true, 0, Gtk.PackType.START);

        this._drawingArea = new Gtk.DrawingArea({ visible: true });
        this._drawingArea.set_hexpand(true);
        this._drawingArea.set_vexpand(true);
        // Lo añadimos al contenedor de iconos nativo para mantener los eventos
        this._iconContainer.pack_start(this._drawingArea, true, true, 0);

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

        this.container.show_all();
    }

    _onDraw(widget, cr) {
        let width = widget.get_allocated_width();
        let height = widget.get_allocated_height();
        let cx = width / 2;
        let cy = height / 2;
        let size = Math.min(width, height) - 40;

        // DEBUG: Si ves esto en el log, es que el widget sí está intentando dibujarse
        // console.log(`[Widgets-Desktop] Dibujando ${this.type}: ${width}x${height} (size: ${size})`);

        if (width <= 20 || height <= 20 || size <= 0) {
            return false;
        }

        try {
            if (this.type === 'clock') {
                this._drawClock(cr, cx, cy, size);
            } else if (this.type === 'calendar') {
                this._drawCalendar(cr, cx, cy, size);
            }
        } catch (e) {
            if (!this._hasDrawingError) {
                console.error(`[Widgets-Desktop] Error drawing widget (${this.type}): ${e.message}\n${e.stack}`);
                this._hasDrawingError = true;
            }
        }

        return false;
    }

    _drawClock(cr, cx, cy, size) {
        if (this._clockLogic)
            this._clockLogic.draw(cr, cx, cy, size);
    }

    _drawCalendar(cr, cx, cy, size) {
        if (this._calendarLogic)
            this._calendarLogic.draw(cr, cx, cy, size);
    }

    setCoordinates(x, y, width, height, margin, grid, relativeX) {
        // Usar la lógica de la clase base para mantener consistencia en la ordenación
        super.setCoordinates(x, y, width, height, margin, grid, relativeX);
        
        // Forzar coordenadas manuales adicionales para asegurar compatibilidad
        this._x1 = x;
        this._y1 = y;
        this._x2 = x + width;
        this._y2 = y + height;
        
        // Aseguramos que el widget solicite el tamaño exacto del grid 2x2
        this.container.set_size_request(width, height);

        // Solo calcular rectángulos si el widget ya está en el grid para evitar errores de GTK
        if (this.container.get_parent()) {
            this._calculateIconRectangle();
            this._calculateLabelRectangle();
        }
    }

    get savedCoordinates() {
        try {
            let pos = Prefs.desktopSettings.get_string(`${this.type}-widget-position`);
            if (!pos || pos === '') return null;
            return pos.split(',').map(Number);
        } catch (e) {
            return null;
        }
    }
    set savedCoordinates(pos) {
        try {
            if (pos) {
                Prefs.desktopSettings.set_string(`${this.type}-widget-position`, `${pos[0]},${pos[1]}`);
            } else {
                Prefs.desktopSettings.set_string(`${this.type}-widget-position`, '');
            }
        } catch (e) {
            // Fallback silencioso si la clave no existe
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
        this._drawingArea = null;
        // Llamar a la limpieza de la clase base para desconectar señales y destruir el contenedor correctamente
        super._onDestroy();
    }

    get isAllSelectable() {
        return false;
    }
};
