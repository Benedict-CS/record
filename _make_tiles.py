# -*- coding: utf-8 -*-
"""Just upscale and tile images for vision reading (no OCR)."""
import os
from PIL import Image

base = r"C:\Users\winlab\.cursor\projects\d-record\assets"
out_dir = r"d:\record\_ocr_out"
os.makedirs(out_dir, exist_ok=True)

ids = ["825887", "825882", "825883", "825886"]
for which in ids:
    path = None
    for f in os.listdir(base):
        if which in f and f.endswith(".jpg"):
            path = os.path.join(base, f)
            break
    im = Image.open(path).convert("RGB")
    scale = max(1, round(480 / im.size[0]))
    up = im.resize((im.size[0] * scale, im.size[1] * scale), Image.Resampling.LANCZOS)
    print(which, "orig", im.size, "up", up.size, "scale", scale)
    tile_h = 1400
    overlap = 80
    y_off = 0
    n = 0
    while y_off < up.size[1]:
        y1 = min(up.size[1], y_off + tile_h)
        tile = up.crop((0, y_off, up.size[0], y1))
        out = os.path.join(out_dir, f"{which}_v_{n}.png")
        tile.save(out)
        print(" ", out, tile.size)
        n += 1
        if y1 >= up.size[1]:
            break
        y_off = y1 - overlap
