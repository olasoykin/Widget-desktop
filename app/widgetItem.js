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
const Image = imports.widgets.image;
const Cpu = imports.widgets.cpu;

var _lastPixelSizes = {};

var WidgetItem = class extends desktopIconItem.desktopIconItem {
    constructor(desktopManager, type) {
        super(desktopManager, Enums.FileType.NONE);
        this.type = type;
        if (type === 'clock') {
            this.fileName = 'Clock widget';
        } else if (type === 'calendar') {
            this.fileName = 'Calendar widget';
        } else if (type === 'image') {
            this.fileName = 'Image widget';
        } else {
            this.fileName = 'CPU widget';
        }
        this.attributeContentType = `widget/${type}`;
        this.uri = `widget://${type}`;

        this._modifiedTime = 0;
        this.fileSize = 0;
        this._isDirectory = false;
        this._isSpecial = true;
        this._gridWidth = null;
        this._gridHeight = null;
        
        this.file = {
            get_uri: () => this.uri,
        };

        const widgetClasses = {
            'clock': Clock.ClockWidget,
            'calendar': Calendar.CalendarWidget,
            'cpu': Cpu.CpuWidget,
            'image': () => {
                let folder = Prefs.desktopSettings.get_string('image-widget-folder');
                return new Image.ImageWidget(folder);
            }
        };

        const factory = widgetClasses[this.type];
        this._logic = (typeof factory === 'function' && factory.prototype)
            ? new factory()
            : (typeof factory === 'function' ? factory() : null);

        this._createWidget();

        this.container.set_halign(Gtk.Align.FILL);
        this.container.set_valign(Gtk.Align.FILL);
    }

    get gridWidth() {
        if (this._gridWidth !== null) {
            return this._gridWidth;
        }
        try {
            let s = Prefs.desktopSettings.get_string(`${this.type}-widget-size`);
            return s ? parseInt(s.split('x')[0]) : 2;
        } catch (e) {
            return 2;
        }
    }

    set gridWidth(val) {
        this._gridWidth = val;
    }

    get gridHeight() {
        if (this._gridHeight !== null) {
            return this._gridHeight;
        }
        try {
            let s = Prefs.desktopSettings.get_string(`${this.type}-widget-size`);
            return s ? parseInt(s.split('x')[1]) : 2;
        } catch (e) {
            return 2;
        }
    }

    set gridHeight(val) {
        this._gridHeight = val;
    }

    setSize(w, h) {
        this._hasDrawingError = false;
        this._gridWidth = w;
        this._gridHeight = h;
        Prefs.desktopSettings.set_string(`${this.type}-widget-size`, `${w}x${h}`);
        if (this._desktopManager) {
            this._desktopManager._updateDesktop();
        }
    }

    saveSize() {
        if (this._gridWidth !== null && this._gridHeight !== null) {
            this.setSize(this._gridWidth, this._gridHeight);
        }
    }

    _createWidget() {
        this._createIconActor();

        this._icon.set_no_show_all(true);
        this._icon.hide();
        this._label.set_no_show_all(true);
        this._label.hide();
        this._shieldLabelEventBox.set_no_show_all(true);
        this._shieldLabelEventBox.hide();
        
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

        this._iconContainer.set_hexpand(true);
        this._iconContainer.set_vexpand(true);
        this._iconContainer.set_halign(Gtk.Align.FILL);
        this._iconContainer.set_valign(Gtk.Align.FILL);
        this._iconContainer.set_baseline_position(Gtk.BaselinePosition.CENTER);

        this.container.set_child_packing(this._shieldEventBox, true, true, 0, Gtk.PackType.START);

        this._drawingArea = new Gtk.DrawingArea({ visible: true });
        this._drawingArea.set_hexpand(true);
        this._drawingArea.set_vexpand(true);
        
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
        } else if (this.type === 'cpu') {
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                if (this._logic) this._logic.update();
                this._drawingArea.queue_draw();
                return true;
            });
        } else if (this.type === 'image') {
            let interval = Prefs.desktopSettings.get_int('image-widget-interval');
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
                if (this._logic) {
                    this._logic.nextImage();
                    this._drawingArea.queue_draw();
                }
                return true;
            });
        }

        this.container.show_all();
    }

    _onDraw(widget, cr) {
        let width = widget.get_allocated_width();
        let height = widget.get_allocated_height();

        if (width <= 20 || height <= 20) {
            return false;
        }

        let accentColor = this._desktopManager.selectColor;
        try {
            if (this._logic)
                this._logic.draw(cr, width, height, accentColor, this.gridWidth, this.gridHeight);
        } catch (e) {
            if (!this._hasDrawingError) {
                console.error(`[Widgets-Desktop] Error drawing widget (${this.type}): ${e.message}\n${e.stack}`);
                this._hasDrawingError = true;
            }
        }

        return false;
    }

    setCoordinates(x, y, width, height, margin, grid, relativeX) {
        super.setCoordinates(x, y, width, height, margin, grid, relativeX);
        
        this._x1 = x;
        this._y1 = y;
        this._x2 = x + width;
        this._y2 = y + height;

        let lastSize = _lastPixelSizes[this.type];
        if (lastSize && (lastSize.w !== width || lastSize.h !== height)) {
            this._animateGrowth(lastSize.w, lastSize.h, width, height);
        } else {
            this.container.set_size_request(width, height);
        }

        _lastPixelSizes[this.type] = { w: width, h: height };

        if (this.container.get_parent()) {
            this._calculateIconRectangle();
            this._calculateLabelRectangle();
        }
    }

    _animateGrowth(startW, startH, endW, endH) {
        if (this._growthId) {
            GLib.source_remove(this._growthId);
        }

        let startTime = GLib.get_monotonic_time();
        const duration = 400 * 1000; 

        this._growthId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            let elapsed = GLib.get_monotonic_time() - startTime;
            let progress = Math.min(elapsed / duration, 1);
            
        
            let ease = 1 - Math.pow(1 - progress, 4);

            let w = startW + (endW - startW) * ease;
            let h = startH + (endH - startH) * ease;

            this.container.set_size_request(Math.round(w), Math.round(h));

            if (this._drawingArea) {
                this._drawingArea.queue_draw();
            }

            if (progress >= 1) {
                this._growthId = null;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
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
        }
    }

    updateIcon() {
        if (this._logic && typeof this._logic.update === 'function')
            this._logic.update();
            
        if (this._drawingArea) {
            this._drawingArea.queue_draw();
        }
    }

    doOpen() {
        return false;
    }

    _onDestroy() {
        if (this._growthId) {
            GLib.source_remove(this._growthId);
            this._growthId = null;
        }
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._logic && typeof this._logic.destroy === 'function') {
            this._logic.destroy();
        }
        this._drawingArea = null;
        super._onDestroy();
    }

    get isAllSelectable() {
        return false;
    }
};
