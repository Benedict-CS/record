# -*- coding: utf-8 -*-
import os
import sys
from PIL import Image

base = r"C:\Users\winlab\.cursor\projects\d-record\assets"
files = sorted([f for f in os.listdir(base) if f.endswith('.jpg') and '82588' in f])
print("files:", len(files))
for i,f in enumerate(files):
    p=os.path.join(base,f)
    im=Image.open(p)
    print(i, im.size, os.path.getsize(p), f[-60:])

# Try easyocr on first readable image
import easyocr
reader = easyocr.Reader(['ch_tra','en'], gpu=False)
idx = int(sys.argv[1]) if len(sys.argv)>1 else 0
f = files[idx]
p = os.path.join(base, f)
im = Image.open(p)
print("OCR", idx, im.size)
# if very narrow, maybe it's a strip - still try
out_dir = r"d:\record\_ocr_out"
os.makedirs(out_dir, exist_ok=True)
result = reader.readtext(p, detail=1, paragraph=False)
lines = []
for bbox, text, conf in result:
    y = bbox[0][1]
    lines.append((y, text, conf))
lines.sort(key=lambda x: x[0])
out = os.path.join(out_dir, f"easy_{idx}.txt")
with open(out, "w", encoding="utf-8") as fh:
    for y, text, conf in lines:
        fh.write(f"{y:.0f}\t{conf:.2f}\t{text}\n")
print("wrote", out, "n=", len(lines))
