#!/usr/bin/python3

import os
import subprocess

prefix = os.environ['MESON_INSTALL_DESTDIR_PREFIX']
schemadir = os.path.join(prefix, 'share', 'glib-2.0', 'schemas')

# Install the apparmor file for Ubuntu and family
# This is required to be able to create thumbnails
if prefix.startswith('/usr'):
    source_path = os.environ['MESON_SOURCE_ROOT']
    if 'DESTDIR' in os.environ:
        destination_path = os.environ['DESTDIR']
    else:
        destination_path = '/'
    apparmor = os.path.join(source_path, 'apparmor', 'desktop-icons-ng.in')
    with open(apparmor, 'r') as apparmor_file:
        data = apparmor_file.read()
    data = data.replace("@PREFIX@", prefix)
    destination_apparmor_path = os.path.join(destination_path, 'etc', 'apparmor.d')
    os.makedirs(destination_apparmor_path, exist_ok=True)
    destination_apparmor = os.path.join(destination_apparmor_path, 'desktop-icons-ng')
    with open(destination_apparmor, 'w') as apparmor_file:
        apparmor_file.write(data)

# Packaging tools define DESTDIR and this isn't needed for them
if 'DESTDIR' not in os.environ:
    print('Compiling GSettings schemas...')
    subprocess.call(['glib-compile-schemas', schemadir])
    if prefix.startswith('/usr'):
        print('Reloading apparmor rules...')
        subprocess.call(['systemctl', 'reload', 'apparmor'])