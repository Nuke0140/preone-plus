#!/usr/bin/env python3
"""Build PreOne logo assets: trimmed full wordmark + square mark crops (candidates)."""
from PIL import Image
import os

SRC = '/home/z/my-project/upload/preone_logo.png'
OUT = '/home/z/my-project/public'
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGBA')

# 1) Trimmed full wordmark
full = img.crop((49, 65, 1740, 871))          # 1691 x 806
full.save(f'{OUT}/preone-logo.png', optimize=True)
print('full wordmark:', full.size)

# 2) Square mark candidates around planet O (center x~1038)
cands = {
    'mark-a.png': (718, 230, 1358, 870),   # planet disc + ring, 640px sq
    'mark-b.png': (768, 280, 1308, 820),   # tighter on disc
    'mark-c.png': (600, 140, 1500, 894),   # wide incl star, non-square -> pad to square below
}
for name, box in cands.items():
    c = img.crop(box)
    w, h = c.size
    if w != h:  # pad to square, center content
        side = max(w, h)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(c, ((side - w) // 2, (side - h) // 2), c)
        c = sq
    c.save(f'/home/z/my-project/scripts/{name}', optimize=True)
    print(name, c.size)
