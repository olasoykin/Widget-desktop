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

    draw(cr, cx, cy, size) {
        let x = cx - size / 2;
        let y = cy - size / 2;
        let r = 20;
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 28/255, green: 28/255, blue: 30/255, alpha: 1 }));
        this._roundedRectangle(cr, x, y, size, size, r);
        cr.fillPreserve();
        Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
        cr.setLineWidth(1);
        cr.stroke();

        try {
            const image_radius = r;

            let pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.path, size, size, true);

            const image_draw_x = x + (size - pixbuf.get_width()) / 2;
            const image_draw_y = y + (size - pixbuf.get_height()) / 2;

            this._roundedRectangle(cr, x, y, size, size, image_radius);
            cr.clip();
            Gdk.cairo_set_source_pixbuf(cr, pixbuf, image_draw_x, image_draw_y);
            cr.paint();
            cr.resetClip(); 

            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 63/255, green: 63/255, blue: 66/255, alpha: 1 }));
            this._roundedRectangle(cr, x, y, size, size, r);
            cr.setLineWidth(1);
            cr.stroke();
        } catch (e) {
            cr.setSourceRGB(0.5, 0.5, 0.5);
            cr.setLineWidth(2);
            cr.move_to(x + 10, y + 10);
            cr.line_to(x + size - 10, y + size - 10);
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