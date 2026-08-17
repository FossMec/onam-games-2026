/**
 * Build-time image variants for the art that is looked up by name.
 *
 * `vite-imagetools` resolves sizes per *import*, which is exactly right for a
 * literal `<img src={hero} />` - but several places here pick an image from a
 * map at runtime (`GAME_IMAGES[slug]`, a meme chosen by seed), and a runtime
 * string has no import site. `import.meta.glob` bridges that: every candidate
 * is transformed at build time and the map holds the resulting URLs, so the
 * lookup still lands on a correctly-sized file.
 *
 * Widths come from the layout, not from the source files:
 *
 *   game cards   `w-full sm:w-64 md:w-72` - 288px at desktop, a phone's width
 *                on mobile. Sources were 600px and, for four of them, 1024px.
 *   memes        a content column, never past ~480px. Sources were ~512px.
 *   marks        `ProjectMark` draws these at up to 148px.
 *
 * Two candidates each, so a phone does not pay for a desktop card.
 */

type UrlMap = Record<string, string>;

const GAME_SRCSET = import.meta.glob<string>("~/assets/images/games/*.webp", {
  query: { w: "320;576", format: "webp", quality: 78, as: "srcset" },
  import: "default",
  eager: true,
});
const GAME_SRC = import.meta.glob<string>("~/assets/images/games/*.webp", {
  query: { w: 576, format: "webp", quality: 78 },
  import: "default",
  eager: true,
});

const MEME_SRCSET = import.meta.glob<string>("~/assets/images/memes/*.webp", {
  query: { w: "320;480", format: "webp", quality: 76, as: "srcset" },
  import: "default",
  eager: true,
});
const MEME_SRC = import.meta.glob<string>("~/assets/images/memes/*.webp", {
  query: { w: 480, format: "webp", quality: 76 },
  import: "default",
  eager: true,
});

/*
 * Comic panels are the one place detail is the content - lettered artwork
 * people zoom into - so they keep a generous top width. Both the full square
 * and the split halves are used: halves on a phone, full on desktop.
 */
const COMIC_SRCSET = import.meta.glob<string>("~/assets/images/comics/*.webp", {
  query: { w: "512;900", format: "webp", quality: 78, as: "srcset" },
  import: "default",
  eager: true,
});
const COMIC_SRC = import.meta.glob<string>("~/assets/images/comics/*.webp", {
  query: { w: 900, format: "webp", quality: 78 },
  import: "default",
  eager: true,
});

const LOOSE_SRC = import.meta.glob<string>("~/assets/images/*.webp", {
  query: { w: 560, format: "webp", quality: 80 },
  import: "default",
  eager: true,
});

const MARK_SRC = import.meta.glob<string>("~/assets/images/marks/*.webp", {
  query: { w: 296, format: "webp", quality: 82 },
  import: "default",
  eager: true,
});

/*
 * Game sprites are painted into a canvas at their own pixel size, so they are
 * re-encoded but never resized - shrinking one would change how the game
 * looks. They still go through the pipeline for the WebP pass and, more
 * usefully, for the content hash: `_build/assets` is served `immutable`, so a
 * returning player never refetches them.
 */
const SPRITE_FULL = import.meta.glob<string>("~/assets/sprites/icons/*.webp", {
  query: { w: 192, format: "webp", quality: 85 },
  import: "default",
  eager: true,
});

const JUMP_SRC = import.meta.glob<string>("~/assets/sprites/jump/*.webp", {
  query: { format: "webp", quality: 80 },
  import: "default",
  eager: true,
});
const VALLAM_SRC = import.meta.glob<string>("~/assets/sprites/vallam/*.webp", {
  query: { format: "webp", quality: 80 },
  import: "default",
  eager: true,
});

/** Carousel of last year's entries: a 160px thumb, tapping opens the full art. */
const POOKALAM_THUMB = import.meta.glob<string>("~/assets/previous-pookalam/thumbs/*.webp", {
  query: { w: 280, format: "webp", quality: 78 },
  import: "default",
  eager: true,
});
const POOKALAM_FULL = import.meta.glob<string>("~/assets/previous-pookalam/*.webp", {
  query: { w: 900, format: "webp", quality: 80 },
  import: "default",
  eager: true,
});

function lookup(map: UrlMap, file: string): string {
  for (const [path, url] of Object.entries(map)) {
    if (path.endsWith(`/${file}`)) return url;
  }
  return "";
}

/** Accepts either a bare filename or a legacy `/images/games/x.webp` path. */
const basename = (ref: string) => ref.split("/").pop() ?? ref;

export const gameImage = (ref: string) => lookup(GAME_SRC, basename(ref));
export const gameImageSrcset = (ref: string) => lookup(GAME_SRCSET, basename(ref));
export const memeImage = (ref: string) => lookup(MEME_SRC, basename(ref));
export const memeImageSrcset = (ref: string) => lookup(MEME_SRCSET, basename(ref));
export const markImage = (ref: string) => lookup(MARK_SRC, basename(ref));
export const comicImage = (ref: string) => lookup(COMIC_SRC, basename(ref));
export const comicImageSrcset = (ref: string) => lookup(COMIC_SRCSET, basename(ref));
/** Odd one-off art living directly in `assets/images`. */
export const looseImage = (ref: string) => lookup(LOOSE_SRC, basename(ref));
/**
 * A sprite at its native size, for the share card.
 *
 * The card is painted into a large canvas and then downloaded as a PNG, so it
 * wants more pixels than the 32-136px variants `SpriteIcon` ships to the DOM.
 */
export const spriteImage = (ref: string) => lookup(SPRITE_FULL, basename(ref));
export const jumpSprite = (ref: string) => lookup(JUMP_SRC, basename(ref));
export const vallamSprite = (ref: string) => lookup(VALLAM_SRC, basename(ref));
export const pookalamThumb = (ref: string) => lookup(POOKALAM_THUMB, basename(ref));
export const pookalamFull = (ref: string) => lookup(POOKALAM_FULL, basename(ref));
