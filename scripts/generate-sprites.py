import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from collections import deque

os.makedirs('public/sprites/icons', exist_ok=True)

# Clean up removed sprites
for obsolete in ['terminal-pill.png', 'check-badge.png']:
    p = os.path.join('public/sprites/icons', obsolete)
    if os.path.exists(p):
        os.remove(p)
        print(f"Removed watermark image: {obsolete}")

def remove_outer_bg(img_rgb, threshold=238, mean_threshold=242):
    """
    Flood-fill from image boundaries to remove outer background,
    leaving inner white fills and outlines fully intact.
    """
    arr = np.array(img_rgb)
    h, w, c = arr.shape
    rgb = arr[:, :, :3]
    alpha = np.ones((h, w), dtype=np.uint8) * 255
    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    # Seed top and bottom borders
    for x in range(w):
        for y in (0, h - 1):
            if np.all(rgb[y, x] >= threshold) or np.mean(rgb[y, x]) >= mean_threshold:
                q.append((x, y))
                visited[y, x] = True

    # Seed left and right borders
    for y in range(h):
        for x in (0, w - 1):
            if not visited[y, x] and (np.all(rgb[y, x] >= threshold) or np.mean(rgb[y, x]) >= mean_threshold):
                q.append((x, y))
                visited[y, x] = True

    while q:
        cx, cy = q.popleft()
        alpha[cy, cx] = 0
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                if np.all(rgb[ny, nx] >= threshold) or np.mean(rgb[ny, nx]) >= mean_threshold:
                    visited[ny, nx] = True
                    q.append((nx, ny))

    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, 'RGBA')

def process_foss_logo():
    if not os.path.exists('assets-raw/foss-logo-theme.jpeg'):
        return
    img = Image.open('assets-raw/foss-logo-theme.jpeg').convert('RGBA')
    w, h = img.size
    
    # Create smooth anti-aliased circular mask with radius ~456
    mask = Image.new('L', (w * 4, h * 4), 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = (w * 4) // 2, (h * 4) // 2
    r = int(456.5 * 4)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    
    r_ch, g_ch, b_ch, _ = img.split()
    badge_trans = Image.merge('RGBA', (r_ch, g_ch, b_ch, mask))
    badge_trans.save('public/sprites/icons/foss-mec-badge.png')
    print("Saved clean circular public/sprites/icons/foss-mec-badge.png")

def process_sheets():
    # 15 icons per sheet (excluding 16th which has watermark)
    sheet1_names = [
        "maveli-laptop", "vamana-umbrella", "git-nodes", "octocat-garland",
        "docker-pookalam", "terminal-star", "arch-crown", "nilavilakku",
        "burst-heart", "floppy-onam", "footprints", "kite-memphis",
        "git-branch", "papad-face", "pookalam-flower"
    ]
    
    sheet2_names = [
        "tux-king", "ferris-crab", "gopher-king", "linus-torvalds",
        "osi-logo", "gnu-garland", "bird-mascot", "sadya-leaf",
        "capsule-pill", "concentric-pookalam", "muthukuda", "coconut-palm",
        "kite-pattern", "burst-yellow", "python-snake"
    ]

    # Process Sheet 1
    im1 = Image.open('assets-raw/sticker-sheet-1.jpeg').convert('RGB')
    w, h = im1.size
    cell_w, cell_h = w // 4, h // 4

    out_sheet1 = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    for idx, name in enumerate(sheet1_names):
        r = idx // 4
        c = idx % 4
        box = (c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
        cell = im1.crop(box)
        cell_trans = remove_outer_bg(cell, threshold=240, mean_threshold=245)
        
        cell_trans.save(f'public/sprites/icons/{name}.png')
        out_sheet1.paste(cell_trans, box)
        print(f"Sheet 1: saved {name}")

    out_sheet1.save('assets-raw/sprite-sheets/sheet-1.png')
    print("Saved assets-raw/sprite-sheets/sheet-1.png")

    # Process Sheet 2
    im2 = Image.open('assets-raw/sticker-sheet-2.jpeg').convert('RGB')
    out_sheet2 = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    for idx, name in enumerate(sheet2_names):
        r = idx // 4
        c = idx % 4
        box = (c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
        cell = im2.crop(box)
        cell_trans = remove_outer_bg(cell, threshold=238, mean_threshold=242)
        
        cell_trans.save(f'public/sprites/icons/{name}.png')
        out_sheet2.paste(cell_trans, box)
        print(f"Sheet 2: saved {name}")

    out_sheet2.save('assets-raw/sprite-sheets/sheet-2.png')
    print("Saved assets-raw/sprite-sheets/sheet-2.png")

    process_foss_logo()

if __name__ == '__main__':
    process_sheets()
