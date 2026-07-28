'use strict';

const { Gdk, GLib, Gio, Pango, PangoCairo } = imports.gi;
const Cairo = imports.gi.cairo;
const BaseWidget = imports.widgets.baseWidget;

/**
 * Media playback widget via MPRIS2 D-Bus.
 * Completely redesigned Material You Music Player supporting 2x2, 4x2, and 4x4 grid modes.
 * Uses soft pastel text colors derived from accentColor.
 */
var MediaWidget = class extends BaseWidget.BaseWidget {
    constructor() {
        super();
        this._title = '';
        this._artist = '';
        this._album = '';
        this._status = 'Stopped';
        this._artUrl = '';
        this._pixbuf = null;
        this._playerName = '';
        this._playerBus = '';
        this._controlRects = null;
        this.update();
    }

    update() {
        try {
            let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
            let result = bus.call_sync(
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                'ListNames',
                null, null, Gio.DBusCallFlags.NONE, -1, null
            );
            let names = result.get_child_value(0).get_strv();
            let mprisPlayers = names.filter(n => n.startsWith('org.mpris.MediaPlayer2.'));

            if (mprisPlayers.length === 0) {
                this._title = '';
                this._artist = '';
                this._album = '';
                this._status = 'Stopped';
                this._playerName = '';
                this._playerBus = '';
                return;
            }

            let player = mprisPlayers[0];
            this._playerBus = player;
            this._playerName = player.replace('org.mpris.MediaPlayer2.', '');

            let propsResult = bus.call_sync(
                player,
                '/org/mpris/MediaPlayer2',
                'org.freedesktop.DBus.Properties',
                'GetAll',
                new GLib.Variant('(s)', ['org.mpris.MediaPlayer2.Player']),
                null, Gio.DBusCallFlags.NONE, -1, null
            );

            let props = propsResult.get_child_value(0);
            let metadata = props.lookup_value('Metadata', null);
            let status = props.lookup_value('PlaybackStatus', null);

            this._status = status ? status.get_string()[0] : 'Stopped';

            if (metadata) {
                let titleVal = metadata.lookup_value('xesam:title', null);
                let artistVal = metadata.lookup_value('xesam:artist', null);
                let albumVal = metadata.lookup_value('xesam:album', null);
                let artVal = metadata.lookup_value('mpris:artUrl', null);

                this._title = titleVal ? titleVal.get_string()[0] : '';
                this._album = albumVal ? albumVal.get_string()[0] : '';
                this._artist = '';
                if (artistVal) {
                    try {
                        let artists = artistVal.get_child_value(0);
                        this._artist = artists ? artists.get_strv()[0] : '';
                    } catch (e) {
                        try { this._artist = artistVal.get_string()[0]; } catch (e2) {}
                    }
                }
                let newArtUrl = artVal ? artVal.get_string()[0] : '';
                if (newArtUrl !== this._artUrl) {
                    this._artUrl = newArtUrl;
                    this._pixbuf = null;
                    if (this._artUrl && this._artUrl.startsWith('file://')) {
                        try {
                            let path = this._artUrl.replace('file://', '');
                            this._pixbuf = imports.gi.GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 450, 450, true);
                        } catch (e) {}
                    }
                }
            }
        } catch (e) {
            this._title = '';
            this._artist = '';
            this._album = '';
            this._status = 'Stopped';
        }
    }

    _sendMprisCommand(method) {
        if (!this._playerBus) return;
        try {
            let bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
            bus.call_sync(
                this._playerBus,
                '/org/mpris/MediaPlayer2',
                'org.mpris.MediaPlayer2.Player',
                method,
                null, null, Gio.DBusCallFlags.NONE, -1, null
            );
        } catch (e) {}
    }

    hitTest(localX, localY) {
        if (!this._controlRects) return null;
        for (let [name, rect] of Object.entries(this._controlRects)) {
            if (localX >= rect.x && localX <= rect.x + rect.w &&
                localY >= rect.y && localY <= rect.y + rect.h) {
                return name;
            }
        }
        return null;
    }

    handleAction(action) {
        if (action === 'play-pause') this._sendMprisCommand('PlayPause');
        else if (action === 'next') this._sendMprisCommand('Next');
        else if (action === 'prev') this._sendMprisCommand('Previous');
    }

    _drawArt(cr, artX, artY, artSize, radius, accentColor) {
        if (this._pixbuf) {
            this._roundedRectangle(cr, artX, artY, artSize, artSize, radius);
            cr.clip();
            let pbW = this._pixbuf.get_width();
            let pbH = this._pixbuf.get_height();
            let pbScale = Math.max(artSize / pbW, artSize / pbH);
            let dw = pbW * pbScale, dh = pbH * pbScale;
            let imgX = artX + (artSize - dw) / 2;
            let imgY = artY + (artSize - dh) / 2;
            let scaled = this._pixbuf.scale_simple(Math.round(dw), Math.round(dh), imports.gi.GdkPixbuf.InterpType.BILINEAR);
            Gdk.cairo_set_source_pixbuf(cr, scaled, imgX, imgY);
            cr.paint();
            cr.resetClip();

            let artBorder = accentColor.copy();
            artBorder.alpha = 0.25;
            Gdk.cairo_set_source_rgba(cr, artBorder);
            this._roundedRectangle(cr, artX, artY, artSize, artSize, radius);
            cr.setLineWidth(1);
            cr.stroke();
        } else {
            let placeholderBg = new Gdk.RGBA({
                red: (accentColor.red * 0.22) + (35 / 255 * 0.78),
                green: (accentColor.green * 0.22) + (35 / 255 * 0.78),
                blue: (accentColor.blue * 0.22) + (40 / 255 * 0.78),
                alpha: 1.0
            });
            Gdk.cairo_set_source_rgba(cr, placeholderBg);
            this._roundedRectangle(cr, artX, artY, artSize, artSize, radius);
            cr.fill();

            let nc = artSize * 0.38;
            let noteCx = artX + artSize / 2;
            let noteCy = artY + artSize / 2;
            let noteColor = this._getPastelDimColor(accentColor, 0.6);
            Gdk.cairo_set_source_rgba(cr, noteColor);
            cr.setLineWidth(3);
            cr.setLineCap(Cairo.LineCap.ROUND);

            cr.moveTo(noteCx - nc * 0.1, noteCy + nc * 0.25);
            cr.lineTo(noteCx - nc * 0.1, noteCy - nc * 0.4);
            cr.lineTo(noteCx + nc * 0.35, noteCy - nc * 0.55);
            cr.lineTo(noteCx + nc * 0.35, noteCy - nc * 0.1);
            cr.stroke();

            cr.arc(noteCx - nc * 0.22, noteCy + nc * 0.3, nc * 0.15, 0, 2 * Math.PI);
            cr.fill();
            cr.arc(noteCx + nc * 0.22, noteCy - nc * 0.05, nc * 0.15, 0, 2 * Math.PI);
            cr.fill();
        }
    }

    _drawControlButton(cr, cx, cy, radius, icon, isActive, accentColor) {
        let bgColor = accentColor.copy();
        bgColor.alpha = 1.0;
        Gdk.cairo_set_source_rgba(cr, bgColor);
        cr.arc(cx, cy, radius, 0, 2 * Math.PI);
        cr.fill();

        let iconColor = this._getPastelColor(accentColor, 0.75);
        Gdk.cairo_set_source_rgba(cr, iconColor);
        cr.setLineWidth(2);
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);

        let sz = radius * 0.55;
        if (icon === 'play') {
            cr.moveTo(cx - sz * 0.35, cy - sz * 0.6);
            cr.lineTo(cx + sz * 0.65, cy);
            cr.lineTo(cx - sz * 0.35, cy + sz * 0.6);
            cr.closePath();
            cr.fill();
        } else if (icon === 'pause') {
            cr.setLineWidth(sz * 0.4);
            cr.moveTo(cx - sz * 0.35, cy - sz * 0.6);
            cr.lineTo(cx - sz * 0.35, cy + sz * 0.6);
            cr.stroke();
            cr.moveTo(cx + sz * 0.35, cy - sz * 0.6);
            cr.lineTo(cx + sz * 0.35, cy + sz * 0.6);
            cr.stroke();
        } else if (icon === 'next') {
            cr.moveTo(cx - sz * 0.45, cy - sz * 0.6);
            cr.lineTo(cx + sz * 0.25, cy);
            cr.lineTo(cx - sz * 0.45, cy + sz * 0.6);
            cr.closePath();
            cr.fill();
            cr.setLineWidth(sz * 0.35);
            cr.moveTo(cx + sz * 0.5, cy - sz * 0.6);
            cr.lineTo(cx + sz * 0.5, cy + sz * 0.6);
            cr.stroke();
        } else if (icon === 'prev') {
            cr.moveTo(cx + sz * 0.45, cy - sz * 0.6);
            cr.lineTo(cx - sz * 0.25, cy);
            cr.lineTo(cx + sz * 0.45, cy + sz * 0.6);
            cr.closePath();
            cr.fill();
            cr.setLineWidth(sz * 0.35);
            cr.moveTo(cx - sz * 0.5, cy - sz * 0.6);
            cr.lineTo(cx - sz * 0.5, cy + sz * 0.6);
            cr.stroke();
        }
    }

    draw(cr, width, height, accentColor, gridWidth, gridHeight) {
        let { dx, dy, size, s, padding, sw, sh } = this._drawMaterialBackground(cr, width, height, accentColor, gridWidth, gridHeight);
        let scale = s / 120;

        let pastelText = this._getPastelColor(accentColor);
        let pastelDim = this._getPastelDimColor(accentColor);

        if (!this._title && !this._artist && this._status === 'Stopped') {
            let cx = dx + padding / 2 + sw / 2;
            let cy = dy + padding / 2 + sh / 2;
            let iconSize = Math.min(sw, sh) * 0.26;

            let iconColor = accentColor.copy();
            iconColor.alpha = 0.35;
            Gdk.cairo_set_source_rgba(cr, iconColor);
            cr.setLineWidth(3 * scale);
            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.moveTo(cx - iconSize * 0.1, cy + iconSize * 0.2);
            cr.lineTo(cx - iconSize * 0.1, cy - iconSize * 0.5);
            cr.lineTo(cx + iconSize * 0.5, cy - iconSize * 0.65);
            cr.lineTo(cx + iconSize * 0.5, cy - iconSize * 0.15);
            cr.stroke();
            cr.arc(cx - iconSize * 0.25, cy + iconSize * 0.3, iconSize * 0.2, 0, 2 * Math.PI);
            cr.fill();
            cr.arc(cx + iconSize * 0.35, cy - iconSize * 0.1, iconSize * 0.2, 0, 2 * Math.PI);
            cr.fill();

            let labelLayout = PangoCairo.create_layout(cr);
            labelLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8 * scale)}`));
            labelLayout.set_text('Sin Reproducción', -1);
            let [lw, lh] = labelLayout.get_pixel_size();
            Gdk.cairo_set_source_rgba(cr, pastelDim);
            cr.moveTo(cx - lw / 2, cy + iconSize * 0.6);
            PangoCairo.show_layout(cr, labelLayout);

            this._controlRects = null;
            return;
        }

        let isPlaying = this._status === 'Playing';

        if (gridWidth === 4 && gridHeight === 4) {
            this._draw4x4(cr, dx, dy, sw, sh, padding, scale, accentColor, isPlaying, pastelText, pastelDim);
        } else if (gridWidth === 4 && gridHeight === 2) {
            this._draw4x2(cr, dx, dy, sw, sh, padding, scale, accentColor, isPlaying, pastelText, pastelDim);
        } else {
            this._draw2x2(cr, dx, dy, sw, sh, padding, scale, accentColor, isPlaying, pastelText, pastelDim);
        }
    }

  _draw2x2(cr, dx, dy, sw, sh, padding, scale, accentColor, isPlaying, pastelText, pastelDim) {
        let pad = 14 * scale;
        
        let artSize = Math.min(sw - pad * 2, sh * 0.55);
        let artX = dx + padding / 2 + (sw - artSize) / 2;
        let artY = dy + padding / 2 + pad;

        this._drawArt(cr, artX, artY, artSize, 12 * scale, accentColor);

        let btnR = 15 * scale;
        let btnCX = artX + artSize - btnR + (4 * scale);
        let btnCY = artY + artSize - btnR + (4 * scale);
        
        this._drawControlButton(cr, btnCX, btnCY, btnR, isPlaying ? 'pause' : 'play', true, accentColor);

        let textY = artY + artSize + 12 * scale;
        let titleLayout = PangoCairo.create_layout(cr);
        titleLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(8.5 * scale)}`));
        titleLayout.set_text(this._title || '—', -1);
        titleLayout.set_width((sw - pad * 2) * Pango.SCALE);
        titleLayout.set_ellipsize(Pango.EllipsizeMode.END);
        titleLayout.set_alignment(Pango.Alignment.CENTER);

        Gdk.cairo_set_source_rgba(cr, pastelText);
        cr.moveTo(dx + padding / 2 + pad, textY);
        PangoCairo.show_layout(cr, titleLayout);

        this._controlRects = {
            'play-pause': { x: btnCX - btnR, y: btnCY - btnR, w: btnR * 2, h: btnR * 2 }
        };
    }

    _draw4x2(cr, dx, dy, sw, sh, padding, scale, accentColor, isPlaying, pastelText, pastelDim) {
        let pad = sh * 0.1;
        
        let artSize = sh - pad * 2;
        let artX = dx + padding / 2 + pad;
        let artY = dy + padding / 2 + pad;

        this._drawArt(cr, artX, artY, artSize, sh * 0.08, accentColor);

        let rightX = artX + artSize + pad * 1.5;
        let rightW = sw - (rightX - dx - padding / 2) - pad;
        let rightCY = dy + padding / 2 + sh / 2;

        let titleLayout = PangoCairo.create_layout(cr);
        titleLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(sh * 0.085)}`));
        titleLayout.set_text(this._title || '—', -1);
        titleLayout.set_width(rightW * Pango.SCALE);
        titleLayout.set_ellipsize(Pango.EllipsizeMode.END);
        titleLayout.set_alignment(Pango.Alignment.LEFT);
        let [tw, th] = titleLayout.get_pixel_size();

        Gdk.cairo_set_source_rgba(cr, pastelText);
        cr.moveTo(rightX, rightCY - th - sh * 0.02);
        PangoCairo.show_layout(cr, titleLayout);

        let artistLayout = PangoCairo.create_layout(cr);
        artistLayout.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(sh * 0.065)}`));
        artistLayout.set_width(rightW * Pango.SCALE);
        artistLayout.set_ellipsize(Pango.EllipsizeMode.END);
        artistLayout.set_text(this._artist || '', -1);
        
        Gdk.cairo_set_source_rgba(cr, pastelDim);
        cr.moveTo(rightX, rightCY + sh * 0.02);
        PangoCairo.show_layout(cr, artistLayout);

        let btnR = sh * 0.12;
        let ctrlY = dy + padding / 2 + sh - pad - btnR;
        let playCX = rightX + rightW / 2;
        let btnSpacing = btnR * 2.8;

        this._drawControlButton(cr, playCX - btnSpacing, ctrlY, btnR * 0.8, 'prev', false, accentColor);
        this._drawControlButton(cr, playCX, ctrlY, btnR * 1.2, isPlaying ? 'pause' : 'play', true, accentColor);
        this._drawControlButton(cr, playCX + btnSpacing, ctrlY, btnR * 0.8, 'next', false, accentColor);

        this._controlRects = {
            'prev': { x: playCX - btnSpacing - btnR, y: ctrlY - btnR, w: btnR * 2, h: btnR * 2 },
            'play-pause': { x: playCX - btnR * 1.2, y: ctrlY - btnR * 1.2, w: btnR * 2.4, h: btnR * 2.4 },
            'next': { x: playCX + btnSpacing - btnR, y: ctrlY - btnR, w: btnR * 2, h: btnR * 2 },
        };
    }

    _draw4x4(cr, dx, dy, sw, sh, padding, scale, accentColor, isPlaying, pastelText, pastelDim) {
        let base = Math.min(sw, sh);
        let pad = base * 0.08;

        let artSize = base * 0.48; 
        let artX = dx + padding / 2 + (sw - artSize) / 2;
        let artY = dy + padding / 2 + pad;
        
        this._drawArt(cr, artX, artY, artSize, base * 0.05, accentColor); 

        let textY = artY + artSize + base * 0.04;
        
        let titleLayout = PangoCairo.create_layout(cr);
        titleLayout.set_font_description(Pango.FontDescription.from_string(`Sans Bold ${Math.floor(base * 0.055)}`));
        titleLayout.set_text(this._title || '—', -1);
        titleLayout.set_width((sw - pad * 2) * Pango.SCALE);
        titleLayout.set_ellipsize(Pango.EllipsizeMode.END);
        titleLayout.set_alignment(Pango.Alignment.CENTER);

        Gdk.cairo_set_source_rgba(cr, pastelText);
        cr.moveTo(dx + padding / 2 + pad, textY);
        PangoCairo.show_layout(cr, titleLayout);

        let artistLayout = PangoCairo.create_layout(cr);
        artistLayout.set_font_description(Pango.FontDescription.from_string(`Sans ${Math.floor(base * 0.04)}`));
        artistLayout.set_width((sw - pad * 2) * Pango.SCALE);
        artistLayout.set_ellipsize(Pango.EllipsizeMode.END);
        artistLayout.set_alignment(Pango.Alignment.CENTER);
        artistLayout.set_text(this._artist || '', -1);
        
        Gdk.cairo_set_source_rgba(cr, pastelDim);
        cr.moveTo(dx + padding / 2 + pad, textY + th + base * 0.015);
        PangoCairo.show_layout(cr, artistLayout);

        let btnR = base * 0.08;
        let ctrlY = dy + padding / 2 + sh - pad - btnR;
        let centerCX = dx + padding / 2 + sw / 2;
        let btnSpacing = btnR * 3;

        this._drawControlButton(cr, centerCX - btnSpacing, ctrlY, btnR * 0.8, 'prev', false, accentColor);
        this._drawControlButton(cr, centerCX, ctrlY, btnR * 1.2, isPlaying ? 'pause' : 'play', true, accentColor);
        this._drawControlButton(cr, centerCX + btnSpacing, ctrlY, btnR * 0.8, 'next', false, accentColor);

        this._controlRects = {
            'prev': { x: centerCX - btnSpacing - btnR, y: ctrlY - btnR, w: btnR * 2, h: btnR * 2 },
            'play-pause': { x: centerCX - btnR * 1.2, y: ctrlY - btnR * 1.2, w: btnR * 2.4, h: btnR * 2.4 },
            'next': { x: centerCX + btnSpacing - btnR, y: ctrlY - btnR, w: btnR * 2, h: btnR * 2 },
        };
    }
};