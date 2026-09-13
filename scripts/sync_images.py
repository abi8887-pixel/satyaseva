#!/usr/bin/env python3
"""
sync_images.py — Automatic Community Image Synchronizer for Satyaseva Sisters
Scans site/images/communities/ and automatically generates site/data/community-images.json
and synchronizes site/data/communities.json without any coding needed by sisters.
"""

import os
import json
import re

# Supported image extensions
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'}

def get_paths():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    site_dir = os.path.join(repo_root, 'site')
    comm_images_dir = os.path.join(site_dir, 'images', 'communities')
    comm_json_path = os.path.join(site_dir, 'data', 'communities.json')
    output_json_path = os.path.join(site_dir, 'data', 'community-images.json')
    return repo_root, site_dir, comm_images_dir, comm_json_path, output_json_path

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def sync():
    _, site_dir, comm_images_dir, comm_json_path, output_json_path = get_paths()

    if not os.path.exists(comm_images_dir):
        print(f"Error: Community images directory does not exist at {comm_images_dir}")
        return False

    # Load existing communities.json if present
    communities = []
    if os.path.exists(comm_json_path):
        try:
            with open(comm_json_path, 'r', encoding='utf-8') as f:
                communities = json.load(f)
        except Exception as e:
            print(f"Warning: Could not read {comm_json_path}: {e}")

    comm_map = {c['id']: c for c in communities}
    manifest = {}
    total_photos_found = 0

    # Scan directories in comm_images_dir
    entries = sorted(os.listdir(comm_images_dir))
    for entry in entries:
        folder_path = os.path.join(comm_images_dir, entry)
        if not os.path.isdir(folder_path):
            continue

        cid = entry
        files = sorted(os.listdir(folder_path), key=natural_sort_key)
        
        # Filter for image files only
        image_files = [f for f in files if os.path.splitext(f.lower())[1] in IMAGE_EXTENSIONS]

        hero_file = None
        gallery_files = []

        # Check for explicit hero or cover filename
        for img in image_files:
            base = os.path.splitext(img.lower())[0]
            if base in ('hero', 'cover', 'banner', 'main', 'header'):
                hero_file = img
                break

        # Distribute images
        for img in image_files:
            if img == hero_file:
                continue
            gallery_files.append(img)

        # If no explicit hero is named, but we have images, use the first as hero if desired
        rel_hero_path = ""
        if hero_file:
            rel_hero_path = f"images/communities/{cid}/{hero_file}"
        elif gallery_files:
            # First photo can serve as hero preview
            rel_hero_path = f"images/communities/{cid}/{gallery_files[0]}"

        rel_gallery_paths = [f"images/communities/{cid}/{img}" for img in gallery_files]
        total_community_images = len(image_files)
        total_photos_found += total_community_images

        manifest[cid] = {
            "hero": rel_hero_path,
            "gallery": rel_gallery_paths,
            "allImages": [f"images/communities/{cid}/{img}" for img in image_files],
            "totalImages": total_community_images
        }

        # Update communities.json in-memory
        if cid in comm_map:
            comm_map[cid]['heroImage'] = rel_hero_path
            comm_map[cid]['gallery'] = rel_gallery_paths

    # Write site/data/community-images.json
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"✓ Updated {output_json_path} ({len(manifest)} communities indexed, {total_photos_found} images found)")

    # Write updated site/data/communities.json
    if communities:
        with open(comm_json_path, 'w', encoding='utf-8') as f:
            json.dump(communities, f, indent=2, ensure_ascii=False)
        print(f"✓ Synchronized {comm_json_path}")

    return True

if __name__ == '__main__':
    sync()
