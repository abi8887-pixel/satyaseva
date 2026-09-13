#!/usr/bin/env python3
"""
watch_images.py — Real-Time Background Image Watcher for Satyaseva Sisters
Watches site/images/communities/ for any new, changed, or deleted image files.
Whenever a sister drops a photo into a folder, this script automatically updates
the site's image manifest and community data in real-time. Zero coding required.
"""

import os
import sys
import time
from sync_images import sync, get_paths, IMAGE_EXTENSIONS

POLL_INTERVAL_SECONDS = 2.0

def get_dir_state(folder):
    """Returns a dict of {relpath: (mtime, size)} for all files in folder."""
    state = {}
    if not os.path.exists(folder):
        return state
    for root, _, files in os.walk(folder):
        for f in files:
            ext = os.path.splitext(f.lower())[1]
            if ext in IMAGE_EXTENSIONS or f == 'README.txt':
                full_path = os.path.join(root, f)
                try:
                    stat = os.stat(full_path)
                    rel = os.path.relpath(full_path, folder)
                    state[rel] = (stat.st_mtime, stat.st_size)
                except OSError:
                    pass
    return state

def watch():
    _, _, comm_images_dir, _, _ = get_paths()
    print("===================================================================")
    print("Satyaseva Sisters — Community Images Auto-Watcher")
    print("===================================================================")
    print(f"Watching folder: {comm_images_dir}")
    print("Drop or remove photos in any community folder; the site updates automatically.")
    print("Press Ctrl+C to stop watching.\n")

    # Initial sync
    sync()
    last_state = get_dir_state(comm_images_dir)

    try:
        while True:
            time.sleep(POLL_INTERVAL_SECONDS)
            current_state = get_dir_state(comm_images_dir)
            if current_state != last_state:
                # Detect what changed
                added = set(current_state.keys()) - set(last_state.keys())
                removed = set(last_state.keys()) - set(current_state.keys())
                modified = {k for k in (set(current_state.keys()) & set(last_state.keys())) if current_state[k] != last_state[k]}

                changes = []
                if added:
                    changes.append(f"+ added {len(added)} file(s): {', '.join(sorted(added)[:3])}")
                if removed:
                    changes.append(f"- removed {len(removed)} file(s): {', '.join(sorted(removed)[:3])}")
                if modified:
                    changes.append(f"~ modified {len(modified)} file(s)")

                print(f"[{time.strftime('%H:%M:%S')}] Detected changes: {'; '.join(changes)}")
                sync()
                last_state = current_state
    except KeyboardInterrupt:
        print("\nWatcher stopped.")

if __name__ == '__main__':
    watch()
