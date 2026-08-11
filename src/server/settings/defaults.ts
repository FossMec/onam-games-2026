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
    key: "scoring.percentile_anchor",
    group: "scoring",
    description: "Percentile anchor used to normalise a day's times (p99 = 1.0)",
    defaultValue: 99,
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
