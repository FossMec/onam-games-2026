import os
from PIL import Image, ImageDraw
import numpy as np
from collections import deque

def clean_sprite(crop):
    w, h = crop.size
    inset = 8
    img = crop.crop((inset, inset, w - inset, h - inset))
    w, h = img.size
    arr = np.array(img, dtype=np.float32)
    
    visited = np.zeros((h, w), dtype=bool)
    bg_mask = np.zeros((h, w), dtype=bool)
    q = deque()
    
    for x in range(w):
        for y in (0, h - 1):
            if np.mean(arr[y, x]) >= 230:
                q.append((x, y))
                visited[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y, x] and np.mean(arr[y, x]) >= 230:
                q.append((x, y))
                visited[y, x] = True
                
    while q:
        cx, cy = q.popleft()
        bg_mask[cy, cx] = True
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                if np.mean(arr[ny, nx]) >= 225 or (np.min(arr[ny, nx]) >= 215 and np.max(arr[ny, nx]) - np.min(arr[ny, nx]) < 20):
                    visited[ny, nx] = True
                    q.append((nx, ny))

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    rgba = np.dstack([arr.astype(np.uint8), alpha])
    res = Image.fromarray(rgba, "RGBA")
    bbox = res.getbbox()
    if bbox:
        pad = 2
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(w, bbox[2] + pad)
        y1 = min(h, bbox[3] + pad)
        res = res.crop((x0, y0, x1, y1))
    return res

def main():
    os.makedirs("public/sprites/jump", exist_ok=True)
    sheet_path = "assets-raw/maveli-jump-sprite.jpeg"
    if not os.path.exists(sheet_path):
        print(f"Missing {sheet_path}")
        return

    sheet = Image.open(sheet_path).convert("RGB")
    w, h = sheet.size
    cw, ch = w // 4, h // 4

    mapping = {
        "maveli-idle": (0, 0),
        "maveli-look": (0, 1),
        "maveli-jump": (0, 2),
        "maveli-fall": (0, 3),
        "maveli-umbrella": (1, 0),
        "maveli-balloon": (1, 1),
        "item-balloon": (1, 2),
        "item-coin": (1, 3),
        "enemy-vamana": (2, 0),
        "enemy-vamana-jump": (2, 1),
        "maveli-win": (2, 2),
        "maveli-cry": (2, 3),
        "maveli-angry": (3, 0),
        "maveli-tumble": (3, 1),
        "obstacle-cloud": (3, 2),
    }

    for name, (r, c) in mapping.items():
        crop = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        cleaned = clean_sprite(crop)
        cleaned.save(f"public/sprites/jump/{name}.png")
        cleaned.save(f"public/sprites/jump/{name}.webp", "WEBP", quality=95)
        print(f"Saved {name}: {cleaned.size}")

    # Generate Styled Platform Sprites
    # 1. Normal Platform
    p_norm = Image.new("RGBA", (180, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(p_norm)
    d.rounded_rectangle([4, 6, 175, 42], radius=12, fill="#2ec4b6", outline="#22202b", width=4)
    d.rounded_rectangle([10, 10, 169, 22], radius=6, fill="#5be0d4")
    for x in [50, 90, 130]:
        d.line([(x, 6), (x, 42)], fill="#22202b", width=3)
    p_norm.save("public/sprites/jump/platform-normal.png")
    p_norm.save("public/sprites/jump/platform-normal.webp", "WEBP", quality=95)

    # 2. Spring / Umbrella Max Jump Platform
    p_spring = Image.new("RGBA", (180, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(p_spring)
    d.rounded_rectangle([4, 18, 175, 52], radius=12, fill="#ff9f1c", outline="#22202b", width=4)
    d.rounded_rectangle([10, 22, 169, 34], radius=6, fill="#ffbf69")
    d.chord([72, 2, 108, 38], start=180, end=360, fill="#e71d36", outline="#22202b", width=3)
    d.line([(90, 20), (90, 32)], fill="#22202b", width=3)
    p_spring.save("public/sprites/jump/platform-spring.png")
    p_spring.save("public/sprites/jump/platform-spring.webp", "WEBP", quality=95)

    # 3. Moving Platform
    p_move = Image.new("RGBA", (180, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(p_move)
    d.rounded_rectangle([4, 6, 175, 42], radius=12, fill="#3a86ff", outline="#22202b", width=4)
    d.rounded_rectangle([10, 10, 169, 22], radius=6, fill="#83b0ff")
    d.line([(45, 24), (55, 14)], fill="#ffffff", width=3)
    d.line([(45, 24), (55, 34)], fill="#ffffff", width=3)
    d.line([(135, 24), (125, 14)], fill="#ffffff", width=3)
    d.line([(135, 24), (125, 34)], fill="#ffffff", width=3)
    p_move.save("public/sprites/jump/platform-moving.png")
    p_move.save("public/sprites/jump/platform-moving.webp", "WEBP", quality=95)

    # 4. Breakable / Cracked One-Time Platform (Banana Yellow with prominent jagged fracture cracks)
    p_break = Image.new("RGBA", (180, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(p_break)
    d.rounded_rectangle([4, 6, 175, 42], radius=12, fill="#ffd166", outline="#22202b", width=4)
    d.rounded_rectangle([10, 10, 169, 22], radius=6, fill="#ffe599")
    # Prominent central jagged lightning fracture
    d.line([(86, 6), (94, 18), (82, 30), (92, 42)], fill="#22202b", width=4)
    # Side branch fractures
    d.line([(94, 18), (115, 22), (124, 30)], fill="#22202b", width=3)
    d.line([(82, 30), (62, 34), (52, 26)], fill="#22202b", width=3)
    d.line([(35, 8), (42, 18)], fill="#22202b", width=2)
    d.line([(145, 28), (155, 40)], fill="#22202b", width=2)
    p_break.save("public/sprites/jump/platform-breakable.png")
    p_break.save("public/sprites/jump/platform-breakable.webp", "WEBP", quality=95)
    print("Platforms generated.")

if __name__ == "__main__":
    main()
