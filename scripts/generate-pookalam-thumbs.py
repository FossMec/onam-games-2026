import os
from PIL import Image

SRC_DIR = "public/previous-pookalam"
THUMB_DIR = os.path.join(SRC_DIR, "thumbs")

os.makedirs(THUMB_DIR, exist_ok=True)

files = [f for f in os.listdir(SRC_DIR) if f.endswith(".webp") and os.path.isfile(os.path.join(SRC_DIR, f))]

for f in files:
    src_path = os.path.join(SRC_DIR, f)
    dst_path = os.path.join(THUMB_DIR, f)
    
    with Image.open(src_path) as img:
        # Resize maintaining aspect ratio to fit inside 240x240
        img.thumbnail((240, 240), Image.Resampling.LANCZOS)
        img.save(dst_path, "WEBP", quality=75, method=6)
        
    orig_size = os.path.getsize(src_path)
    new_size = os.path.getsize(dst_path)
    print(f"Processed {f}: {orig_size / 1024:.1f}KB -> {new_size / 1024:.1f}KB")

print("Done generating thumbnails!")
