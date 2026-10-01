#!/usr/bin/env python3
"""PreOne brand asset pipeline.
Generates all application logo variants from an uploaded source logo:
  - upload/preone_logo.png           : Raw source image
  - public/preone-logo.png          : High-res wordmark (1000w, transparent RGBA)
  - public/preone-mark.png          : High-res emblem mark (512x512, transparent RGBA)
  - download/assets/preone-logo.png : Downloadable/guide wordmark asset
  - download/assets/preone-mark.png : Downloadable/guide emblem asset
  - src/app/icon.png                : Next.js app favicon (128x128)
  - src/app/apple-icon.png          : Apple touch icon (180x180)
"""

import os
import sys
import shutil
from PIL import Image, ImageFilter
import numpy as np

def process_logo(src_path: str, root_dir: str):
    print(f"Processing logo from {src_path}...")
    
    # 1. Update master upload copy
    upload_target = os.path.join(root_dir, 'upload', 'preone_logo.png')
    if os.path.abspath(src_path) != os.path.abspath(upload_target):
        shutil.copyfile(src_path, upload_target)
        print(f"  -> Updated {upload_target}")

    img = Image.open(src_path).convert('RGBA')
    a = np.array(img)
    H, W = a.shape[:2]
    alpha = a[..., 3]
    rgb = a[..., :3].astype(float)

    # 2. Wordmark (Trim + scale to 1000px width)
    ys, xs = np.where(alpha > 8)
    full = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w1000 = 1000
    h1000 = round(full.height * w1000 / full.width)
    full1000 = full.resize((w1000, h1000), Image.LANCZOS)

    full1000.save(os.path.join(root_dir, 'public', 'preone-logo.png'), optimize=True)
    full1000.save(os.path.join(root_dir, 'download', 'assets', 'preone-logo.png'), optimize=True)
    print(f"  -> Generated wordmark: {full1000.size}")

    # 3. Square planet mark emblem (Planet O + orbit ring, centered)
    yy, xx = np.mgrid[0:H, 0:W]
    is_pre = (xx < 146) | ((xx < 201) & (yy < 280))
    is_star_green = (yy < 178) & (xx < 252)
    is_ne = ((xx >= 340) & (yy >= 235)) | (xx >= 379)
    is_drop = is_pre | is_star_green | is_ne
    is_mark = (alpha > 10) & (~is_drop)

    mask_bin = Image.fromarray((is_mark * 255).astype(np.uint8))
    mask_feather = mask_bin.filter(ImageFilter.GaussianBlur(radius=0.8))
    soft = np.array(mask_feather).astype(float) / 255.0

    a_mark = a.copy()
    a_mark[..., 3] = (a_mark[..., 3] * soft).astype(np.uint8)

    m_ys, m_xs = np.where(a_mark[..., 3] > 15)
    mark_crop = Image.fromarray(a_mark).crop((m_xs.min(), m_ys.min(), m_xs.max() + 1, m_ys.max() + 1))
    mw, mh = mark_crop.size
    canvas_side = round(max(mw, mh) * 1.12)
    sq = Image.new('RGBA', (canvas_side, canvas_side), (0, 0, 0, 0))
    sq.paste(mark_crop, ((canvas_side - mw) // 2, (canvas_side - mh) // 2), mark_crop)
    mark512 = sq.resize((512, 512), Image.LANCZOS)

    mark512.save(os.path.join(root_dir, 'public', 'preone-mark.png'), optimize=True)
    mark512.save(os.path.join(root_dir, 'download', 'assets', 'preone-mark.png'), optimize=True)
    print(f"  -> Generated mark emblem: {mark512.size}")

    # 4. App icons
    icon128 = mark512.resize((128, 128), Image.LANCZOS)
    icon128.save(os.path.join(root_dir, 'src', 'app', 'icon.png'), optimize=True)

    apple180 = mark512.resize((180, 180), Image.LANCZOS)
    apple180.save(os.path.join(root_dir, 'src', 'app', 'apple-icon.png'), optimize=True)
    print(f"  -> Generated app icons (128x128, 180x180)")

if __name__ == '__main__':
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'upload', 'preone_logo.png')
    process_logo(src, root)
