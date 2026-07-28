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
const Ram = imports.widgets.ram;
const Disk = imports.widgets.disk;
const Network = imports.widgets.network;
const Battery = imports.widgets.battery;
const Media = imports.widgets.media;
const Weather = imports.widgets.weather;

var _lastPixelSizes = {};

var WidgetItem = class extends desktopIconItem.desktopIconItem {
    constructor(desktopManager, type) {
        super(desktopManager, Enums.FileType.NONE);
        this.type = type;
        const fileNames = {
            'clock': 'Clock widget',
            'calendar': 'Calendar widget',
            'image': 'Image widget',
            'cpu': 'CPU widget',
            'ram': 'RAM widget',
            'disk': 'Disk widget',
            'network': 'Network widget',
            'battery': 'Battery widget',
            'media': 'Media widget',
            'weather': 'Weather widget',
        };
        this.fileName = fileNames[type] || `${type} widget`;
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
            'ram': Ram.RamWidget,
            'disk': Disk.DiskWidget,
            'network': Network.NetworkWidget,
            'battery': Battery.BatteryWidget,
            'media': Media.MediaWidget,
            'weather': Weather.WeatherWidget,
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

        this.connectSignal(this.container, 'size-allocate', () => this._calculateIconRectangle());
        this.connectSignal(this._drawingArea, 'draw', (widget, cr) => this._onDraw(widget, cr));
        this.connectSignal(this._eventBox, 'button-press-event', (widget, event) => this._onButtonPress(widget, event));

        if (this._logic && typeof this._logic.setRedrawCallback === 'function') {
            this._logic.setRedrawCallback(() => {
                if (this._drawingArea)
                    this._drawingArea.queue_draw();
            });
        }

        const updateIntervals = {
            'clock': 1,
            'calendar': 60,
            'cpu': 2,
            'ram': 2,
            'disk': 5,
            'network': 2,
            'battery': 10,
            'media': 3,
            'weather': 60,
        };

        if (this.type === 'image') {
            let interval = Prefs.desktopSettings.get_int('image-widget-interval');
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
                if (this._logic) {
                    this._logic.nextImage();
                    this._drawingArea.queue_draw();
                }
                return true;
            });
        } else if (updateIntervals[this.type]) {
            this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, updateIntervals[this.type], () => {
                if (this._logic && typeof this._logic.update === 'function') this._logic.update();
                this._drawingArea.queue_draw();
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

    _onButtonPress(widget, event) {
        if (!this._logic || typeof this._logic.hitTest !== 'function') return false;
        try {
            let [ok, x, y] = event.get_coords();
            if (!ok) return false;
            let action = this._logic.hitTest(x, y);
            if (action && typeof this._logic.handleAction === 'function') {
                this._logic.handleAction(action);
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                    if (this._logic && typeof this._logic.update === 'function')
                        this._logic.update();
                    if (this._drawingArea)
                        this._drawingArea.queue_draw();
                    return GLib.SOURCE_REMOVE;
                });
                return true; // Stop event processing (handled click on control)
            }
        } catch (e) {}
        return false; // Return false to allow widget dragging & DING selection!
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

    _calculateIconRectangle() {
        if (!this.container || !this._grid || !this.container.get_parent()) {
            return;
        }
        let allocW = this.container.get_allocated_width();
        let allocH = this.container.get_allocated_height();
        let gridElemW = (this._grid && this._grid._elementWidth) ? this._grid._elementWidth : 100;
        let gridElemH = (this._grid && this._grid._elementHeight) ? this._grid._elementHeight : 100;
        let w = Math.max(allocW, (this.gridWidth || 1) * gridElemW);
        let h = Math.max(allocH, (this.gridHeight || 1) * gridElemH);

        let [x, y] = this._grid.coordinatesLocalToGlobal(0, 0, this.container);
        this.iconRectangle.x = x;
        this.iconRectangle.y = y;
        this.iconRectangle.width = w;
        this.iconRectangle.height = h;
    }

    _calculateLabelRectangle() {
        this.labelRectangle.x = 0;
        this.labelRectangle.y = 0;
        this.labelRectangle.width = 0;
        this.labelRectangle.height = 0;
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
