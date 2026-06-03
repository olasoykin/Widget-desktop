'use strict';

/**
 * Base class for all desktop widgets.
 * Provides common utilities and defines the interface for drawing and lifecycle management.
 */
var BaseWidget = class {
    constructor() {}

    /** @interface */
    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        // To be implemented by subclasses
    }

    /** @interface */
    update() {
        // Optional: override to refresh data or internal state
    }

    /** @interface */
    destroy() {
        // Optional: override for cleanup
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