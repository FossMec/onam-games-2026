export const ORIENTATION_BATCHES = [
  "CS A",
  "CS B",
  "CS C",
  "CU",
  "EC A",
  "EC B",
  "EB",
  "EE",
  "EV",
  "ME",
] as const;

export type OrientationBatch = (typeof ORIENTATION_BATCHES)[number];

export const ORIENTATION_GAME_OPTIONS = [
  { gameType: "tinder", title: "FOSSwipe" },
  { gameType: "jigsaw", title: "Pookalam Jigsaw" },
  { gameType: "wend", title: "sudoWend" },
  { gameType: "unblock", title: "BoatLock" },
  { gameType: "jump", title: "Maveli Jump" },
] as const;
