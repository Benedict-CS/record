"""Slice tall screenshots and OCR with Tesseract (chi_tra+eng)."""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

TESS = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
ASSETS = Path(r"C:\Users\winlab\.cursor\projects\d-record\assets")
OUT = Path(r"d:\record\_ocr_batch")
OUT.mkdir(parents=True, exist_ok=True)

FILES = [
    ("feb", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825885-ac24e040-2fc7-4b77-9e92-538c80bf9d8c.jpg"),
    ("apr_long", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825883-63a4e25b-5d30-49b1-9f03-d6583ddd9413.jpg"),
    ("jan_or_other", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825886-349c34b8-bd56-423c-b196-03f596836924.jpg"),
    ("mar", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825884-f91c2f1b-3827-468b-b717-c5055985b272.jpg"),
    ("apr_or_other", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825882-cb7700b3-a48d-4e93-abf5-4af87e0536bb.jpg"),
    ("may_a", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825887-25ed7820-8a9d-4db9-8743-1b2e97d58d3c.jpg"),
    ("may_b", "c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825888-021d1561-5c96-4fa7-a66a-ef4c8559b384.jpg"),
]


def ocr_image(path: Path) -> str:
    with tempfile.TemporaryDirectory() as td:
        base = Path(td) / "out"
        subprocess.run(
            [TESS, str(path), str(base), "-l", "chi_tra+eng", "--psm", "6"],
            check=True,
            capture_output=True,
        )
        return (base.with_suffix(".txt")).read_text(encoding="utf-8", errors="replace")


def slice_and_ocr(src: Path, label: str, slice_h: int = 1600, overlap: int = 120) -> str:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    parts: list[str] = [f"=== {label} size={w}x{h} ===\n"]
    y = 0
    idx = 0
    while y < h:
        y2 = min(h, y + slice_h)
        crop = img.crop((0, y, w, y2))
        # Upscale a bit for small text
        crop = crop.resize((w * 2, (y2 - y) * 2), Image.Resampling.LANCZOS)
        slice_path = OUT / f"{label}_slice{idx:02d}.png"
        crop.save(slice_path)
        text = ocr_image(slice_path)
        parts.append(f"--- slice {idx} y={y}-{y2} ---\n{text}\n")
        if y2 >= h:
            break
        y = y2 - overlap
        idx += 1
    return "\n".join(parts)


def main() -> None:
    summary = {}
    for label, name in FILES:
        src = ASSETS / name
        print(f"OCR {label} ...", flush=True)
        text = slice_and_ocr(src, label)
        out = OUT / f"{label}.txt"
        out.write_text(text, encoding="utf-8")
        summary[label] = {"chars": len(text), "file": str(out)}
        # Print header lines for quick month ID
        # Avoid Windows console encoding crashes.
        safe = head.encode("utf-8", errors="replace").decode("utf-8")
        try:
            print(safe[:800])
        except UnicodeEncodeError:
            print(safe.encode("ascii", errors="replace").decode("ascii")[:800])
        print("====", flush=True)
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
