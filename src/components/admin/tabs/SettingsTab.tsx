import {
  Calendar,
  Lock,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
} from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { updateSetting } from "~/server/admin/actions";

export interface SettingRow {
  key: string;
  value: unknown;
  group: string;
  description: string | null;
}

interface SettingsTabProps {
  settings: SettingRow[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

interface SettingMetadata {
  label: string;
  type: "boolean" | "number" | "time" | "date" | "datetime" | "string" | "secret";
  explanation: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

const SETTINGS_META: Record<string, SettingMetadata> = {
  // Schedule
  "schedule.event_start_date": {
    label: "Event Start Date (IST)",
    type: "date",
    explanation:
      "The calendar date in IST when Day 1 officially launches. Daily games Day 2 through Day 7 unlock consecutively from this starting date.",
  },
  "schedule.release_time": {
    label: "Daily Release Time (IST)",
    type: "time",
    explanation:
      "The exact time of day (HH:MM in IST) when each day's new game goes live to public players (e.g. 19:00 for 7:00 PM IST).",
  },
  "schedule.game_duration_hours": {
    label: "Game Live Window Duration",
    type: "number",
    unit: "hours",
    min: 1,
    max: 168,
    explanation:
      "Number of hours each daily game stays open for scoring submissions before closing (default: 24 hours).",
  },

  // Access & Beta
  "access.closed_beta": {
    label: "Closed Beta Gate",
    type: "boolean",
    explanation:
      "When enabled, the entire website is locked behind the tester list so only verified testers and admins can browse or play. Toggle off on launch night to open the site to the public.",
  },
  "access.tester_mode": {
    label: "Tester Mode (Unlimited Retries)",
    type: "boolean",
    explanation:
      "When enabled, testers and admins get unlimited attempts on all games. When switched OFF, testers play under real player rules with a strict 1-run limit per game to test real-world behavior during beta.",
  },

  // Anti-Cheat
  enforce_one_user_per_device: {
    label: "Enforce One Account Per Device",
    type: "boolean",
    explanation:
      "Blocks secondary accounts on a physical browser/device already associated with another participant, preventing multi-account farming.",
  },
  "anti_cheat.min_plausible_ms": {
    label: "Minimum Plausible Completion Time",
    type: "number",
    unit: "ms",
    min: 500,
    step: 500,
    explanation:
      "Absolute minimum plausible duration in milliseconds for human gameplay. Submissions faster than this threshold trigger anti-cheat flags.",
  },

  // UI & Live Polling
  "ui.leaderboard_poll_ms": {
    label: "Leaderboard Auto-Poll Frequency",
    type: "number",
    unit: "ms",
    min: 10000,
    step: 5000,
    explanation:
      "Background polling interval in milliseconds for live leaderboard updates on open tabs (e.g. 120,000ms = 2 minutes).",
  },
  "ui.refresh_cooldown_ms": {
    label: "Manual Refresh Cooldown",
    type: "number",
    unit: "ms",
    min: 1000,
    step: 1000,
    explanation:
      "Rate-limit cooldown in milliseconds between manual clicks on the 'Refresh' button to protect server bandwidth.",
  },

  // Social
  "social.whatsapp_group_link": {
    label: "WhatsApp Community Group Invite Link",
    type: "string",
    placeholder: "https://chat.whatsapp.com/...",
    explanation:
      "Direct invite link to the official FOSS Onam WhatsApp community group, displayed in notifications and footers.",
  },

  // Day-6 Hunt
  "hunt.final_token": {
    label: "Treasure Hunt Secret Final Token",
    type: "secret",
    placeholder: "Secret token (case-insensitive)",
    explanation:
      "Server-only secret phrase for the Day-6 Treasure Hunt endgame. Never exposed to the client; verified strictly on the server.",
  },
  "hunt.token_query_param": {
    label: "Treasure Hunt URL Query Param",
    type: "string",
    placeholder: "token",
    explanation:
      "URL query parameter name that the final clue uses to submit the secret token (e.g. /games/treasure-hunt?token=...).",
  },

  // Day-7 Pookalam - each phase has a window plus a manual force override.
  "pookalam.submissions_open_at": {
    label: "Entry Form Opens (IST)",
    type: "datetime",
    explanation:
      "When the Code-a-Pookalam submit button appears. Before this the page shows a countdown and no form at all. Leave blank to rely purely on the force toggle.",
  },
  "pookalam.submissions_close_at": {
    label: "Entry Deadline (IST)",
    type: "datetime",
    explanation:
      "The Day 6 cut-off. Entries and edits stop accepting at this instant. Shown as a live countdown on the submission page.",
  },
  "pookalam.submissions_open": {
    label: "Force Entry Form Open",
    type: "boolean",
    explanation:
      "Override: opens the entry form right now regardless of the dates above, including after the deadline has passed. For rehearsals and for late-night exceptions.",
  },
  "pookalam.voting_open_at": {
    label: "Elo Arena Opens (IST)",
    type: "datetime",
    explanation:
      "When Day 7 head-to-head voting starts. Only shortlisted entries are paired, so shortlist before this instant.",
  },
  "pookalam.voting_close_at": {
    label: "Voting Closes (IST)",
    type: "datetime",
    explanation:
      "When voting stops and the Elo ratings become final. Ratings stop moving; the boards stay readable.",
  },
  "pookalam.voting_open": {
    label: "Force Voting Open",
    type: "boolean",
    explanation: "Override: opens the pairwise arena right now regardless of the dates above.",
  },
  "pookalam.results_at": {
    label: "Results Reveal (IST)",
    type: "datetime",
    explanation:
      "When the winner, the author names and the repository links go public. Admins can always see the standings before this.",
  },
  "pookalam.results_public": {
    label: "Force Results Public",
    type: "boolean",
    explanation:
      "Override: publishes the final ranked standings and reveals author names right now.",
  },
  "pookalam.shortlist_size": {
    label: "Shortlist Size",
    type: "number",
    unit: "entries",
    min: 1,
    max: 64,
    explanation:
      "How many entries the 'shortlist top N' button picks, and the target the review tab counts against. Keeping this around 10 keeps a full voting shift to roughly 20 taps.",
  },
  "pookalam.voter_target_pct": {
    label: "Voter Qualifying Target",
    type: "number",
    unit: "%",
    min: 0,
    max: 200,
    explanation:
      "Votes needed to qualify for the voters' leaderboard, as a percentage of the n·log₂n comparison budget - NOT of every possible pair. At 100%, ten shortlisted entries means about 33 votes and twenty means about 87. Voters can always keep going past the target.",
  },
  "pookalam.leaderboard_delay_ms": {
    label: "Leaderboard Lag",
    type: "number",
    unit: "ms",
    min: 0,
    max: 3600000,
    explanation:
      "How stale the two Day 7 boards are allowed to get before recomputing. The lag is deliberate: a board that updates the instant someone votes tells late voters who to back. 60000 (one minute) is a good default; 0 makes it live and biased.",
  },
  "pookalam.aspect_tolerance_pct": {
    label: "Square Tolerance",
    type: "number",
    unit: "%",
    min: 0,
    max: 50,
    explanation:
      "How far from a perfect 1:1 square an uploaded render may be. Checked in the browser before upload and again on the server. 5% allows a few stray pixels while still refusing a screenshot.",
  },

  // Collab Pookalam controls
  "collab.open": {
    label: "Collab Pookalam Open",
    type: "boolean",
    explanation:
      "Master switch: when off, no one can place flowers and strokes are rejected server-side. Toggle this first if you need an emergency lock.",
  },
  "collab.daily_flowers": {
    label: "Daily Flower Allowance",
    type: "number",
    unit: "flowers/day",
    min: 1,
    max: 500,
    explanation:
      "How many flowers each visitor may place per day (tracked in the browser). Raise this on a quiet night to encourage participation.",
  },
  "collab.disable_drawing": {
    label: "Disable Collab Drawing (Read-Only)",
    type: "boolean",
    explanation:
      "Locks the community canvas to view-only and shows a post-event celebration banner. The finished pookalam stays visible — visitors just can't place new flowers.",
  },
  "collab.disable_balloons": {
    label: "Disable Pookalam Balloons",
    type: "boolean",
    explanation:
      "Stops the floating balloon popups from spawning across the site. Credits already earned are kept; existing token buckets are unaffected.",
  },
  "collab.disable_comments": {
    label: "Disable Community Wishes",
    type: "boolean",
    explanation:
      "Hides all community Onam wish bubbles and the wish composer box. Existing wishes are preserved in the database and can still be managed from the admin panel.",
  },
};

const GROUP_LABELS: Record<string, { label: string; icon: typeof Settings }> = {
  schedule: { label: "Schedule & Timing", icon: Calendar },
  access: { label: "Access & Beta Gate", icon: Lock },
  "anti-cheat": { label: "Anti-Cheat & Rate Limits", icon: ShieldAlert },
  ui: { label: "UI & Live Polling", icon: RefreshCw },
  social: { label: "Social & Links", icon: MessageCircle },
  hunt: { label: "Day-6 Treasure Hunt", icon: Sparkles },
  pookalam: { label: "Day-7 Code-a-Pookalam", icon: Sparkles },
  collab: { label: "Collab Community Pookalam", icon: Sparkles },
};

export function SettingsTab(props: SettingsTabProps) {
  const [search, setSearch] = createSignal("");
  const [selectedGroup, setSelectedGroup] = createSignal<string>("all");
  const [pendingValues, setPendingValues] = createSignal<Record<string, unknown>>({});
  const [savingKey, setSavingKey] = createSignal<string | null>(null);

  const getEffectiveValue = (key: string, originalValue: unknown) => {
    if (key in pendingValues()) return pendingValues()[key];
    return originalValue;
  };

  const handleValueChange = (key: string, newVal: unknown) => {
    setPendingValues((prev) => ({ ...prev, [key]: newVal }));
  };

  const handleSaveSetting = async (setting: SettingRow) => {
    const key = setting.key;
    const value = getEffectiveValue(key, setting.value);
    setSavingKey(key);
    try {
      await updateSetting(key, value, setting.group, setting.description ?? undefined);
      props.onNotify(`Saved setting "${key}"`);
      // Clear pending state for this key
      setPendingValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setSavingKey(null);
    }
  };

  const groups = createMemo(() => {
    const list = Array.from(new Set(props.settings.map((s) => s.group)));
    return list;
  });

  const filteredSettings = createMemo(() => {
    const q = search().toLowerCase().trim();
    const grp = selectedGroup();

    return props.settings.filter((s) => {
      if (grp !== "all" && s.group !== grp) return false;
      if (q) {
        const meta = SETTINGS_META[s.key];
        const matchKey = s.key.toLowerCase().includes(q);
        const matchLabel = (meta?.label ?? "").toLowerCase().includes(q);
        const matchDesc = (s.description ?? meta?.explanation ?? "").toLowerCase().includes(q);
        if (!matchKey && !matchLabel && !matchDesc) return false;
      }
      return true;
    });
  });

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Application Configuration & Settings</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Tune timing rules, launch toggles, anti-cheat limits, and contest parameters with
            strongly typed controls.
          </p>
        </div>

        <div class="font-mono text-xs font-black px-2.5 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
          {filteredSettings().length} Settings
        </div>
      </div>

      {/* Filter Bar */}
      <div class="card card-plain p-3 bg-[var(--paper-2)] flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div class="relative w-full sm:w-72">
          <Search
            size={15}
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            type="text"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            placeholder="Filter setting key or description..."
            class="input w-full pl-8 text-xs font-semibold"
          />
        </div>

        {/* Group Selector */}
        <div class="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedGroup("all")}
            class={`px-2.5 py-1 rounded text-xs font-extrabold cursor-pointer border ${
              selectedGroup() === "all"
                ? "bg-[var(--pop-yellow)] border-[var(--ink)]"
                : "bg-[var(--paper)] border-[var(--ink-soft)]/40 hover:border-[var(--ink)]"
            }`}
          >
            All Categories
          </button>
          <For each={groups()}>
            {(grp) => {
              const info = GROUP_LABELS[grp] ?? { label: grp };
              return (
                <button
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  class={`px-2.5 py-1 rounded text-xs font-extrabold whitespace-nowrap cursor-pointer border ${
                    selectedGroup() === grp
                      ? "bg-[var(--pop-yellow)] border-[var(--ink)]"
                      : "bg-[var(--paper)] border-[var(--ink-soft)]/40 hover:border-[var(--ink)]"
                  }`}
                >
                  {info.label}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Settings Grid / Cards */}
      <div class="grid md:grid-cols-2 gap-3.5">
        <For each={filteredSettings()}>
          {(setting) => {
            const meta = SETTINGS_META[setting.key] ?? {
              label: setting.key,
              type: typeof setting.value === "boolean" ? "boolean" : "string",
              explanation: setting.description ?? "Application configuration parameter.",
            };

            const currentValue = () => getEffectiveValue(setting.key, setting.value);
            const isDirty = () =>
              setting.key in pendingValues() &&
              JSON.stringify(pendingValues()[setting.key]) !== JSON.stringify(setting.value);
            const isSaving = () => savingKey() === setting.key;

            return (
              <div class="card card-plain p-4 bg-[var(--paper)] border-2 border-[var(--ink)] flex flex-col justify-between space-y-3">
                <div class="space-y-1.5">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <span class="font-black text-sm text-[var(--ink)] block">{meta.label}</span>
                      <span class="font-mono text-[11px] text-[var(--ink-soft)] font-semibold">
                        {setting.key}
                      </span>
                    </div>
                    <span class="font-mono text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-[var(--paper-2)] border border-[var(--ink-soft)]/40">
                      {setting.group}
                    </span>
                  </div>

                  <p class="text-xs text-[var(--ink)] leading-relaxed opacity-85 font-medium">
                    {meta.explanation}
                  </p>
                </div>

                {/* Interactive Typed Control Area */}
                <div class="pt-2 border-t border-[var(--ink-soft)]/20 flex items-center justify-between gap-3">
                  <div class="flex-1">
                    {/* 1. Boolean Toggle */}
                    <Show when={meta.type === "boolean"}>
                      <label class="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(currentValue())}
                          onChange={(e) => handleValueChange(setting.key, e.currentTarget.checked)}
                          class="sr-only peer"
                        />
                        <div class="w-10 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 relative"></div>
                        <span class="text-xs font-black font-mono">
                          {currentValue() ? "ENABLED" : "DISABLED"}
                        </span>
                      </label>
                    </Show>

                    {/* 2. Number input */}
                    <Show when={meta.type === "number"}>
                      <div class="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={Number(currentValue())}
                          min={meta.min}
                          max={meta.max}
                          step={meta.step ?? 1}
                          onInput={(e) =>
                            handleValueChange(setting.key, Number(e.currentTarget.value))
                          }
                          class="input w-36 font-mono text-xs font-bold"
                        />
                        <Show when={meta.unit}>
                          <span class="text-xs font-bold opacity-75">{meta.unit}</span>
                        </Show>
                      </div>
                    </Show>

                    {/* 3. Time input */}
                    <Show when={meta.type === "time"}>
                      <input
                        type="time"
                        value={
                          typeof currentValue() === "string" ? (currentValue() as string) : "19:00"
                        }
                        onInput={(e) => handleValueChange(setting.key, e.currentTarget.value)}
                        class="input w-36 font-mono text-xs font-bold"
                      />
                    </Show>

                    {/* 4. Date input */}
                    <Show when={meta.type === "date"}>
                      <input
                        type="date"
                        value={typeof currentValue() === "string" ? (currentValue() as string) : ""}
                        onInput={(e) => handleValueChange(setting.key, e.currentTarget.value)}
                        class="input w-44 font-mono text-xs font-bold"
                      />
                    </Show>

                    {/*
                      5. Datetime input - always IST.

                      `datetime-local` produces exactly the `YYYY-MM-DDTHH:MM`
                      the server parses, and it has no timezone of its own, so
                      what is typed is what is stored. That is the point: the
                      value means IST regardless of where the admin is sitting.
                    */}
                    <Show when={meta.type === "datetime"}>
                      <input
                        type="datetime-local"
                        value={typeof currentValue() === "string" ? (currentValue() as string) : ""}
                        onInput={(e) => handleValueChange(setting.key, e.currentTarget.value)}
                        class="input w-60 font-mono text-xs font-bold"
                      />
                    </Show>

                    {/* 6. Secret / Text input */}
                    <Show when={meta.type === "string" || meta.type === "secret"}>
                      <input
                        type={meta.type === "secret" ? "password" : "text"}
                        value={
                          typeof currentValue() === "string"
                            ? (currentValue() as string)
                            : typeof currentValue() === "number" ||
                                typeof currentValue() === "boolean"
                              ? String(currentValue())
                              : ""
                        }
                        onInput={(e) => handleValueChange(setting.key, e.currentTarget.value)}
                        placeholder={meta.placeholder ?? "Value..."}
                        class="input w-full text-xs font-mono"
                      />
                    </Show>
                  </div>

                  {/* Save button for changed setting */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleSaveSetting(setting)}
                      disabled={isSaving() || !isDirty()}
                      class={`px-3 py-1.5 rounded text-xs font-extrabold inline-flex items-center gap-1 border transition-all ${
                        isDirty()
                          ? "bg-[var(--pop-yellow)] border-[var(--ink)] hover:bg-[var(--pop-teal)] cursor-pointer shadow-xs font-black animate-pulse"
                          : "bg-[var(--paper-2)] border-[var(--ink-soft)]/30 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <Save size={13} />
                      <span>{isSaving() ? "Saving..." : isDirty() ? "Save" : "Saved"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
