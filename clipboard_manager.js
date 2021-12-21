#!/usr/bin/env gjs

imports.gi.versions.Gtk = '4.0';
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const mainloop = imports.mainloop;

// Use different AppIDs to allow to test it from a command line while the main desktop is also running from the extension
const clipboardManagerApp = new Gtk.Application({application_id: 'com.rastersoft.clipboardManagerApp', flags: Gio.ApplicationFlags.FLAGS_NONE});

clipboardManagerApp.connect('startup', () => {
});

function read_clipboard(clipboard) {
    let formats = clipboard.get_formats().get_mime_types();
    for (let format of formats) {
        print(`Format: ${format}`);
    }
    let content = clipboard.get_content();
    clipboard.read_async(['x-special/gnome-copied-files', 'text/plain'], 0, null, (source, result) => {
        let datos = source.read_finish(result);
        print(`mime type: ${datos[1]}`);
        datos[0].read_bytes_async(100000, 1, null, (source, result) => {
            let content = source.read_bytes_finish(result);
            source.close(null);
            let ba = ByteArray.toString(ByteArray.fromGBytes(content));
            print(`Data: ${ba}`);
            print("Done");
        });
    })
}

clipboardManagerApp.connect('activate', () => {
    let window = new Gtk.Window();
    let button = new Gtk.Button({label:"push me"});
    window.set_child(button);
    window.show();
    clipboardManagerApp.add_window(window);

    let clipboard = window.get_clipboard();
    clipboard.connect('changed', () => {
        print("Clipboard has changed");
        read_clipboard(clipboard);
    });
    button.connect('clicked', () => {
        read_clipboard(clipboard);
    });
});

clipboardManagerApp.run(null);
// return value
0;
