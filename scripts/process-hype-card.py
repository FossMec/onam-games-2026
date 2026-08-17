"""
Cut the sticker sheet out of its white studio background.

`assets-raw/game-hype-card.jpeg` is a flat collage of die-cut stickers on
white. The landing page floats it inside an inked cream panel, so the white
has to go - but the stickers' own die-cut borders are *cream*, not white, and
the two are only a few levels apart. A global "brightness > n is background"
threshold eats those borders and leaves every sticker looking gnawed.

So the cut is topological rather than photometric: flood fill inwards from the
frame and only through pixels that are near-pure white. A cream die-cut border
stops the fill, which is exactly what a border is for. Enclosed white pockets
(inside the boat's oars, the gaps between overlapping stickers) are unreachable
from the frame, so they get a second pass that requires the pocket to be
*entirely* white - a pocket that touches any colour is part of a sticker.

Edges then get one pass of feathering, because a hard binary alpha on artwork
this dense reads as a jagged halo once the browser scales it down.

    python3 scripts/process-hype-card.py
"""

import numpy as np
from PIL import Image, ImageFilter
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-raw" / "game-hype-card.jpeg"
OUT = ROOT / "src" / "assets" / "images" / "game-hype-card.webp"

# The frame fill walks through anything this bright. Cream (#fdf6e8 and down)
# sits below it, so die-cut borders survive.
WHITE = 246
# A pocket has to be cleaner than that to count, since a pocket cannot be
# sanity-checked against the frame.
POCKET_WHITE = 250

NEIGHBOURS = ((-1, 0), (1, 0), (0, -1), (0, 1))


def frame_fill(arr: np.ndarray) -> np.ndarray:
    """Background reachable from the image border without crossing ink."""
    h, w, _ = arr.shape
    white = arr.min(axis=2) >= WHITE
    seen = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        for dx, dy in NEIGHBOURS:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny, nx] and white[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))

    return seen


def pocket_fill(arr: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Sealed white regions - between oars, under overlaps - that the frame missed."""
    h, w, _ = arr.shape
    white = arr.min(axis=2) >= POCKET_WHITE
    seen = bg.copy()

    for y in range(h):
        for x in range(w):
            if seen[y, x] or not white[y, x]:
                continue
            region = [(x, y)]
            seen[y, x] = True
            q = deque(region)
            while q:
                cx, cy = q.popleft()
                for dx, dy in NEIGHBOURS:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny, nx] and white[ny, nx]:
                        seen[ny, nx] = True
                        region.append((nx, ny))
                        q.append((nx, ny))
            for px, py in region:
                bg[py, px] = True

    return bg


def main() -> None:
    im = Image.open(SRC).convert("RGB")
    arr = np.array(im)

    bg = pocket_fill(arr, frame_fill(arr))

    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8), "L")
    # Half-pixel feather: enough to kill the stair-stepping, not enough to
    # leave a white fringe when the panel behind it is cream.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    alpha = alpha.point(lambda v: 0 if v < 90 else min(255, int(v * 1.35)))

    out = Image.merge("RGBA", (*im.split(), alpha))
    # Trim to the artwork so the panel is not padding invisible margins.
    bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        out = out.crop(bbox)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, "WEBP", quality=95, method=6, exact=True)
    print(f"{OUT.relative_to(ROOT)}  {out.size[0]}x{out.size[1]}  {OUT.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
