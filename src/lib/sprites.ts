/**
 * FOSS × Onam Sprite Registry & Metadata
 *
 * 30 curated sprites extracted from the sheets (excluding 16th watermark item)
 * plus the FOSS MEC emblem badge.
 * Designed to conform to the visual language: flat comic ink, washed tones,
 * and playful Kerala/FOSS mischief.
 */

export type SpriteName =
  | "maveli-laptop"
  | "vamana-umbrella"
  | "git-nodes"
  | "octocat-garland"
  | "docker-pookalam"
  | "terminal-star"
  | "arch-crown"
  | "nilavilakku"
  | "burst-heart"
  | "floppy-onam"
  | "footprints"
  | "kite-memphis"
  | "git-branch"
  | "papad-face"
  | "pookalam-flower"
  | "tux-king"
  | "ferris-crab"
  | "gopher-king"
  | "linus-torvalds"
  | "osi-logo"
  | "gnu-garland"
  | "bird-mascot"
  | "sadya-leaf"
  | "capsule-pill"
  | "concentric-pookalam"
  | "muthukuda"
  | "coconut-palm"
  | "kite-pattern"
  | "burst-yellow"
  | "python-snake"
  | "foss-mec-badge";

export interface SpriteInfo {
  name: SpriteName;
  label: string;
  sheet: 1 | 2 | "standalone";
  row: number;
  col: number;
  tags: string[];
  defaultTilt?: number;
}

export const SPRITE_REGISTRY: Record<SpriteName, SpriteInfo> = {
  // Sheet 1 (0..3, 0..3 excluding index 15)
  "maveli-laptop": {
    name: "maveli-laptop",
    label: "Maveli with Linux Laptop",
    sheet: 1,
    row: 0,
    col: 0,
    tags: ["mascot", "maveli", "linux", "hero"],
    defaultTilt: -2,
  },
  "vamana-umbrella": {
    name: "vamana-umbrella",
    label: "Vamana with Muthukuda",
    sheet: 1,
    row: 0,
    col: 1,
    tags: ["mascot", "onam", "umbrella"],
    defaultTilt: 3,
  },
  "git-nodes": {
    name: "git-nodes",
    label: "Git Graph Nodes",
    sheet: 1,
    row: 0,
    col: 2,
    tags: ["git", "foss", "network"],
    defaultTilt: 0,
  },
  "octocat-garland": {
    name: "octocat-garland",
    label: "Octocat with Poo-Garland",
    sheet: 1,
    row: 0,
    col: 3,
    tags: ["mascot", "github", "onam", "flowers"],
    defaultTilt: 2,
  },
  "docker-pookalam": {
    name: "docker-pookalam",
    label: "Docker Whale with Pookalam",
    sheet: 1,
    row: 1,
    col: 0,
    tags: ["docker", "pookalam", "foss"],
    defaultTilt: -1,
  },
  "terminal-star": {
    name: "terminal-star",
    label: "Terminal Window with Festival Star",
    sheet: 1,
    row: 1,
    col: 1,
    tags: ["terminal", "code", "star"],
    defaultTilt: 2,
  },
  "arch-crown": {
    name: "arch-crown",
    label: "Arch Linux Crowned with Flowers",
    sheet: 1,
    row: 1,
    col: 2,
    tags: ["arch", "linux", "crown", "flowers"],
    defaultTilt: 0,
  },
  nilavilakku: {
    name: "nilavilakku",
    label: "Nilavilakku Traditional Lamp",
    sheet: 1,
    row: 1,
    col: 3,
    tags: ["onam", "lamp", "tradition"],
    defaultTilt: 0,
  },
  "burst-heart": {
    name: "burst-heart",
    label: "Comic Starburst with Heart",
    sheet: 1,
    row: 2,
    col: 0,
    tags: ["comic", "burst", "heart"],
    defaultTilt: 4,
  },
  "floppy-onam": {
    name: "floppy-onam",
    label: "Floppy Disk with Festival Flame",
    sheet: 1,
    row: 2,
    col: 1,
    tags: ["retro", "floppy", "storage"],
    defaultTilt: -3,
  },
  footprints: {
    name: "footprints",
    label: "Maveli / GNOME Footsteps",
    sheet: 1,
    row: 2,
    col: 2,
    tags: ["footprints", "gnome", "maveli"],
    defaultTilt: 2,
  },
  "kite-memphis": {
    name: "kite-memphis",
    label: "Memphis Festival Kite",
    sheet: 1,
    row: 2,
    col: 3,
    tags: ["memphis", "kite", "onam"],
    defaultTilt: 5,
  },
  "git-branch": {
    name: "git-branch",
    label: "Git Branch Verified",
    sheet: 1,
    row: 3,
    col: 0,
    tags: ["git", "branch", "check"],
    defaultTilt: -2,
  },
  "papad-face": {
    name: "papad-face",
    label: "Cheeky Papad / Coin Face",
    sheet: 1,
    row: 3,
    col: 1,
    tags: ["face", "papad", "food", "mischief"],
    defaultTilt: 3,
  },
  "pookalam-flower": {
    name: "pookalam-flower",
    label: "Radial Floral Pookalam Ring",
    sheet: 1,
    row: 3,
    col: 2,
    tags: ["pookalam", "flower", "radial"],
    defaultTilt: 0,
  },

  // Sheet 2 (0..3, 0..3 excluding index 15)
  "tux-king": {
    name: "tux-king",
    label: "Tux King in Mundu & Crown",
    sheet: 2,
    row: 0,
    col: 0,
    tags: ["tux", "linux", "king", "mundu", "hero"],
    defaultTilt: -2,
  },
  "ferris-crab": {
    name: "ferris-crab",
    label: "Rust Ferris in Pookalam Lotus",
    sheet: 2,
    row: 0,
    col: 1,
    tags: ["rust", "ferris", "crab", "lotus"],
    defaultTilt: 1,
  },
  "gopher-king": {
    name: "gopher-king",
    label: "Go Gopher with Crown",
    sheet: 2,
    row: 0,
    col: 2,
    tags: ["golang", "gopher", "king"],
    defaultTilt: 2,
  },
  "linus-torvalds": {
    name: "linus-torvalds",
    label: "Linus Torvalds Portrait",
    sheet: 2,
    row: 0,
    col: 3,
    tags: ["linus", "creator", "portrait"],
    defaultTilt: -2,
  },
  "osi-logo": {
    name: "osi-logo",
    label: "Open Source Initiative Badge",
    sheet: 2,
    row: 1,
    col: 0,
    tags: ["osi", "foss", "badge"],
    defaultTilt: 3,
  },
  "gnu-garland": {
    name: "gnu-garland",
    label: "GNU Mascot with Floral Wreath",
    sheet: 2,
    row: 1,
    col: 1,
    tags: ["gnu", "foss", "flowers"],
    defaultTilt: -1,
  },
  "bird-mascot": {
    name: "bird-mascot",
    label: "Comic Linux Bird Mascot",
    sheet: 2,
    row: 1,
    col: 2,
    tags: ["bird", "comic", "character"],
    defaultTilt: 2,
  },
  "sadya-leaf": {
    name: "sadya-leaf",
    label: "Grand Onasadya on Banana Leaf",
    sheet: 2,
    row: 1,
    col: 3,
    tags: ["sadya", "food", "banana-leaf", "feast", "hero"],
    defaultTilt: -3,
  },
  "capsule-pill": {
    name: "capsule-pill",
    label: "Retro Comic Capsule",
    sheet: 2,
    row: 2,
    col: 0,
    tags: ["memphis", "capsule", "pop"],
    defaultTilt: -4,
  },
  "concentric-pookalam": {
    name: "concentric-pookalam",
    label: "Geometric Memphis Pookalam",
    sheet: 2,
    row: 2,
    col: 1,
    tags: ["pookalam", "memphis", "circles"],
    defaultTilt: 0,
  },
  muthukuda: {
    name: "muthukuda",
    label: "Muthukuda Royal Parasol",
    sheet: 2,
    row: 2,
    col: 2,
    tags: ["muthukuda", "umbrella", "onam"],
    defaultTilt: 2,
  },
  "coconut-palm": {
    name: "coconut-palm",
    label: "Thengu Coconut Palm",
    sheet: 2,
    row: 2,
    col: 3,
    tags: ["thengu", "palm", "tree", "kerala"],
    defaultTilt: -2,
  },
  "kite-pattern": {
    name: "kite-pattern",
    label: "Memphis Confetti Kite",
    sheet: 2,
    row: 3,
    col: 0,
    tags: ["kite", "memphis", "confetti"],
    defaultTilt: 4,
  },
  "burst-yellow": {
    name: "burst-yellow",
    label: "Comic Yellow Shout Burst",
    sheet: 2,
    row: 3,
    col: 1,
    tags: ["comic", "burst", "yellow"],
    defaultTilt: -3,
  },
  "python-snake": {
    name: "python-snake",
    label: "Python Snake in Floral Circle",
    sheet: 2,
    row: 3,
    col: 2,
    tags: ["python", "snake", "foss", "flowers"],
    defaultTilt: 0,
  },

  // Standalone
  "foss-mec-badge": {
    name: "foss-mec-badge",
    label: "FOSS MEC Circular Emblem",
    sheet: "standalone",
    row: 0,
    col: 0,
    tags: ["foss", "mec", "badge", "emblem", "hero"],
    defaultTilt: 0,
  },
};

export const ALL_SPRITE_NAMES = Object.keys(SPRITE_REGISTRY) as SpriteName[];

export const HERO_SPRITES: SpriteName[] = [
  "maveli-laptop",
  "tux-king",
  "sadya-leaf",
  "octocat-garland",
  "docker-pookalam",
  "arch-crown",
  "ferris-crab",
  "gopher-king",
  "foss-mec-badge",
];

export const AMBIENT_SPRITES: SpriteName[] = [
  "kite-memphis",
  "floppy-onam",
  "papad-face",
  "terminal-star",
  "nilavilakku",
  "muthukuda",
  "coconut-palm",
  "burst-heart",
  "git-branch",
  "python-snake",
  "concentric-pookalam",
  "pookalam-flower",
];
