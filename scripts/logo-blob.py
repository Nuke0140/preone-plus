#!/usr/bin/env python3
"""Isolate planet-O + ring blob from PreOne logo via connected components, build final mark."""
from PIL import Image
import numpy as np
from scipy import ndimage

img = Image.open('/home/z/my-project/upload/preone_logo.png').convert('RGBA')
a = np.array(img)
mask = a[..., 3] > 128

lab, n = ndimage.label(mask)
print('blobs:', n)
# blob at disc center (1038, 350)
seed = lab[350, 1038]
sizes = ndimage.sum(mask, lab, range(1, n + 1))
print('seed blob id:', seed, 'size:', sizes[seed - 1] if seed else None)
top5 = np.argsort(sizes)[::-1][:6] + 1
print('top blobs:', [(int(b), int(sizes[b - 1])) for b in top5])

blob = lab == seed
ys, xs = np.where(blob)
print('planet blob bbox: x', xs.min(), '-', xs.max(), ' y', ys.min(), '-', ys.max())

# Check which blobs are the letters vs decorations
for b in top5:
    by, bx = np.where(lab == b)
    print(f'  blob {b}: bbox x {bx.min()}-{bx.max()} y {by.min()}-{by.max()} size {int(sizes[b-1])}')

# Build mark: keep ONLY planet blob (disc + ring as one connected piece)
out = a.copy()
out[~blob] = 0
mark = Image.fromarray(out)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
side = max(x1 - x0, y1 - y0) + 40  # padding
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(mark.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)), (0, 0))
sq.save('/home/z/my-project/scripts/mark-blob.png', optimize=True)
print('mark-blob:', sq.size)
