import {
  AlertTriangle,
  Flame,
  Gamepad2,
  Image as ImageIcon,
  Lock,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-solid";
import { For } from "solid-js";
import type { AdminTabId } from "../AdminTabs";

interface OverviewProps {
  metrics: {
    totalUsers: number;
    activeTesters: number;
    totalGames: number;
    suspiciousEvents: number;
    totalAttempts: number;
    pookalamSubmissions: number;
  };
  games: {
    id: string;
    slug: string;
    day: number;
    title: string;
    status: string;
    published: boolean;
  }[];
  onNavigateTab: (tab: AdminTabId) => void;
}

export function OverviewTab(props: OverviewProps) {
  const cards = () => [
    {
      title: "Total Players",
      value: props.metrics.totalUsers,
      tab: "users" as AdminTabId,
      icon: Users,
      pop: "var(--pop-yellow)",
      note: "Registered users",
    },
    {
      title: "Active Testers",
      value: props.metrics.activeTesters,
      tab: "testers" as AdminTabId,
      icon: Lock,
      pop: "var(--pop-teal)",
      note: "Early-access allowed",
    },
    {
      title: "Daily Games",
      value: props.metrics.totalGames,
      tab: "games" as AdminTabId,
      icon: Gamepad2,
      pop: "var(--pop-pink)",
      note: "7 festival days",
    },
    {
      title: "Game Runs",
      value: props.metrics.totalAttempts,
      tab: "attempts" as AdminTabId,
      icon: Flame,
      pop: "var(--pop-purple)",
      note: "Player completions",
    },
    {
      title: "Threat Alerts",
      value: props.metrics.suspiciousEvents,
      tab: "security" as AdminTabId,
      icon: AlertTriangle,
      pop: "var(--pop-red)",
      note: "Anomalies & speed flags",
    },
    {
      title: "Pookalam Entries",
      value: props.metrics.pookalamSubmissions,
      tab: "pookalam" as AdminTabId,
      icon: ImageIcon,
      pop: "var(--pop-yellow)",
      note: "Code-a-Pookalam contest",
    },
  ];

  return (
    <div class="space-y-6">
      {/* KPI Cards Grid */}
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <For each={cards()}>
          {(c) => {
            const Icon = c.icon;
            return (
              <button
                type="button"
                onClick={() => props.onNavigateTab(c.tab)}
                class="card card-plain p-3.5 flex flex-col justify-between text-left transition-transform hover:-translate-y-0.5 cursor-pointer"
                style={{ background: c.pop }}
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black uppercase text-[var(--ink)]">{c.title}</span>
                  <Icon size={16} strokeWidth={2.5} class="opacity-70 text-[var(--ink)]" />
                </div>
                <div class="my-2">
                  <span class="font-mono font-black text-2xl sm:text-3xl text-[var(--ink)]">
                    {c.value.toLocaleString("en-IN")}
                  </span>
                </div>
                <span class="text-[11px] font-semibold opacity-80 truncate text-[var(--ink)]">
                  {c.note} →
                </span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Quick Launch & Status Strip */}
      <div class="grid md:grid-cols-2 gap-4">
        {/* Games Status Summary */}
        <div class="card space-y-3 bg-[var(--paper-2)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Gamepad2 size={18} strokeWidth={2.5} />
              <h3 class="font-black text-base">Festival Schedule Status</h3>
            </div>
            <button
              type="button"
              onClick={() => props.onNavigateTab("games")}
              class="btn-ghost text-xs px-2.5 py-1"
            >
              Manage Schedule →
            </button>
          </div>

          <div class="divide-y divide-[var(--ink-soft)]/20 border-2 border-[var(--ink)] rounded-md overflow-hidden bg-[var(--paper)]">
            <For each={props.games.slice(0, 7)}>
              {(g) => (
                <div class="px-3 py-2 flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="font-mono font-black px-1.5 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink)] text-[10px]">
                      Day {g.day}
                    </span>
                    <span class="font-extrabold truncate">{g.title}</span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      class={`badge text-[10px] py-0.2 px-1.5 uppercase font-bold ${
                        g.status === "live"
                          ? "bg-[var(--pop-yellow)]"
                          : g.status === "tester"
                            ? "bg-[var(--pop-teal)]"
                            : g.status === "closed"
                              ? "bg-[var(--paper-3)]"
                              : "bg-[var(--pop-pink)]"
                      }`}
                    >
                      {g.status}
                    </span>
                    <span class="text-[10px] font-mono opacity-70">
                      {g.published ? "published" : "draft"}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Quick Admin Actions & Direct Shortcuts */}
        <div class="card space-y-3 bg-[var(--paper-2)]">
          <div class="flex items-center gap-2">
            <Settings size={18} strokeWidth={2.5} />
            <h3 class="font-black text-base">Quick Administration Shortcuts</h3>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => props.onNavigateTab("users")}
              class="p-3 rounded-md border-2 border-[var(--ink)] bg-[var(--paper)] text-left hover:bg-[var(--pop-yellow)] transition-all font-bold cursor-pointer"
            >
              <Users size={16} class="mb-1 text-[var(--ink)]" />
              <div class="font-black">Ban / Role Management</div>
              <p class="text-[11px] opacity-75 mt-0.5">Search and moderate players</p>
            </button>

            <button
              type="button"
              onClick={() => props.onNavigateTab("attempts")}
              class="p-3 rounded-md border-2 border-[var(--ink)] bg-[var(--paper)] text-left hover:bg-[var(--pop-pink)] transition-all font-bold cursor-pointer"
            >
              <Flame size={16} class="mb-1 text-[var(--ink)]" />
              <div class="font-black">Anti-Cheat Review</div>
              <p class="text-[11px] opacity-75 mt-0.5">Inspect & void cheated scores</p>
            </button>

            <button
              type="button"
              onClick={() => props.onNavigateTab("settings")}
              class="p-3 rounded-md border-2 border-[var(--ink)] bg-[var(--paper)] text-left hover:bg-[var(--pop-teal)] transition-all font-bold cursor-pointer"
            >
              <Settings size={16} class="mb-1 text-[var(--ink)]" />
              <div class="font-black">Event Config</div>
              <p class="text-[11px] opacity-75 mt-0.5">Start dates, durations & toggles</p>
            </button>

            <button
              type="button"
              onClick={() => props.onNavigateTab("security")}
              class="p-3 rounded-md border-2 border-[var(--ink)] bg-[var(--paper)] text-left hover:bg-[var(--pop-red)] transition-all font-bold cursor-pointer"
            >
              <ShieldAlert size={16} class="mb-1 text-[var(--ink)]" />
              <div class="font-black">IP Blocklist</div>
              <p class="text-[11px] opacity-75 mt-0.5">Block abusive IPs and bots</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
