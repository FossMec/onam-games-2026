import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { CheckCircle, RefreshCw, ShieldAlert, X } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { AdminTabs, type AdminTabId } from "~/components/admin/AdminTabs";
import { PookalamReview } from "~/components/admin/PookalamReview";
import { AttemptsTab } from "~/components/admin/tabs/AttemptsTab";
import { GamesTab } from "~/components/admin/tabs/GamesTab";
import { LogsTab } from "~/components/admin/tabs/LogsTab";
import { OverviewTab } from "~/components/admin/tabs/OverviewTab";
import { SecurityTab } from "~/components/admin/tabs/SecurityTab";
import { SettingsTab } from "~/components/admin/tabs/SettingsTab";
import { UsersTab } from "~/components/admin/tabs/UsersTab";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { getAdminDashboard } from "~/server/admin/actions";
import { getMe } from "~/server/auth/actions";

export default function Admin() {
  const me = createAsync(() => getMe());
  const [activeTab, setActiveTab] = createSignal<AdminTabId>("overview");
  const [version, setVersion] = createSignal(0);
  const reload = () => setVersion((v) => v + 1);

  const data = createAsync(async () => {
    void version();
    if (me()?.role !== "admin") return null;
    return getAdminDashboard();
  });

  const [notification, setNotification] = createSignal<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  return (
    <main class="container space-y-5 py-6 max-w-6xl">
      <Title>Admin Control Center — FOSS Onam Games</Title>

      {/* Header Banner */}
      <div
        class="relative overflow-hidden rounded-lg p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{ border: "var(--ink-w-bold) solid var(--ink)", background: "var(--paper-2)" }}
      >
        <div class="flex items-center gap-3">
          <SpriteIcon name="tux-king" size={38} animate="float" interactive />
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight m-0">
                Admin Control Center
              </h1>
              <span class="badge text-[10px] py-0.5 px-2 bg-[var(--pop-yellow)] uppercase font-black">
                Superuser
              </span>
            </div>
            <p class="text-xs font-semibold mt-0.5" style={{ color: "var(--ink-soft)" }}>
              Festival game scheduling, user ban management, anti-cheat score review, and settings.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={reload}
          class="btn-ghost text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer font-extrabold"
        >
          <RefreshCw size={13} strokeWidth={2.5} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Notification Toast */}
      <Show when={notification()}>
        <div class="card p-3 bg-[var(--pop-yellow)] border-2 border-[var(--ink)] flex items-center justify-between text-xs font-extrabold shadow-sm animate-bounce-short">
          <div class="flex items-center gap-2">
            <CheckCircle size={16} strokeWidth={2.5} class="text-[var(--ink)]" />
            <span>{notification()}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            class="p-1 hover:opacity-75 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </Show>

      {/* Unauthorized State */}
      <Show when={me() && me()!.role !== "admin"}>
        <div class="card pop-red text-center p-12 space-y-3">
          <ShieldAlert size={48} class="mx-auto text-red-600" />
          <h2 class="text-xl font-black">Access Denied</h2>
          <p class="font-semibold text-sm max-w-md mx-auto">
            You do not have administrator permissions to view this control suite. If you believe
            this is a mistake, contact the FOSS MEC event team.
          </p>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={me()?.role === "admin" && !data()}>
        <div class="card card-plain p-12 text-center space-y-2">
          <RefreshCw size={24} class="animate-spin mx-auto text-[var(--ink-soft)]" />
          <p class="font-bold text-sm">Loading admin telemetry & databases...</p>
        </div>
      </Show>

      {/* Main Admin Tabbed Suite */}
      <Show when={me()?.role === "admin" && data()}>
        {(() => {
          const d = data()!;
          return (
            <div class="space-y-5">
              {/* Navigation Tabs */}
              <AdminTabs
                activeTab={activeTab()}
                onSelect={(t) => setActiveTab(t)}
                counts={{
                  games: d.games.length,
                  users: d.users.length,
                  attempts: d.attempts.length,
                  suspicious: d.suspicious.length,
                  testers: d.testers.filter((t) => t.active).length,
                }}
              />

              {/* 1. Overview Tab */}
              <Show when={activeTab() === "overview"}>
                <OverviewTab
                  metrics={d.metrics}
                  games={d.games}
                  onNavigateTab={(t) => setActiveTab(t)}
                />
              </Show>

              {/* 2. Games & Schedule Tab */}
              <Show when={activeTab() === "games"}>
                <GamesTab games={d.games} onReload={reload} onNotify={showNotification} />
              </Show>

              {/* 3. Users & Ban Tab */}
              <Show when={activeTab() === "users"}>
                <UsersTab users={d.users} onReload={reload} onNotify={showNotification} />
              </Show>

              {/* 4. Attempts & Anti-Cheat Tab */}
              <Show when={activeTab() === "attempts"}>
                <AttemptsTab attempts={d.attempts} onReload={reload} onNotify={showNotification} />
              </Show>

              {/* 5. Settings Tab */}
              <Show when={activeTab() === "settings"}>
                <SettingsTab settings={d.settings} onReload={reload} onNotify={showNotification} />
              </Show>

              {/* 6. Testers & Beta Access Tab */}
              <Show when={activeTab() === "testers"}>
                <SecurityTab
                  testers={d.testers}
                  blockedIps={d.blockedIps}
                  suspicious={d.suspicious}
                  onReload={reload}
                  onNotify={showNotification}
                />
              </Show>

              {/* 7. Security / Threat Stream Tab */}
              <Show when={activeTab() === "security"}>
                <SecurityTab
                  testers={d.testers}
                  blockedIps={d.blockedIps}
                  suspicious={d.suspicious}
                  onReload={reload}
                  onNotify={showNotification}
                />
              </Show>

              {/* 8. Code-a-Pookalam Review Tab */}
              <Show when={activeTab() === "pookalam"}>
                <PookalamReview />
              </Show>

              {/* 9. Activity Logs Tab */}
              <Show when={activeTab() === "logs"}>
                <LogsTab logs={d.activity} />
              </Show>
            </div>
          );
        })()}
      </Show>
    </main>
  );
}
