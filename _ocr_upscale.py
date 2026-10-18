# -*- coding: utf-8 -*-
"""Upscale thin long-screenshots and OCR in vertical tiles."""
import os
import sys
from PIL import Image
import easyocr

base = r"C:\Users\winlab\.cursor\projects\d-record\assets"
targets = {
    "825887": "may6677_a",
    "825888": "may6677_b",
    "825882": "may10830",
    "825883": "apr8329",
    "825886": "may32762",
}
out_dir = r"d:\record\_ocr_out"
os.makedirs(out_dir, exist_ok=True)

which = sys.argv[1]
lang = sys.argv[2] if len(sys.argv) > 2 else "ch_tra"
label = targets[which]
path = None
for f in os.listdir(base):
    if which in f and f.endswith(".jpg"):
        path = os.path.join(base, f)
        break
print("path", path, "lang", lang)
im = Image.open(path).convert("RGB")
print("orig", im.size)
# Upscale to readable width ~480
target_w = 480
scale = max(1, round(target_w / im.size[0]))
up = im.resize((im.size[0] * scale, im.size[1] * scale), Image.Resampling.LANCZOS)
print("up", up.size, "scale", scale)

reader = easyocr.Reader([lang, "en"], gpu=False)
tile_h = 1600
overlap = 100
all_lines = []
y_off = 0
while y_off < up.size[1]:
    y1 = min(up.size[1], y_off + tile_h)
    tile = up.crop((0, y_off, up.size[0], y1))
    tile_path = os.path.join(out_dir, f"{label}_tile_{y_off}.png")
    tile.save(tile_path)
    result = reader.readtext(tile_path, detail=1, paragraph=False)
    for b, t, c in result:
        all_lines.append((y_off + b[0][1], t, c))
    print(f"tile {y_off}-{y1}: {len(result)} lines")
    if y1 >= up.size[1]:
        break
    y_off = y1 - overlap

all_lines.sort(key=lambda x: x[0])
# dedupe near-duplicate text at similar y
deduped = []
for y, t, c in all_lines:
    if deduped and abs(deduped[-1][0] - y) < 8 and deduped[-1][1] == t:
        if c > deduped[-1][2]:
            deduped[-1] = (y, t, c)
        continue
    deduped.append((y, t, c))

out = os.path.join(out_dir, f"easy_{label}.txt")
with open(out, "w", encoding="utf-8") as fh:
    for y, t, c in deduped:
        fh.write(f"{y:.0f}\t{c:.2f}\t{t}\n")
print("wrote", out, "n=", len(deduped))
