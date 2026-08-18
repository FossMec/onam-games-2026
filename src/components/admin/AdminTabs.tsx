import {
  Activity,
  Flame,
  Gamepad2,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-solid";
import { For } from "solid-js";

export type AdminTabId =
  | "overview"
  | "games"
  | "users"
  | "attempts"
  | "settings"
  | "security"
  | "pookalam"
  | "logs";

export interface AdminTabItem {
  id: AdminTabId;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number | string;
}

interface AdminTabsProps {
  activeTab: AdminTabId;
  onSelect: (tab: AdminTabId) => void;
  counts?: {
    users?: number;
    games?: number;
    attempts?: number;
    suspicious?: number;
    testers?: number;
    pookalam?: number;
  };
}

export function AdminTabs(props: AdminTabsProps) {
  const tabs = (): AdminTabItem[] => [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "games", label: "Games & Schedule", icon: Gamepad2, badge: props.counts?.games },
    { id: "users", label: "Users & Bans", icon: Users, badge: props.counts?.users },
    { id: "attempts", label: "Game Attempts", icon: Flame, badge: props.counts?.attempts },
    { id: "settings", label: "App Settings", icon: Settings },
    {
      id: "security",
      label: "Threats & Blocked IPs",
      icon: ShieldAlert,
      badge: props.counts?.suspicious ? `${props.counts.suspicious} alerts` : undefined,
    },
    { id: "pookalam", label: "Pookalam Review", icon: ImageIcon, badge: props.counts?.pookalam },
    { id: "logs", label: "Activity Logs", icon: Activity },
  ];

  return (
    <nav class="flex items-center gap-2 overflow-x-auto pt-2 pb-2.5 px-1 border-b-2 border-[var(--ink)] scrollbar-none">
      <For each={tabs()}>
        {(t) => {
          const isActive = () => props.activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              type="button"
              onClick={() => props.onSelect(t.id)}
              class={`h-9 px-3.5 rounded-lg font-extrabold text-xs sm:text-sm whitespace-nowrap inline-flex items-center justify-center gap-2 transition-all cursor-pointer border-2 ${
                isActive()
                  ? "bg-[var(--pop-yellow)] text-[var(--ink)] border-[var(--ink)] shadow-xs"
                  : "bg-[var(--paper-2)] text-[var(--ink)] border-[var(--ink-soft)]/30 hover:border-[var(--ink)] hover:bg-[var(--paper-3)] opacity-85 hover:opacity-100"
              }`}
            >
              <Icon size={16} strokeWidth={2.5} class="shrink-0" />
              <span class="leading-none">{t.label}</span>
              {t.badge != null && (
                <span
                  class={`inline-flex items-center justify-center text-[10px] font-black min-w-[1.25rem] h-5 px-1.5 rounded-full border leading-none ${
                    isActive()
                      ? "bg-[var(--paper)] text-[var(--ink)] border-[var(--ink)]"
                      : "bg-[var(--paper-3)] text-[var(--ink-soft)] border-[var(--ink-soft)]/50"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        }}
      </For>
    </nav>
  );
}
