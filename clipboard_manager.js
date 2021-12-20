#!/usr/bin/env gjs

/* Clipboard manager
 *
 * Copyright (C) 2021 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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

clipboardManagerApp.connect('activate', () => {
    let window = new Gtk.Window();
    let button = new Gtk.Button({label:"push me"});
    window.set_child(button);
    window.show();
    clipboardManagerApp.add_window(window);
    let display = Gdk.Display.get_default();
    let clipboard = display.get_clipboard();
    clipboard.connect('changed', () => {
        print("Clipboard ha cambiado");
        clipboard.read_async(['text/plain'], 0, null, (source, result) => {
            let datos = source.read_finish(result);
            print(datos[1]);
            print(datos[0]);
            datos[0].read_bytes_async(100000, 1, null, (source, result) => {
                let contenido = source.read_bytes_finish(result);
                let ba = ByteArray.fromGBytes(contenido);
                print(ByteArray.toString(ba));
            });
        })
    });
    button.connect('clicked', () => {
        let data = clipboard.get_formats();
        let mimetypes = data.get_mime_types();
        for(let m of mimetypes) {
            print(m);
        }
        let content = clipboard.get_content();
        content.connect('content-changed', () => {
            print("Contenido ha cambiado");
        })
        content.vfunc_get_value = function(value) {
            print(`datos: ${value}`);
        }
    });
});

clipboardManagerApp.run(null);
// return value
0;
