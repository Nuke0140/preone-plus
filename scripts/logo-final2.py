#!/usr/bin/env python3
"""Final PreOne brand assets (v2) — surgical n-letter carve.
Keep = disc circle (r274) + orbit-ring band; carve out the 'n' zone (x>=1292, 440<=y<=725).
"""
from PIL import Image
import numpy as np
from scipy import ndimage
import os

SRC = '/home/z/my-project/upload/preone_logo.png'
PUB = '/home/z/my-project/public'
APP = '/home/z/my-project/src/app'

img = Image.open(SRC).convert('RGBA')
a = np.array(img)
H, W = a.shape[:2]

# mask to the main wordmark blob (drops star, green ball, pink ball)
alpha = a[..., 3]
lab, n = ndimage.label(alpha > 128)
main = lab == lab[350, 1038]
a2 = a.copy()
a2[~main] = 0

yy, xx = np.mgrid[0:H, 0:W]
cx, cy, r_disc = 1038.0, 550.0, 274.0
dist = np.hypot(xx - cx, yy - cy)

# rotated-ellipse ring band (generous: safe because everything else is masked already)
th = np.deg2rad(-18.0)
xd, yd = xx - cx, yy - cy
xr = xd * np.cos(th) + yd * np.sin(th)
yr = -xd * np.sin(th) + yd * np.cos(th)
t = np.sqrt((xr / 590.0) ** 2 + (yr / 215.0) ** 2)
band = (t > 0.80) & (t < 1.10)

keep = (dist <= r_disc) | band
# surgical carve: the 'n' letter hugging the planet's right edge
carve = (xx >= 1292) & (yy >= 440) & (yy <= 725)
keep &= ~carve

soft = ndimage.gaussian_filter(keep.astype(np.float32), sigma=1.2)
a2[..., 3] = (a2[..., 3] * np.clip(soft, 0, 1)).astype(np.uint8)

marked = Image.fromarray(a2)
side = 640
crop = marked.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2)))
mark512 = crop.resize((512, 512), Image.LANCZOS)
mark512.save(f'{PUB}/preone-mark.png', optimize=True)
mark512.resize((128, 128), Image.LANCZOS).save(f'{APP}/icon.png', optimize=True)
mark512.resize((180, 180), Image.LANCZOS).save(f'{APP}/apple-icon.png', optimize=True)
print('mark v2 done:', mark512.size, os.path.getsize(f'{PUB}/preone-mark.png') // 1024, 'KB')
