import { query, revalidate } from "@solidjs/router";
import { getShellData } from "~/server/shell";
import { getGames, getGame, getMyAttempt } from "~/server/games/actions";
import { getPookalamState, getMyPookalamNotice, getFinalResults } from "~/server/pookalam/actions";
import { getDaily } from "~/server/leaderboard/actions";
import { getMe, getMyBanState } from "~/server/auth/actions";
import {
  getAdminDashboard,
  listActivity,
  listAttemptsAction,
  listBlockedIpsAction,
  listCollabMessagesAction,
  listSettings,
  listSuspicious,
  listTesters,
  listUsers,
} from "~/server/admin/actions";

/**
 * Every read the browser makes, in one place, wrapped in `query`.
 *
 * Without this a bare `createAsync(() => getGames())` is a fresh `POST
 * /_server` every time the component mounts: once per navigation, again on the
 * way back, and once more per component that happens to want the same thing.
 * A measured click path of nine navigations spent 284 KB re-fetching data it
 * had already been given.
 *
 * `query` gives three things that fix that:
 *
 *   dedupe        two components asking for the same key in one render share
 *                 a single request
 *   cache         navigating back to a page it already has costs nothing
 *   preload       routes can start the fetch on hover/intent rather than
 *                 after the route chunk has downloaded and mounted
 *
 * The keys are stable strings because `revalidate` takes them by name after a
 * mutation - see `revalidateAfter` at the bottom.
 */

/**
 * The shell: viewer, beta-gate verdict and ban banner.
 *
 * One key for all three because they come from one server round trip. Nav,
 * BetaGate and BanNotice all read this, and between them they used to make
 * three requests per navigation.
 */
export const shell = query(getShellData, "shell");

/**
 * The viewer on their own, for the few callers that want only the profile.
 *
 * Prefer `shell` in anything mounted on every route - that is the whole point
 * of it. This exists for the pages that genuinely need nothing else, so they
 * do not pull the gate verdict and ban state along for the ride.
 */
export const viewer = query(getMe, "viewer");

/** Ban / restriction state on its own, for callers outside the shell. */
export const banState = query(getMyBanState, "ban-state");

/** The seven-day schedule. Same for every viewer of a given role. */
export const gamesList = query(getGames, "games");

/** One game's card, by slug. */
export const gameBySlug = query(getGame, "game");

/** The viewer's own attempt at a game. */
export const myAttempt = query(getMyAttempt, "my-attempt");

/** Contest phases, the viewer's entry and their vote count. */
export const pookalamState = query(getPookalamState, "pookalam-state");

/**
 * The shortlist popup's row.
 *
 * Separate from `shell` on purpose: it is only ever asked for by a browser
 * that has not already dismissed the popup. See `ShortlistNotice`.
 */
export const pookalamNotice = query(getMyPookalamNotice, "pookalam-notice");

/** Final Code-a-Pookalam standings. */
export const pookalamResults = query(getFinalResults, "pookalam-results");

/** One day's leaderboard. */
export const dailyBoard = query(getDaily, "daily-board");

/**
 * The keys a mutation should drop.
 *
 * Collected here so a new action does not have to guess: signing in changes
 * the shell *and* everything gated on the viewer, finishing a game changes the
 * board and the attempt, and so on.
 */
export const QUERY_KEYS = {
  shell: shell.key,
  games: gamesList.key,
  game: gameBySlug.key,
  myAttempt: myAttempt.key,
  pookalamState: pookalamState.key,
  pookalamNotice: pookalamNotice.key,
  pookalamResults: pookalamResults.key,
  dailyBoard: dailyBoard.key,
} as const;

/*
 * Admin console reads.
 *
 * Wrapped in `query` so each tab's data is cached client-side: revisiting a
 * tab costs nothing, and a mutation drops only the keys it touches via
 * `revalidateAfter` below - instead of re-fetching the whole console (and
 * unmounting the tabbed layout) on every save.
 */
export const adminDashboard = query(getAdminDashboard, "admin-dashboard");
export const adminUsers = query(listUsers, "admin-users");
export const adminAttempts = query(listAttemptsAction, "admin-attempts");
export const adminSettings = query(listSettings, "admin-settings");
export const adminTesters = query(listTesters, "admin-testers");
export const adminSuspicious = query(listSuspicious, "admin-suspicious");
export const adminBlockedIps = query(listBlockedIpsAction, "admin-blocked-ips");
export const adminActivity = query(listActivity, "admin-activity");
export const adminCollabMessages = query(listCollabMessagesAction, "admin-collab-messages");

/**
 * The keys a console write should drop. `revalidate` matches by prefix, so
 * `"admin-users"` also clears `admin-users[1]`, `admin-users[2]`, ...
 */
export const ADMIN_QUERY_KEYS = {
  dashboard: "admin-dashboard",
  users: "admin-users",
  attempts: "admin-attempts",
  settings: "admin-settings",
  testers: "admin-testers",
  suspicious: "admin-suspicious",
  blockedIps: "admin-blocked-ips",
  activity: "admin-activity",
  collabMessages: "admin-collab-messages",
} as const;

/** Returns an `onReload` callback that revalidates exactly the given keys. */
export const revalidateAfter =
  (...keys: string[]) =>
  () =>
    revalidate(keys);
