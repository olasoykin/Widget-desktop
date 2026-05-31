// Class to manage the representation and drawing of desktop widgets (Clock and Calendar).
'use strict';
const { Gtk, Gdk, GLib, Gio, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const SignalManager = imports.signalManager;
const Prefs = imports.preferences;
const Enums = imports.enums;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext.domain('ding');
const Calendar = imports.widgets.calendar;
const Clock = imports.widgets.clock;
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
        this.iconRectangle = new Gdk.Rectangle();
        this.labelRectangle = new Gdk.Rectangle();
        this.touchedByRubberband = false;

        this.canRename = false;
        this._grid = null;
        this._createWidget();

        // Initialize external drawing logic if applicable
        if (this.type === 'clock') {
            this._clockLogic = new Clock.ClockWidget();
        } else if (this.type === 'calendar') {
            this._calendarLogic = new Calendar.CalendarWidget();

        }
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
        this._clockLogic.draw(cr, cx, cy, size);
    }

    _drawCalendar(cr, cx, cy, size) {
        // Delegate drawing to the CalendarWidget object
        this._calendarLogic.draw(cr, cx, cy, size);
    }

    setCoordinates(x, y, width, height, margin, grid, relativeX) {
        this._x1 = x;
        this._y1 = y;
        this._x2 = x + width;
        this._y2 = y + height;
        this._relativeX = relativeX;
        this._grid = grid;
        this.container.set_size_request(width, height);

        this.iconRectangle.x = x;
        this.iconRectangle.y = y;
        this.iconRectangle.width = width;
        this.iconRectangle.height = height;
        this.labelRectangle.x = x;
        this.labelRectangle.y = y;
        this.labelRectangle.width = width;
        this.labelRectangle.height = height;
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
