# -*- coding: utf-8 -*-
import os
import sys
from PIL import Image
import pytesseract

base = r"C:\Users\winlab\.cursor\projects\d-record\assets"
files = [
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825885-ac24e040-2fc7-4b77-9e92-538c80bf9d8c.jpg",
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825884-f91c2f1b-3827-468b-b717-c5055985b272.jpg",
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825887-25ed7820-8a9d-4db9-8743-1b2e97d58d3c.jpg",
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825888-021d1561-5c96-4fa7-a66a-ef4c8559b384.jpg",
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825882-cb7700b3-a48d-4e93-abf5-4af87e0536bb.jpg",
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825883-63a4e25b-5d30-49b1-9f03-d6583ddd9413.jpg",
    "C__Users_winlab_.cursor_projects_d-record_assets_c__Users_winlab_AppData_Roaming_Cursor_User_workspaceStorage_d28e0e0c6284a64e26ffeebefb7955a2_images_825886-349c34b8-bd56-423c-b196-03f596836924.jpg",
]

out_dir = r"d:\record\_ocr_out"
os.makedirs(out_dir, exist_ok=True)

which = int(sys.argv[1]) if len(sys.argv) > 1 else 0
f = files[which]
path = os.path.join(base, f)
img = Image.open(path)
print(f"OCR {which}: size={img.size}")
# Traditional + Simplified + English
for lang in ["chi_tra+eng", "chi_sim+eng"]:
    try:
        text = pytesseract.image_to_string(img, lang=lang)
        out = os.path.join(out_dir, f"{which}_{lang.replace('+','-')}.txt")
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"wrote {out} ({len(text)} chars)")
    except Exception as e:
        print(f"fail {lang}: {e}")
