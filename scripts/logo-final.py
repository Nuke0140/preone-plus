#!/usr/bin/env python3
"""Final PreOne brand assets from the uploaded logo.
- public/preone-logo.png  : trimmed full wordmark (optimized)
- public/preone-mark.png  : clean square mark = planet disc + orbit ring (star/balls/letters masked out)
- src/app/icon.png        : 128x128 favicon (Next app-router convention)
- src/app/apple-icon.png  : 180x180 apple touch icon
"""
from PIL import Image, ImageFilter
import numpy as np
import os

SRC = '/home/z/my-project/upload/preone_logo.png'
PUB = '/home/z/my-project/public'
APP = '/home/z/my-project/src/app'
os.makedirs(PUB, exist_ok=True)

img = Image.open(SRC).convert('RGBA')
a = np.array(img)
H, W = a.shape[:2]
alpha = a[..., 3]

# ---- 1) Full wordmark: trim + resize to 1000w ----
ys, xs = np.where(alpha > 8)
full = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
w1000 = 1000
h1000 = round(full.height * w1000 / full.width)
full1000 = full.resize((w1000, h1000), Image.LANCZOS)
full1000.save(f'{PUB}/preone-logo.png', optimize=True)
print('preone-logo.png:', full1000.size)

# ---- 2) Square mark: keep disc circle + orbit ring band ----
from scipy import ndimage
mask = alpha > 128
lab, n = ndimage.label(mask)
# zero out decoration blobs (star / green ball / pink ball) = blobs NOT containing disc seed
seed_id = lab[350, 1038]
keep_blob = lab == seed_id
a2 = a.copy()
a2[~keep_blob] = 0

cx, cy = 1038.0, 550.0          # disc center (measured)
r_disc = 292.0                   # keep radius around disc
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx - cx, yy - cy)

# ring band: rotated ellipse path around disc center
theta = np.deg2rad(-18.0)
xd = xx - cx
yd = yy - cy
xr = xd * np.cos(theta) + yd * np.sin(theta)
yr = -xd * np.sin(theta) + yd * np.cos(theta)
rx, ry = 590.0, 215.0
t = np.sqrt((xr / rx) ** 2 + (yr / ry) ** 2)
ring = (t > 0.925) & (t < 1.085)

keep = (dist <= r_disc) | ring
soft = keep.astype(np.float32)
soft = ndimage.gaussian_filter(soft, sigma=1.2)   # feather the mask edge
a2[..., 3] = (a2[..., 3] * np.clip(soft, 0, 1)).astype(np.uint8)

marked = Image.fromarray(a2)
side = 640
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(marked.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))), (0, 0))
mark512 = sq.resize((512, 512), Image.LANCZOS)
mark512.save(f'{PUB}/preone-mark.png', optimize=True)
print('preone-mark.png:', mark512.size)

# ---- 3) Favicons ----
mark512.resize((128, 128), Image.LANCZOS).save(f'{APP}/icon.png', optimize=True)
mark512.resize((180, 180), Image.LANCZOS).save(f'{APP}/apple-icon.png', optimize=True)
print('icon.png + apple-icon.png written')

# sizes
for f in [f'{PUB}/preone-logo.png', f'{PUB}/preone-mark.png', f'{APP}/icon.png', f'{APP}/apple-icon.png']:
    print(f, os.path.getsize(f) // 1024, 'KB')
