import { getDb } from "~/server/db/client";
import { appSettings } from "~/server/db/schema";
import { setSetting } from "./service";

export interface SettingDef {
  key: string;
  group: string;
  description: string;
  defaultValue: unknown;
}

export const settingsRegistry: SettingDef[] = [
  {
    key: "schedule.release_time",
    group: "schedule",
    description: "Daily release time in IST (HH:MM)",
    defaultValue: "19:00",
  },
  {
    key: "schedule.event_start_date",
    group: "schedule",
    description: "Event start date in IST (YYYY-MM-DD); Day 1 releases on this date",
    defaultValue: "",
  },
  {
    key: "schedule.game_duration_hours",
    group: "schedule",
    description: "Hours a game stays live after its release",
    defaultValue: 24,
  },
  {
    key: "schedule.preview_hours",
    group: "schedule",
    /**
     * The window where a game is visible but not playable: title, artwork and
     * rules on the page with a countdown instead of a start button. Set to 0 to
     * keep every game a "???" right up to the second it opens.
     */
    description: "Hours before release that a game reveals its details (0 = no preview)",
    defaultValue: 24,
  },
  {
    key: "access.closed_beta",
    group: "access",
    /**
     * The whole site behind the tester list. A setting rather than a constant
     * so opening the doors on launch night is a toggle in /admin, not a deploy
     * - the one change guaranteed to be needed at the worst possible moment.
     */
    description: "Closed beta: only testers and admins can see the site",
    defaultValue: true,
  },
  {
    key: "access.tester_mode",
    group: "access",
    /**
     * When false (real player mode), testers and admins are subject to the same
     * one-attempt-per-day rules as regular players, allowing true validation.
     */
    description:
      "Tester mode: grant testers/admins unlimited retries (turn off for real-player test mode)",
    defaultValue: true,
  },
  {
    key: "access.tester_real_leaderboard",
    group: "access",
    description: "Hide tester and admin results from the player leaderboard",
    defaultValue: true,
  },
  {
    key: "enforce_one_user_per_device",
    group: "anti-cheat",
    description: "Block a second account on a device already bound to another account",
    defaultValue: true,
  },
  {
    key: "anti_cheat.min_plausible_ms",
    group: "anti-cheat",
    description: "Minimum plausible completion time (ms)",
    defaultValue: 3000,
  },
  {
    key: "ui.leaderboard_poll_ms",
    group: "ui",
    description: "Leaderboard polling interval (ms)",
    defaultValue: 120000,
  },
  {
    key: "ui.refresh_cooldown_ms",
    group: "ui",
    description: "Manual refresh cooldown (ms)",
    defaultValue: 10000,
  },
  {
    key: "social.whatsapp_group_link",
    group: "social",
    description: "WhatsApp group invite link",
    defaultValue: "",
  },
  {
    key: "hunt.final_token",
    group: "hunt",
    /**
     * Server-only. Never expose this through a public settings reader - it is
     * the single answer to the day-6 hunt for every player.
     */
    description: "Treasure hunt final-stage token (case/punctuation insensitive). Keep secret.",
    defaultValue: "",
  },
  {
    key: "hunt.token_query_param",
    group: "hunt",
    description:
      "Query parameter the final clue uses to hand over the token, e.g. /games/treasure-hunt?token=…",
    defaultValue: "token",
  },
  /*
   * Code-a-Pookalam runs on a clock. Each phase has a window (IST wall clock,
   * `YYYY-MM-DDTHH:MM`) and a boolean *force* override. With a window set, the
   * phase opens and closes on its own; the boolean forces it open regardless,
   * which is the rehearsal switch and the 11pm-something-broke switch. Neither
   * set means closed, so a half-configured deploy shows nothing.
   */
  {
    key: "pookalam.submissions_open_at",
    group: "pookalam",
    description: "IST datetime the entry form opens (YYYY-MM-DDTHH:MM). Blank = never on its own",
    defaultValue: "",
  },
  {
    key: "pookalam.submissions_close_at",
    group: "pookalam",
    description: "IST datetime entries close - the Day 6 deadline (YYYY-MM-DDTHH:MM)",
    defaultValue: "",
  },
  {
    key: "pookalam.submissions_open",
    group: "pookalam",
    description: "Force the entry form open right now, ignoring the dates above",
    defaultValue: false,
  },
  {
    key: "pookalam.voting_open_at",
    group: "pookalam",
    description: "IST datetime the Day 7 public Elo arena opens (YYYY-MM-DDTHH:MM)",
    defaultValue: "",
  },
  {
    key: "pookalam.voting_close_at",
    group: "pookalam",
    description: "IST datetime voting closes and the result is final (YYYY-MM-DDTHH:MM)",
    defaultValue: "",
  },
  {
    key: "pookalam.voting_open",
    group: "pookalam",
    description: "Force voting open right now, ignoring the dates above",
    defaultValue: false,
  },
  {
    key: "pookalam.results_at",
    group: "pookalam",
    description: "IST datetime the winner and the authors are revealed (YYYY-MM-DDTHH:MM)",
    defaultValue: "",
  },
  {
    key: "pookalam.results_public",
    group: "pookalam",
    description: "Force the ranked standings and author names public right now",
    defaultValue: false,
  },
  {
    key: "pookalam.shortlist_size",
    group: "pookalam",
    /**
     * Advisory: the admin shortlists by hand and the UI counts against this.
     * Nothing refuses a shortlist of eleven - it is a target, not a cap.
     */
    description: "How many entries to shortlist for the public Elo round (target, not a cap)",
    defaultValue: 10,
  },
  {
    key: "pookalam.voter_target_pct",
    group: "pookalam",
    /**
     * A percentage of the n·log₂n sorting budget, NOT of the total pair count.
     * See `voteTarget` - a percentage of every pair grows quadratically and
     * becomes unreachable exactly when the shortlist gets big.
     */
    description:
      "Votes needed to qualify for the voters' board, as a % of the n·log₂n comparison budget (10 entries ≈ 33 votes at 100%)",
    defaultValue: 60,
  },
  {
    key: "pookalam.leaderboard_delay_ms",
    group: "pookalam",
    description:
      "How stale the Day 7 boards are allowed to be. The lag is deliberate - a live board makes late voters follow the leader",
    defaultValue: 60000,
  },
  {
    key: "pookalam.aspect_tolerance_pct",
    group: "pookalam",
    description: "How far from a 1:1 square an uploaded pookalam may be, in percent",
    defaultValue: 5,
  },
  {
    key: "collab.open",
    group: "collab",
    description: "Collaborative pookalam: allow placing flowers",
    defaultValue: true,
  },
  {
    key: "collab.daily_flowers",
    group: "collab",
    /**
     * Counted in the browser, not here. Enforcing it server-side means storing
     * a row per placement, which is the whole design this feature avoids — and
     * the prize for defeating a localStorage counter is putting more flowers on
     * a communal drawing, which is the point of the exercise.
     *
     * It lives in settings anyway so the number can be raised on a quiet night
     * without a deploy.
     */
    description: "Flowers each person may place per day (enforced in the browser)",
    defaultValue: 30,
  },
];

/** Inserts any missing default settings so the app always has sane config. */
export async function ensureDefaultSettings(): Promise<void> {
  try {
    const existing = await getDb().select({ key: appSettings.key }).from(appSettings);
    const present = new Set(existing.map((row) => row.key));
    for (const def of settingsRegistry) {
      if (!present.has(def.key)) {
        await setSetting(def.key, def.defaultValue, {
          group: def.group,
          description: def.description,
        });
      }
    }
  } catch {
    // never fail request flow because of settings seeding
  }
}
