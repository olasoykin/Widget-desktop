'use strict';

const { Gdk, GLib, Gio, Pango, PangoCairo } = imports.gi;
const BaseWidget = imports.widgets.baseWidget;
const Cairo = imports.gi.cairo;

/**
 * Image slideshow widget.
 * Reads image files from a configured folder and displays them
 * as a rotating slideshow, cycling at a configurable interval.
 */
var ImageWidget = class extends BaseWidget.BaseWidget {
    constructor(folder) {
        super();
        this._folder = folder || GLib.get_home_dir();
        this._images = [];
        this._currentIndex = 0;
        this._pixbuf = null;
        this._loadImages();
    }

    _loadImages() {
        this._images = [];
        this._currentIndex = 0;
        this._pixbuf = null;
        try {
            let dir = Gio.File.new_for_path(this._folder);
            if (!dir.query_exists(null)) return;

            let enumerator = dir.enumerate_children('standard::name,standard::type', 0, null);
            let info;
            let extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'];
            let files = [];
            while ((info = enumerator.next_file(null))) {
                let name = info.get_name();
                let ext = name.substring(name.lastIndexOf('.')).toLowerCase();
                if (extensions.includes(ext) && info.get_file_type() === Gio.FileType.REGULAR) {
                    files.push(name);
                }
            }
            files.sort((a, b) => a.localeCompare(b));
            this._images = files;
        } catch (e) {
            this._images = [];
        }
    }

    nextImage() {
        if (this._images.length === 0) {
            this._pixbuf = null;
            return;
        }
        this._currentIndex = (this._currentIndex + 1) % this._images.length;
        this._loadCurrentImage();
    }

    _loadCurrentImage() {
        this._pixbuf = null;
        if (this._images.length === 0) return;
        try {
            let path = GLib.build_filenamev([this._folder, this._images[this._currentIndex]]);
            this._pixbuf = imports.gi.GdkPixbuf.Pixbuf.new_from_file(path);
        } catch (e) {
            this._pixbuf = null;
        }
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);
        
        let cx = dx + padding/2 + sw/2;
        let cy = dy + padding/2 + sh/2;

        if (!this._pixbuf) {
            this._loadCurrentImage();
        }

        if (this._pixbuf) {
            let pbW = this._pixbuf.get_width();
            let pbH = this._pixbuf.get_height();
            
            let scale = Math.max(sw / pbW, sh / pbH);
            let dw = pbW * scale;
            let dh = pbH * scale;
            
            let drawX = dx + padding/2 + (sw - dw) / 2;
            let drawY = dy + padding/2 + (sh - dh) / 2;

            let r = Math.min(sw, sh) * 0.20; 
            this._roundedRectangle(cr, dx + padding/2, dy + padding/2, sw, sh, r);
            cr.clip();
            
            let scaled = this._pixbuf.scale_simple(Math.round(dw), Math.round(dh), imports.gi.GdkPixbuf.InterpType.BILINEAR);
            Gdk.cairo_set_source_pixbuf(cr, scaled, drawX, drawY);
            cr.paint();
            cr.resetClip();

        } else {
            let layoutEmpty = PangoCairo.create_layout(cr);
            let fs = Math.max(9, Math.round(Math.min(width, height) / 15));
            layoutEmpty.set_font_description(Pango.FontDescription.from_string(`Sans ${fs}`));
            layoutEmpty.set_text('No images', -1);
            let [tw, th] = layoutEmpty.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, new Gdk.RGBA({ red: 142/255, green: 142/255, blue: 147/255, alpha: 1 }));
            cr.moveTo(cx - tw / 2, cy - th / 2);
            PangoCairo.show_layout(cr, layoutEmpty);
        }
    }
};