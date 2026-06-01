'use strict';
const { Gdk, Gio, GLib } = imports.gi;
const Cairo = imports.gi.cairo;
const GdkPixbuf = imports.gi.GdkPixbuf;

var ImageWidget = class {
    constructor(folderPath) {
        this.folderPath = folderPath;
        this.images = [];
        this.currentIndex = 0;
        this.path = '/usr/share/pixmaps/default.png';
        this._loadImages();
    }

    _loadImages() {
        if (!this.folderPath) return;
        try {
            console.log(`[ImageWidget] Attempting to load images from folder: ${this.folderPath}`);
            let directory = Gio.File.new_for_path(this.folderPath);
            let enumerator = directory.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            this.images = [];
            while ((info = enumerator.next_file(null))) {
                let name = info.get_name().toLowerCase();
                if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg')) {
                    this.images.push(GLib.build_filenamev([this.folderPath, info.get_name()]));
                }
            }
            if (this.images.length > 0) this.path = this.images[0];
            console.log(`[ImageWidget] Loaded ${this.images.length} images. First image: ${this.path}`);
        } catch (e) {
            console.error(`[Widgets-Desktop] Error loading images from folder: ${e.message}`);
        }
    }

    nextImage() {
        if (this.images.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.path = this.images[this.currentIndex];
    }

    draw(cr, width, height, accentColor) {
        let r = 20;
        let targetW = width - 10;
        let targetH = height - 10;

        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 28/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, 5, 5, targetW, targetH, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        try {
            const image_radius = r;
            let originalPixbuf = GdkPixbuf.Pixbuf.new_from_file(this.path);
            let origW = originalPixbuf.get_width();
            let origH = originalPixbuf.get_height();

            let scale = Math.max(targetW / origW, targetH / origH);
            let scaledW = Math.round(origW * scale);
            let scaledH = Math.round(origH * scale);

            let pixbuf = originalPixbuf.scale_simple(scaledW, scaledH, GdkPixbuf.InterpType.BILINEAR);

            const image_draw_x = 5 + (targetW - scaledW) / 2;
            const image_draw_y = 5 + (targetH - scaledH) / 2;

            this._roundedRectangle(cr, 5, 5, targetW, targetH, image_radius);
            cr.clip();
            Gdk.cairo_set_source_pixbuf(cr, pixbuf, image_draw_x, image_draw_y);
            cr.paint();
            cr.resetClip(); 

            // Redraw border after clipping and painting image
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
            this._roundedRectangle(cr, 5, 5, targetW, targetH, r);
            cr.setLineWidth(1);
            cr.stroke();
        } catch (e) {
            cr.setSourceRGB(0.5, 0.5, 0.5);
            cr.setLineWidth(2);
            cr.moveTo(15, 15);
            cr.lineTo(width - 15, height - 15);
            cr.stroke();
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