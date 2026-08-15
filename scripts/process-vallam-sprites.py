import os
from PIL import Image
import numpy as np
from collections import deque

def process_image(src_path):
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    arr = np.array(im, dtype=np.float32)
    
    # Calculate background mask via flood fill from borders
    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    q = deque()
    
    # Check borders
    for x in range(w):
        for y in (0, h - 1):
            if np.mean(arr[y, x]) >= 235:
                q.append((x, y))
                visited[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y, x] and np.mean(arr[y, x]) >= 235:
                q.append((x, y))
                visited[y, x] = True
                
    while q:
        cx, cy = q.popleft()
        bg_mask[cy, cx] = True
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                if np.mean(arr[ny, nx]) >= 232 or (np.min(arr[ny, nx]) >= 225 and np.max(arr[ny, nx]) - np.min(arr[ny, nx]) < 15):
                    visited[ny, nx] = True
                    q.append((nx, ny))
                    
    # Also flood fill any enclosed white pockets (e.g. between oars) that have near-pure white (>= 245)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if not visited[y, x] and np.all(arr[y, x] >= 248):
                q_pocket = deque([(x, y)])
                pocket = [(x, y)]
                visited[y, x] = True
                while q_pocket:
                    px, py = q_pocket.popleft()
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nx, ny = px + dx, py + dy
                        if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                            if np.all(arr[ny, nx] >= 242):
                                visited[ny, nx] = True
                                pocket.append((nx, ny))
                                q_pocket.append((nx, ny))
                for px, py in pocket:
                    bg_mask[py, px] = True

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    rgba = np.dstack([arr.astype(np.uint8), alpha])
    img_rgba = Image.fromarray(rgba, "RGBA")
    
    bbox = img_rgba.getbbox()
    if bbox:
        pad = 2
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(w, bbox[2] + pad)
        y1 = min(h, bbox[3] + pad)
        img_rgba = img_rgba.crop((x0, y0, x1, y1))
        
    return img_rgba

def main():
    os.makedirs("public/sprites/vallam", exist_ok=True)
    files = {
        "hero-vallam": "public/images-raw/main-boat.jpeg",
        "boat-small": "public/images-raw/enemy-boat-1.jpeg",
        "boat-canoe": "public/images-raw/enemy-baot-2.jpeg",
        "boat-wood": "public/images-raw/enemy-boat-3.jpeg"
    }

    results = {}
    for key, path in files.items():
        if not os.path.exists(path):
            print(f"Skipping missing file: {path}")
            continue
        cleaned = process_image(path)
        results[key] = cleaned

    if len(results) == 4:
        # 1. Hero vallam: proportioned for 3-cell slot (aspect ratio 3.0:1)
        hero = results["hero-vallam"]
        hero_3cell = hero.resize((900, 300), Image.Resampling.LANCZOS)
        hero_3cell.save("public/sprites/vallam/hero-vallam.png")
        hero_3cell.save("public/sprites/vallam/hero-vallam.webp", "WEBP", quality=95)
        print("Hero Vallam (3-cell):", hero_3cell.size)

        # 2. Wood boat: proportioned for 2-cell slot (aspect ratio ~1.95:1)
        wood = results["boat-wood"]
        wood_2cell = wood.resize((805, 415), Image.Resampling.LANCZOS)
        wood_2cell.save("public/sprites/vallam/boat-wood.png")
        wood_2cell.save("public/sprites/vallam/boat-wood.webp", "WEBP", quality=95)
        print("Wood Boat (2-cell):", wood_2cell.size)

        # 3. Canoe:
        # 3-cell canoe (aspect ratio ~2.8:1)
        canoe = results["boat-canoe"]
        canoe_3cell = canoe.resize((1160, 410), Image.Resampling.LANCZOS)
        canoe_3cell.save("public/sprites/vallam/boat-canoe-3.png")
        canoe_3cell.save("public/sprites/vallam/boat-canoe-3.webp", "WEBP", quality=95)
        # 2-cell canoe (aspect ratio ~2.05:1)
        canoe_2cell = canoe.resize((900, 437), Image.Resampling.LANCZOS)
        canoe_2cell.save("public/sprites/vallam/boat-canoe.png")
        canoe_2cell.save("public/sprites/vallam/boat-canoe.webp", "WEBP", quality=95)
        print("Canoe (2-cell & 3-cell):", canoe_2cell.size, canoe_3cell.size)

        # 4. Small dinghy: horizontal 2-cell proportion (aspect ratio 2.0:1)
        small = results["boat-small"]
        small_h = small.rotate(270, expand=True)
        small_2cell = small_h.resize((750, 375), Image.Resampling.LANCZOS)
        small_2cell.save("public/sprites/vallam/boat-small-h.png")
        small_2cell.save("public/sprites/vallam/boat-small-h.webp", "WEBP", quality=95)
        small.save("public/sprites/vallam/boat-small.png")
        small.save("public/sprites/vallam/boat-small.webp", "WEBP", quality=95)
        print("Small Boat (2-cell):", small_2cell.size)

        # Build unified sprite sheet
        sheet_w = 1400
        sheet_h = 1000
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

        # Row 1: Hero Vallam
        hero_w = 1200
        hero_h = int(hero_w * (hero_3cell.height / hero_3cell.width))
        hero_resized = hero_3cell.resize((hero_w, hero_h), Image.Resampling.LANCZOS)
        sheet.paste(hero_resized, (50, 30), hero_resized)

        # Row 2: Canoe 3-cell
        canoe_w = 1200
        canoe_h = int(canoe_w * (canoe_3cell.height / canoe_3cell.width))
        canoe_resized = canoe_3cell.resize((canoe_w, canoe_h), Image.Resampling.LANCZOS)
        y2 = 30 + hero_h + 30
        sheet.paste(canoe_resized, (50, y2), canoe_resized)

        # Row 3: Wood & Small
        wood_w = 650
        wood_h = int(wood_w * (wood_2cell.height / wood_2cell.width))
        wood_resized = wood_2cell.resize((wood_w, wood_h), Image.Resampling.LANCZOS)
        y3 = y2 + canoe_h + 30
        sheet.paste(wood_resized, (50, y3), wood_resized)

        small_w = 600
        small_h = int(small_w * (small_2cell.height / small_2cell.width))
        small_resized = small_2cell.resize((small_w, small_h), Image.Resampling.LANCZOS)
        sheet.paste(small_resized, (750, y3 + (wood_h - small_h) // 2), small_resized)

        bbox = sheet.getbbox()
        if bbox:
            sheet = sheet.crop(bbox)

        sheet.save("public/sprites/vallam-sheet.png")
        sheet.save("public/sprites/vallam-sheet.webp", "WEBP", quality=95)
        print("Saved public/sprites/vallam-sheet.webp:", sheet.size)

if __name__ == "__main__":
    main()
