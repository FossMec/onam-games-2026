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
     * — the one change guaranteed to be needed at the worst possible moment.
     */
    description: "Closed beta: only testers and admins can see the site",
    defaultValue: true,
  },
  {
    key: "enforce_one_user_per_device",
    group: "anti-cheat",
    description: "Block a second account on a device already bound to another account",
    defaultValue: true,
  },
  {
    key: "anti_cheat.speed_p99_factor",
    group: "anti-cheat",
    description: "Submissions faster than p99 x factor (with moves) are suspicious",
    defaultValue: 0.1,
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
     * Server-only. Never expose this through a public settings reader — it is
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
  {
    key: "pookalam.submissions_open",
    group: "pookalam",
    description: "Code-a-Pookalam entry form accepts new and edited submissions",
    defaultValue: false,
  },
  {
    key: "pookalam.voting_open",
    group: "pookalam",
    description: "Day 7: head-to-head voting is live and votes move Elo ratings",
    defaultValue: false,
  },
  {
    key: "pookalam.results_public",
    group: "pookalam",
    description: "Reveal the ranked standings and the authors behind them",
    defaultValue: false,
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
