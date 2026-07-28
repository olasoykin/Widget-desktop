/* Desktop Icons GNOME Shell extension
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DingPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.ding');

        // ── Desktop Icons page ──────────────────────────────────
        const iconPage = new Adw.PreferencesPage({
            title: 'Desktop Icons',
            icon_name: 'folder-symbolic',
        });
        window.add(iconPage);

        // Icon appearance group
        const appearGroup = new Adw.PreferencesGroup({title: 'Appearance'});
        iconPage.add(appearGroup);

        // Icon size selector
        const sizeRow = new Adw.ComboRow({title: 'Icon size'});
        const sizeModel = new Gtk.StringList();
        const sizeValues = ['tiny', 'small', 'standard', 'large'];
        const sizeLabels = ['Tiny', 'Small', 'Standard', 'Large'];
        for (const label of sizeLabels)
            sizeModel.append(label);
        sizeRow.set_model(sizeModel);
        const currentSize = settings.get_string('icon-size');
        sizeRow.set_selected(Math.max(0, sizeValues.indexOf(currentSize)));
        sizeRow.connect('notify::selected', () => {
            settings.set_string('icon-size', sizeValues[sizeRow.get_selected()]);
        });
        appearGroup.add(sizeRow);

        appearGroup.add(this._buildSwitchRow(settings, 'dark-text-in-labels', 'Dark text in icon labels',
            'Paint the label text in dark instead of white. Useful with light backgrounds.'));
        appearGroup.add(this._buildSwitchRow(settings, 'show-link-emblem', 'Link emblem on soft links',
            'Add an emblem to identify soft links.'));

        // Items shown group
        const showGroup = new Adw.PreferencesGroup({title: 'Items Shown'});
        iconPage.add(showGroup);
        showGroup.add(this._buildSwitchRow(settings, 'show-home', 'Personal folder'));
        showGroup.add(this._buildSwitchRow(settings, 'show-trash', 'Trash icon'));
        showGroup.add(this._buildSwitchRow(settings, 'show-volumes', 'External drives'));
        showGroup.add(this._buildSwitchRow(settings, 'show-network-volumes', 'Network drives'));

        // Layout group
        const layoutGroup = new Adw.PreferencesGroup({title: 'Layout'});
        iconPage.add(layoutGroup);

        const cornerRow = new Adw.ComboRow({title: 'New icons alignment'});
        const cornerModel = new Gtk.StringList();
        const cornerValues = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        const cornerLabels = ['Top-left corner', 'Top-right corner', 'Bottom-left corner', 'Bottom-right corner'];
        for (const label of cornerLabels)
            cornerModel.append(label);
        cornerRow.set_model(cornerModel);
        const currentCorner = settings.get_string('start-corner');
        cornerRow.set_selected(Math.max(0, cornerValues.indexOf(currentCorner)));
        cornerRow.connect('notify::selected', () => {
            settings.set_string('start-corner', cornerValues[cornerRow.get_selected()]);
        });
        layoutGroup.add(cornerRow);

        layoutGroup.add(this._buildSwitchRow(settings, 'add-volumes-opposite',
            'Add new drives to opposite side'));
        layoutGroup.add(this._buildSwitchRow(settings, 'show-drop-place',
            'Highlight drop place during Drag\'n\'Drop'));

        // Behaviour group
        const behavGroup = new Adw.PreferencesGroup({title: 'Behaviour'});
        iconPage.add(behavGroup);
        behavGroup.add(this._buildSwitchRow(settings, 'use-nemo', 'Use Nemo to open folders',
            'Use Nemo instead of Nautilus to open folders.'));

        // ── Widgets page ────────────────────────────────────────
        const widgetPage = new Adw.PreferencesPage({
            title: 'Widgets',
            icon_name: 'applications-utilities-symbolic',
        });
        window.add(widgetPage);

        const widgetGroup = new Adw.PreferencesGroup({
            title: 'Desktop Widgets',
            description: 'Toggle widgets shown on the desktop.',
        });
        widgetPage.add(widgetGroup);

        widgetGroup.add(this._buildSwitchRow(settings, 'show-clock-widget', 'Clock widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-calendar-widget', 'Calendar widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-image-widget', 'Image widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-cpu-widget', 'CPU widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-ram-widget', 'RAM widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-disk-widget', 'Disk widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-network-widget', 'Network widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-battery-widget', 'Battery widget'));
        widgetGroup.add(this._buildSwitchRow(settings, 'show-media-widget', 'Media widget'));

        // ── Clock widget settings ───────────────────────────────
        const clockGroup = new Adw.PreferencesGroup({
            title: 'Clock Widget Settings',
        });
        widgetPage.add(clockGroup);

        const clockStyleRow = new Adw.ComboRow({title: 'Clock Style'});
        const clockStyleModel = new Gtk.StringList();
        const clockStyleLabels = [
            'Digital Stacked',
            'Analog Numbers',
            'Analog Badge',
            'Analog Pill',
            'Digital Line'
        ];
        for (const label of clockStyleLabels)
            clockStyleModel.append(label);
        
        clockStyleRow.set_model(clockStyleModel);
        
        // Lee el valor del entero 'clock-style' guardado en GSettings
        const currentClockStyle = settings.get_int('clock-style');
        clockStyleRow.set_selected(Math.max(0, Math.min(currentClockStyle, clockStyleLabels.length - 1)));
        
        // Asigna el nuevo índice (0 a 4) directamente a 'clock-style' al cambiar la opción
        clockStyleRow.connect('notify::selected', () => {
            settings.set_int('clock-style', clockStyleRow.get_selected());
        });
        clockGroup.add(clockStyleRow);

        // Image widget settings
        const imgGroup = new Adw.PreferencesGroup({
            title: 'Image Widget Settings',
        });
        widgetPage.add(imgGroup);

        // Image folder path entry
        const folderRow = new Adw.EntryRow({title: 'Images folder path'});
        folderRow.set_text(settings.get_string('image-widget-folder'));
        folderRow.connect('changed', () => {
            settings.set_string('image-widget-folder', folderRow.get_text());
        });
        imgGroup.add(folderRow);

        // Image rotation interval
        const intervalRow = new Adw.SpinRow({
            title: 'Rotation interval (seconds)',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 3600,
                step_increment: 5,
                page_increment: 30,
                value: settings.get_int('image-widget-interval'),
            }),
        });
        settings.bind('image-widget-interval', intervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        imgGroup.add(intervalRow);

        window.set_default_size(450, 700);
    }

    _buildSwitchRow(settings, key, title, subtitle = '') {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}