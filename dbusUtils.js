/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2019-2022 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Signals = imports.signals;
const DBusInterfaces = imports.dbusInterfaces;

var NautilusFileOperations2 = null;
var FreeDesktopFileManager = null;
var GnomeNautilusPreview = null;
var SwitcherooControl = null;
var GnomeArchiveManager = null;
var GtkVfsMetadata = null;

var discreteGpuAvailable = false;
var dbusManagerObject;

const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

class ProxyManager {
   /*
    * This class manages a DBus object through a DBusProxy. Any access to the proxy when the
    * object isn't available results in a notification specifying that an specific program
    * is needed to run that option.
    *
    * The proxy itself is accessed through the 'proxy' property (read-only). Any access to
    * it will check the availability and show the notification if it isn't available. To get
    * access to it without triggering this, it is possible to use the 'proxyNoCheck' property.
    *
    * Whether the object is or not available can be checked with the 'isAvailable' property.
    * Also, every time the availability changes, the signal 'changed-status' is emitted.
    */
    constructor(dbusManager, serviceName, objectName, interfaceName, inSystemBus, programNeeded) {
        this._dbusManager = dbusManager;
        this._serviceName = serviceName;
        this._objectName = objectName;
        this._interfaceName = interfaceName;
        this._inSystemBus = inSystemBus;
        if (typeof(programNeeded) == 'string') {
            // if 'programNeeded' is a string, create a generic message for the notification.
            this._programNeeded = [
                _('"${programName}" is needed for Desktop Icons').replace('${programName}', programNeeded),
                _('For this functionality to work in Desktop Icons, you must install "${programName}" in your system.').replace('${programName}', programNeeded)
            ];
        } else {
            // instead, if it's not, it is presumed to be an array with two sentences, one for the notification title and another for the main text.
            this._programNeeded = programNeeded;
        }
        this._timeout = 0;
        this._available = this._dbusManager.checkIsAvailable(this._serviceName, this._inSystemBus);

        this._interfaceXML = dbusManager.getInterface(serviceName, objectName, interfaceName, inSystemBus, false);
        this._proxy = new Gio.DBusProxy.makeProxyWrapper(this._interfaceXML)(
            inSystemBus ? Gio.DBus.system : Gio.DBus.session,
            serviceName,
            objectName,
            null
        );

        dbusManager.connect(inSystemBus ? 'changed-availability-system' : 'changed-availability-local', () => {
            let newAvailability = this._dbusManager.checkIsAvailable(this._serviceName, this._inSystemBus);
            if (newAvailability != this._available) {
                this._available = newAvailability;
                this.emit('changed-status', newAvailability);
            }
        });
    }

    get isAvailable() {
        return this._available;
    }

    get proxyNoCheck() {
        return this._proxy;
    }

    get proxy() {
        if (!this._available) {
            if (this._programNeeded && (this._timeout == 0)) {
                print(this._programNeeded[0]);
                print(this._programNeeded[1]);
                this._dbusManager.doNotify(this._programNeeded[0], this._programNeeded[1]);
                this._timeout = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    1000,
                    ()=> {
                        this._timeout = 0;
                        return false;
                    }
                );
            }
        }
        return this._proxy;
    }
}
Signals.addSignalMethods(ProxyManager.prototype);


class DBusManager {
   /*
    * This class manages all the DBus operations. A ProxyManager() class can subscribe to this to be notified
    * whenever a change in the bus has occurred (like a server has been added or removed). It also can ask
    * for a DBus interface, either getting it from the dbusInterfaces.js file or using DBus Introspection (which
    * allows to get the currently available interface and, that way, know if an object implements an specific
    * method, property or signal).
    *
    * ProxyManager() classes subscribe to the 'changed-availability-system' or 'changed-availability-local' signals,
    * which are emitted every time a change in the bus or in the configuration files happen. Then, it can use
    * checkIsAvailable() to determine if the desired service is available in the system or not.
    */
    constructor() {
        this._availableInSystemBus = [];
        this._availableInLocalBus = [];

        let interfaceXML = this.getInterface(
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            'org.freedesktop.DBus',
            true, // system bus
            true); // use DBus Introspection
        this._dbusSystemProxy = new Gio.DBusProxy.makeProxyWrapper(interfaceXML)(
            Gio.DBus.system,
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            null
        );

        // Don't presume that both system and local have the same interface (just in case)
        interfaceXML = this.getInterface(
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            'org.freedesktop.DBus',
            false, // local bus
            true); // use DBus Introspection
        this._dbusLocalProxy = new Gio.DBusProxy.makeProxyWrapper(interfaceXML)(
            Gio.DBus.session,
            'org.freedesktop.DBus',
            '/org/freedesktop/DBus',
            null
        );
        this._updateAllAvailabilities();
        this._dbusLocalProxy.connectSignal('NameOwnerChanged', () => {
            this._updateAllAvailabilities();
            this.emit('changed-availability-local');
        });
        this._dbusSystemProxy.connectSignal('NameOwnerChanged', () => {
            this._updateAllAvailabilities();
            this.emit('changed-availability-system');
        });

        interfaceXML = this.getInterface(
            'org.freedesktop.Notifications',
            '/org/freedesktop/Notifications',
            'org.freedesktop.Notifications',
            false, // local bus
            false); // get interface from local code
        this._notifyProxy = new Gio.DBusProxy.makeProxyWrapper(interfaceXML)(
            Gio.DBus.session,
            'org.freedesktop.Notifications',
            '/org/freedesktop/Notifications',
            null
        );
    }

    checkIsAvailable(serviceName, inSystemBus) {
        if (inSystemBus) {
            return this._availableInSystemBus.includes(serviceName);
        } else {
            return this._availableInLocalBus.includes(serviceName);
        }
    }

    _updateAllAvailabilities() {
        this._availableInLocalBus = this._updateAvailability(this._dbusLocalProxy);
        this._availableInSystemBus = this._updateAvailability(this._dbusSystemProxy);
    }

    _updateAvailability(proxy) {
        // We read both the well-known names actually running and those available as activatables,
        // and generate a single list with both. Thus a service will be "enabled" if it is running
        // or if it is activatable.

        let availableNames = [];
        let names = proxy.ListNamesSync();
        for(let n of names[0]) {
            if (n.startsWith(":")) {
                continue
            }
            if (!(n in availableNames)) {
                availableNames.push(n);
            }
        }
        let names2 = proxy.ListActivatableNamesSync();
        for(let n of names2[0]) {
            if (n.startsWith(":")) {
                continue
            }
            if (!(n in availableNames)) {
                availableNames.push(n);
            }
        }
        return availableNames;
    }

    _getNextTag() {
        this._xmlIndex++;
        let pos = this._xmlData.indexOf('<', this._xmlIndex);
        if (pos == -1) {
            return null;
        }
        let pos2 = this._xmlData.indexOf('>', pos);
        if (pos2 == -1) {
            return null;
        }
        this._xmlIndex = pos;
        return this._xmlData.substring(pos+1, pos2).trim();
    }

    /*
     * Extracts the XML definition for an interface from the raw data returned by DBus Introspection.
     * This is needed because DBus Introspection returns a single XML file with all the interfaces
     * supported by an object, while DBusProxyWrapper requires an XML with only the desired interface.
     */
    _parseXML(data, interfaceName) {
        this._xmlIndex = -1;
        this._xmlData = data;
        let tag;
        while(true) {
            tag = this._getNextTag();
            if (tag === null) {
                return null;
            }
            if (!tag.startsWith('interface ')) {
                continue;
            }
            if (-1 != tag.indexOf(interfaceName)) {
                break;
            }
        }
        let start = this._xmlIndex;
        while(true) {
            tag = this._getNextTag();
            if (tag === null) {
                return null;
            }
            if (!tag.startsWith('/interface')) {
                continue;
            }
            break;
        }
        return '<node>\n  ' + data.substring(start, 1 + data.indexOf('>', this._xmlIndex)) + '\n</node>';
    }

    getInterface(serviceName, objectName, interfaceName, inSystemBus, forceIntrospection) {
        if ((interfaceName in DBusInterfaces.DBusInterfaces) && (!forceIntrospection)) {
            return DBusInterfaces.DBusInterfaces[interfaceName];
        } else {
            let data = this.getIntrospectionData(serviceName, objectName, inSystemBus);
            return this._parseXML(data, interfaceName);
        }
    }

    getIntrospectionData(serviceName, objectName, inSystemBus) {
        let wraper = new Gio.DBusProxy.makeProxyWrapper(DBusInterfaces.DBusInterfaces['org.freedesktop.DBus.Introspectable'])(
            inSystemBus ? Gio.DBus.system : Gio.DBus.session,
            serviceName,
            objectName,
            null
        );
        let data = wraper.IntrospectSync()[0];
        if (data.indexOf("interface") == -1) {
            return null; // if it doesn't exist, return null
        }
        return data;
    }

    doNotify(header, text) {
        /*
         * The notification interface in GLib.Application requires a .desktop file, which
         * we can't have, so we must use directly the Notification DBus interface
         */
        this._notifyProxy.NotifyRemote('', 0, '', header, text, [], {}, -1, () => {});
    }
}
Signals.addSignalMethods(DBusManager.prototype);

function init() {

    dbusManagerObject = new DBusManager();

    let data = dbusManagerObject.getIntrospectionData(
        'org.gnome.Nautilus',
        '/org/gnome/Nautilus/FileOperations2',
        false);
    if (data) {
        // NautilusFileOperations2
        NautilusFileOperations2 = new ProxyManager(
            dbusManagerObject,
            'org.gnome.Nautilus',
            '/org/gnome/Nautilus/FileOperations2',
            'org.gnome.Nautilus.FileOperations2',
            false,
            'Nautilus'
        );
    } else {
        print("Emulating NautilusFileOperations2 with the old NautilusFileOperations interface");
        // Emulate NautilusFileOperations2 with the old interface
        NautilusFileOperations2 = new ProxyManager(
            dbusManagerObject,
            'org.gnome.Nautilus',
            '/org/gnome/Nautilus',
            'org.gnome.Nautilus.FileOperations',
            false,
            'Nautilus'
        );
        NautilusFileOperations2.proxyNoCheck.TrashURIsRemote = (selection, data, cb) => { NautilusFileOperations2.proxyNoCheck.TrashFilesRemote(selection, cb); };
        NautilusFileOperations2.proxyNoCheck.DeleteURIsRemote = (selection, data, cb) => { NautilusFileOperations2.proxyNoCheck.TrashFilesRemote(selection, cb); };
        NautilusFileOperations2.proxyNoCheck.RenameURIRemote = (originalName, newName, data, cb) => { NautilusFileOperations2.proxyNoCheck.RenameFileRemote(originalName, newName, cb); };
        NautilusFileOperations2.proxyNoCheck.oldEmptyTrash = NautilusFileOperations2.proxyNoCheck.EmptyTrashRemote;
        NautilusFileOperations2.proxyNoCheck.EmptyTrashRemote = (confirmation, data, cb) => { NautilusFileOperations2.proxyNoCheck.oldEmptyTrash(cb); };
        NautilusFileOperations2.proxyNoCheck.oldCopyURIs = NautilusFileOperations2.proxyNoCheck.CopyURIsRemote;
        NautilusFileOperations2.proxyNoCheck.CopyURIsRemote = (source, destination, data, cb) => { NautilusFileOperations2.proxyNoCheck.oldCopyURIs(source, destination, cb); };
        NautilusFileOperations2.proxyNoCheck.oldMoveURIs = NautilusFileOperations2.proxyNoCheck.MoveURIsRemote;
        NautilusFileOperations2.proxyNoCheck.MoveURIsRemote = (source, destination, data, cb) => { NautilusFileOperations2.proxyNoCheck.oldMoveURIs(source, destination, cb); };
        NautilusFileOperations2.proxyNoCheck.oldCreateFolder = NautilusFileOperations2.proxyNoCheck.CreateFolderRemote;
        NautilusFileOperations2.proxyNoCheck.CreateFolderRemote = (parent, folderName, data, cb) => {
            NautilusFileOperations2.proxyNoCheck.oldCreateFolder(GLib.build_filenamev([parent, folderName]), cb);
        }
        NautilusFileOperations2.proxyNoCheck.oldUndo = NautilusFileOperations2.proxyNoCheck.UndoRemote;
        NautilusFileOperations2.proxyNoCheck.UndoRemote = (data, cb) => { NautilusFileOperations2.proxyNoCheck.oldUndo(cb); };
        NautilusFileOperations2.proxyNoCheck.oldRedo = NautilusFileOperations2.proxyNoCheck.RedoRemote;
        NautilusFileOperations2.proxyNoCheck.RedoRemote = (data, cb) => { NautilusFileOperations2.proxyNoCheck.oldRedo(cb); };
    }

    NautilusFileOperations2.proxyNoCheck.platformData = () => {
        let parentWindow = Gtk.get_current_event().get_window();

        let parentHandle = '';
        if (parentWindow) {
            try {
                imports.gi.versions.GdkX11 = '3.0';
                const { GdkX11 } = imports.gi;
                const topLevel = parentWindow.get_effective_toplevel();

                if (topLevel.constructor.$gtype === GdkX11.X11Window.$gtype) {
                    const xid = GdkX11.X11Window.prototype.get_xid.call(topLevel);
                    parentHandle = `x11:${xid}`;
                } /* else if (topLevel instanceof GdkWayland.Toplevel) {
                    FIXME: Need Gtk4 to use GdkWayland
                    const handle = GdkWayland.Toplevel.prototype.export_handle.call(topLevel);
                    parentHandle = `wayland:${handle}`;
                } */
                } catch (e) {
                logError(e, 'Impossible to determine the parent window');
            }
        }

        return {
            'parent-handle': new GLib.Variant('s', parentHandle),
            'timestamp': new GLib.Variant('u', Gtk.get_current_event_time()),
            'window-position': new GLib.Variant('s', 'center'),
        };
    }

    FreeDesktopFileManager = new ProxyManager(
        dbusManagerObject,
        'org.freedesktop.FileManager1',
        '/org/freedesktop/FileManager1',
        'org.freedesktop.FileManager1',
        false,
        'Nautilus'
    );

    GnomeNautilusPreview = new ProxyManager(
        dbusManagerObject,
        'org.gnome.NautilusPreviewer',
        '/org/gnome/NautilusPreviewer',
        'org.gnome.NautilusPreviewer',
        false,
        'Nautilus-Sushi'
    );

    GnomeArchiveManager = new ProxyManager(
        dbusManagerObject,
        'org.gnome.ArchiveManager1',
        '/org/gnome/ArchiveManager1',
        'org.gnome.ArchiveManager1',
        false,
        'File-roller'
    );

    GtkVfsMetadata = new ProxyManager(
        dbusManagerObject,
        'org.gtk.vfs.Metadata',
        '/org/gtk/vfs/metadata',
        'org.gtk.vfs.Metadata',
        false,
        'Gvfs daemon'
    );

    SwitcherooControl = new ProxyManager(
        dbusManagerObject,
        'net.hadess.SwitcherooControl',
        '/net/hadess/SwitcherooControl',
        'net.hadess.SwitcherooControl',
        true,
        'Switcheroo control'
    );
    discreteGpuAvailable = SwitcherooControl.isAvailable;
    SwitcherooControl.connect('changed-status', (obj, newStatus) => {
        discreteGpuAvailable = newStatus;
    });
}
