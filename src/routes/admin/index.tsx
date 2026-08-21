import { Title } from "@solidjs/meta";
import { createAsync, revalidate } from "@solidjs/router";
import { CheckCircle, RefreshCw, ShieldAlert, X } from "lucide-solid";
import { Show, Suspense, createSignal } from "solid-js";
import { AdminTabs, type AdminTabId } from "~/components/admin/AdminTabs";
import { PookalamGallery } from "~/components/admin/PookalamGallery";
import { PookalamReview } from "~/components/admin/PookalamReview";
import { PookalamAnimationExport } from "~/components/admin/PookalamAnimationExport";
import { AttemptsTab } from "~/components/admin/tabs/AttemptsTab";
import { CollabWishesTab } from "~/components/admin/tabs/CollabWishesTab";
import { GamesTab } from "~/components/admin/tabs/GamesTab";
import { LogsTab } from "~/components/admin/tabs/LogsTab";
import { OverviewTab } from "~/components/admin/tabs/OverviewTab";
import { SecurityTab } from "~/components/admin/tabs/SecurityTab";
import { SettingsTab } from "~/components/admin/tabs/SettingsTab";
import { UsersTab } from "~/components/admin/tabs/UsersTab";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import {
  ADMIN_QUERY_KEYS,
  adminActivity,
  adminAttempts,
  adminBlockedIps,
  adminCollabMessages,
  adminDashboard,
  adminSettings,
  adminSuspicious,
  adminTesters,
  adminUsers,
  revalidateAfter,
  shell,
} from "~/lib/queries";

export default function Admin() {
  const shellData = createAsync(() => shell());
  const me = () => shellData()?.me ?? undefined;
  const [activeTab, setActiveTab] = createSignal<AdminTabId>("overview");
  const [page, setPage] = createSignal(0);

  // Per-tab data is a cached query behind a suspending resource. The tab body
  // has its own <Suspense> (below) so a cache miss on a tab switch shows a
  // localized loader here instead of tripping the route-level one into a
  // full-screen reload.
  const users = createAsync(() =>
    activeTab() === "users" ? adminUsers(page()) : Promise.resolve(null),
  );
  const attempts = createAsync(() =>
    activeTab() === "attempts" ? adminAttempts(page()) : Promise.resolve(null),
  );
  const settings = createAsync(() =>
    activeTab() === "settings" ? adminSettings() : Promise.resolve(null),
  );
  const security = createAsync(async () => {
    if (activeTab() !== "security") return null;
    const [suspicious, blockedIps, betaTesters] = await Promise.all([
      adminSuspicious(page()),
      adminBlockedIps(page()),
      adminTesters(page()),
    ]);
    return { suspicious, blockedIps, testers: betaTesters };
  });
  const activity = createAsync(() =>
    activeTab() === "logs" ? adminActivity(page()) : Promise.resolve(null),
  );
  const collabMessages = createAsync(() =>
    activeTab() === "pookalam" ? adminCollabMessages(page()) : Promise.resolve(null),
  );

  const data = createAsync(async () => {
    if (me()?.role !== "admin") return null;
    return adminDashboard();
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
      <Title>Admin Control Center - Onam Games</Title>

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

        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => revalidate()}
            class="btn-ghost text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5 cursor-pointer font-extrabold"
          >
            <RefreshCw size={13} strokeWidth={2.5} />
            <span>Refresh Data</span>
          </button>
        </div>
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

      {/*
        Testers get the shortlisting gallery and nothing else.

        They are the people who actually do the day-6 pass over every entry, so
        bouncing them off this page entirely would mean building a second page
        somewhere public for one privileged job. They see no metrics, no users,
        no logs - and no author names, which is the whole point of the gallery.
      */}
      <Show when={me()?.role === "tester"}>
        <div class="space-y-4">
          <div class="card card-plain p-3 text-xs font-bold" style={{ color: "var(--ink-soft)" }}>
            Tester access - Code-a-Pookalam shortlisting only.
          </div>
          <PookalamGallery />
        </div>
      </Show>

      {/* Unauthorized State */}
      <Show when={me() && me()!.role !== "admin" && me()!.role !== "tester"}>
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
            <div class="space-y-5 min-h-[45vh]">
              {/* Navigation Tabs */}
              <AdminTabs
                activeTab={activeTab()}
                onSelect={(t) => {
                  setPage(0);
                  setActiveTab(t);
                }}
                counts={{
                  games: d.games.length,
                  users: d.metrics.totalUsers,
                  attempts: d.metrics.totalAttempts,
                  suspicious: d.metrics.suspiciousEvents,
                  testers: d.metrics.activeTesters,
                }}
              />

              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="btn-ghost text-xs"
                  disabled={page() === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Previous page
                </button>
                <span class="text-xs font-bold">Page {page() + 1}</span>
                <button
                  type="button"
                  class="btn-ghost text-xs"
                  disabled={
                    activeTab() === "overview" ||
                    activeTab() === "games" ||
                    activeTab() === "settings" ||
                    activeTab() === "pookalam"
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next page
                </button>
              </div>

              {/* Tab body has its own Suspense so a cache-miss refetch on a tab
                  switch shows a localized loader instead of the route-level
                  full-screen one. */}
              <Suspense fallback={<TabLoading />}>
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
                  <GamesTab
                    games={d.games}
                    onReload={revalidateAfter(ADMIN_QUERY_KEYS.dashboard)}
                    onNotify={showNotification}
                  />
                </Show>

                {/* 3. Users & Ban Tab */}
                <Show when={activeTab() === "users"}>
                  <Show when={users()} fallback={<TabLoading />}>
                    <UsersTab
                      users={users()!}
                      games={d.games}
                      onReload={revalidateAfter(ADMIN_QUERY_KEYS.users)}
                      onNotify={showNotification}
                    />
                  </Show>
                </Show>

                {/* 4. Attempts & Anti-Cheat Tab */}
                <Show when={activeTab() === "attempts"}>
                  <Show when={attempts()} fallback={<TabLoading />}>
                    <AttemptsTab
                      attempts={attempts()!}
                      onReload={revalidateAfter(
                        ADMIN_QUERY_KEYS.attempts,
                        ADMIN_QUERY_KEYS.dashboard,
                      )}
                      onNotify={showNotification}
                    />
                  </Show>
                </Show>

                {/* 5. Settings Tab */}
                <Show when={activeTab() === "settings"}>
                  <Show when={settings()} fallback={<TabLoading />}>
                    <SettingsTab
                      settings={settings()!}
                      onReload={revalidateAfter(ADMIN_QUERY_KEYS.settings)}
                      onNotify={showNotification}
                    />
                  </Show>
                </Show>

                {/* 6. Security / Threat Stream Tab */}
                <Show when={activeTab() === "security"}>
                  <Show when={security()} fallback={<TabLoading />}>
                    <SecurityTab
                      mode="security"
                      testers={security()!.testers}
                      blockedIps={security()!.blockedIps}
                      suspicious={security()!.suspicious}
                      onReload={revalidateAfter(
                        ADMIN_QUERY_KEYS.testers,
                        ADMIN_QUERY_KEYS.blockedIps,
                        ADMIN_QUERY_KEYS.suspicious,
                        ADMIN_QUERY_KEYS.dashboard,
                      )}
                      onNotify={showNotification}
                    />
                  </Show>
                </Show>

                {/* 8. Code-a-Pookalam Review & Collab Management Tab */}
                <Show when={activeTab() === "pookalam"}>
                  {(() => {
                    const [pookalamSub, setPookalamSub] = createSignal<
                      "review" | "gallery" | "wishes" | "animation"
                    >("review");
                    return (
                      <div class="space-y-5">
                        <div class="inline-flex rounded-md border-2 border-[var(--ink)] p-0.5 bg-[var(--paper)] flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setPookalamSub("review")}
                            class={`px-3 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                              pookalamSub() === "review"
                                ? "bg-[var(--pop-yellow)] text-[var(--ink)]"
                                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                            }`}
                          >
                            Review queue
                          </button>
                          <button
                            type="button"
                            onClick={() => setPookalamSub("gallery")}
                            class={`px-3 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                              pookalamSub() === "gallery"
                                ? "bg-[var(--pop-teal)] text-[var(--ink)]"
                                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                            }`}
                          >
                            Shortlisting gallery
                          </button>
                          <button
                            type="button"
                            onClick={() => setPookalamSub("wishes")}
                            class={`px-3 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                              pookalamSub() === "wishes"
                                ? "bg-[var(--pop-pink)] text-[var(--ink)]"
                                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                            }`}
                          >
                            Community Wishes
                          </button>
                          <button
                            type="button"
                            onClick={() => setPookalamSub("animation")}
                            class={`px-3 py-1 text-[11px] font-black rounded-[4px] cursor-pointer transition-colors ${
                              pookalamSub() === "animation"
                                ? "bg-[var(--pop-purple)] text-[var(--ink)]"
                                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                            }`}
                          >
                            Animation Export
                          </button>
                        </div>

                        <Show when={pookalamSub() === "review"}>
                          {/* Approve, shortlist, see who made what. */}
                          <PookalamReview />
                        </Show>
                        <Show when={pookalamSub() === "gallery"}>
                          {/* The same anonymous gallery the testers judge in. */}
                          <PookalamGallery />
                        </Show>
                        <Show when={pookalamSub() === "wishes"}>
                          <Show when={collabMessages()} fallback={<TabLoading />}>
                            <CollabWishesTab
                              messages={collabMessages()!}
                              onReload={revalidateAfter(ADMIN_QUERY_KEYS.collabMessages)}
                              onNotify={showNotification}
                            />
                          </Show>
                        </Show>
                        <Show when={pookalamSub() === "animation"}>
                          <PookalamAnimationExport />
                        </Show>
                      </div>
                    );
                  })()}
                </Show>

                {/* 9. Activity Logs Tab */}
                <Show when={activeTab() === "logs"}>
                  <Show when={activity()} fallback={<TabLoading />}>
                    <LogsTab logs={activity()!} />
                  </Show>
                </Show>
              </Suspense>
            </div>
          );
        })()}
      </Show>
    </main>
  );
}

function TabLoading() {
  return <div class="card card-plain p-8 text-center font-bold text-sm">Loading this tab…</div>;
}
