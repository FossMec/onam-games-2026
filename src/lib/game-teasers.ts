import { type SpriteName } from "~/lib/sprites";

/**
 * The locked-card teaser icon.
 *
 * The teaser *copy* ships with the schedule card (`card.teaser`), but a locked
 * card deliberately hides its slug, so the only handle left to pick an icon on
 * is the day. Unlocked cards carry their game type, so those are looked up first -
 * which keeps the icon attached to the game, not to whichever day it happens to
 * sit on this year.
 */
const TEASER_ICONS_BY_TYPE: Record<string, SpriteName> = {
  tinder: "tux-king",
  jigsaw: "sadya-leaf",
  wend: "octocat-garland",
  unblock: "docker-pookalam",
  jump: "ferris-crab",
  hunt: "gopher-king",
  vote: "pookalam-flower",
};

const TEASER_ICONS_BY_DAY: Record<number, SpriteName> = {
  1: "tux-king",
  2: "sadya-leaf",
  3: "octocat-garland",
  4: "docker-pookalam",
  5: "ferris-crab",
  6: "gopher-king",
  7: "pookalam-flower",
};

export function teaserIcon(game: { gameType: string; day: number }): SpriteName {
  return TEASER_ICONS_BY_TYPE[game.gameType] ?? TEASER_ICONS_BY_DAY[game.day] ?? "tux-king";
}
