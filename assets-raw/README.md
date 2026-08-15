# assets-raw

Source images. **Not** served — nothing in here reaches the browser.

These are the originals the sprite and artwork scripts (`scripts/*.py`) cut
down into the webp files under `public/`. They used to live in
`public/images-raw/`, which meant ~13 MB of untouched JPEGs and PNGs were
uploaded to the CDN on every deployment for the sake of four Python scripts
that only ever read them off the local disk.

Anything a page actually links to belongs in `public/`. Anything a script reads
to _produce_ those files belongs here.

## Layout

- `*.jpeg`, `memes/` — the sheets and photographs the `scripts/*.py` sprite and
  artwork passes read.
- `sprite-sheets/` — the recomposed sheets `generate-sprites.py` writes out
  after cutting the icons. A contact sheet for eyeballing the result; the site
  loads the individual icons from `public/sprites/icons/`.
- `previous-pookalam/` — contributors' original PNG/JPEG submissions. The
  carousel loads the `.webp` conversions in `public/previous-pookalam/`; every
  original here has one, and the originals are kept because they are somebody
  else's work, not ours to throw away.
- `originals/` — full-size artwork the site only ships downscaled.
- `retired/` — files that were being served but nothing referenced. The paths
  under it mirror where they used to sit, so restoring one is a `git mv` back.
  Note `retired/images/pookalam/pookalam.webp`: the jigsaw's image comes from
  the `games.assets_json` column, and the local database points it at
  `/images/games/pookalam.webp`. If a deployed database ever pointed at the
  `/images/pookalam/` path instead, that file goes back.
