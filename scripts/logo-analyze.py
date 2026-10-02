#!/usr/bin/env python3
"""Analyze preone_logo.png structure: alpha profiles + color runs to locate planet O."""
from PIL import Image
import numpy as np

img = Image.open('/home/z/my-project/upload/preone_logo.png').convert('RGBA')
a = np.array(img)
alpha = a[..., 3]

# 1) full bbox
ys, xs = np.where(alpha > 8)
print('bbox: x', xs.min(), '-', xs.max(), ' y', ys.min(), '-', ys.max(), ' (w,h):', img.size)

# 2) column alpha profile - find letter gaps (columns with tiny alpha)
colsum = (alpha > 128).sum(axis=0)
w = len(colsum)
# print profile compressed: 60 buckets
buckets = 60
bw = w // buckets
prof = [int(colsum[i*bw:(i+1)*bw].mean()) for i in range(buckets)]
print('col profile (h=%d):' % img.size[1])
print(' '.join(f'{p:4d}' for p in prof))

# 3) sample a horizontal line through the middle of planet O to find color runs
H, W = alpha.shape
def runs(y):
    row = a[y]
    out = []
    cur = None; start = 0
    for x in range(W):
        r,g,b,al = row[x]
        opaque = al > 128
        if opaque:
            # classify color
            if b > 150 and r < 120: c = 'BLUE'
            elif r > 130 and b > 150 and g < 120: c = 'PURP'
            elif r > 200 and g > 140 and b < 100: c = 'YEL'
            elif g > 130 and r < 120 and b < 120: c = 'GRN'
            elif r > 180 and g < 110 and b < 130: c = 'PINK'
            else: c = 'oth'
        else:
            c = None
        if c != cur:
            if cur is not None: out.append((cur, start, x-1))
            cur = c; start = x
    if cur is not None: out.append((cur, start, W-1))
    return [(c, s, e) for c, s, e in out if c not in (None,)]

for y in [300, 450, 600, 750]:
    print(f'y={y}:', runs(y)[:24])
