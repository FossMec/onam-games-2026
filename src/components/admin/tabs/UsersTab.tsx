import { CheckCircle, Search, ShieldAlert, X } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { setUserBanLevel, setUserRole } from "~/server/admin/actions";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "player" | "tester" | "admin" | null;
  college: string | null;
  branch: string | null;
  batch: string | null;
  banLevel: number | null;
  banUntil: Date | string | null;
  banReason: string | null;
  trustScore: number | null;
  streakCount: number | null;
  onboardingCompleted: boolean;
  createdAt: Date | string;
  lastLoginAt: Date | string | null;
}

interface UsersTabProps {
  users: UserRow[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

export function UsersTab(props: UsersTabProps) {
  const [search, setSearch] = createSignal("");
  const [roleFilter, setRoleFilter] = createSignal<string>("all");
  const [banFilter, setBanFilter] = createSignal<string>("all");
  const [sortBy, setSortBy] = createSignal<"newest" | "oldest" | "name" | "streak" | "trust">(
    "newest",
  );

  // Ban Modal state
  const [targetUser, setTargetUser] = createSignal<UserRow | null>(null);
  const [selectedBanLevel, setSelectedBanLevel] = createSignal<0 | 1 | 2 | 3 | 4>(0);
  const [banReasonInput, setBanReasonInput] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const openBanModal = (user: UserRow) => {
    setTargetUser(user);
    setSelectedBanLevel((user.banLevel ?? 0) as 0 | 1 | 2 | 3 | 4);
    setBanReasonInput(user.banReason ?? "");
  };

  const handleApplyBan = async () => {
    const u = targetUser();
    if (!u) return;
    setBusy(true);
    try {
      await setUserBanLevel(u.id, selectedBanLevel(), banReasonInput().trim() || "set by admin");
      props.onNotify(
        selectedBanLevel() === 0
          ? `Cleared ban for ${u.name}`
          : `Applied Level ${selectedBanLevel()} ban to ${u.name}`,
      );
      setTargetUser(null);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to update ban level");
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (user: UserRow, role: "player" | "tester" | "admin") => {
    try {
      await setUserRole(user.id, role);
      props.onNotify(`Role for ${user.name} changed to ${role}`);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const filteredUsers = createMemo(() => {
    const q = search().toLowerCase().trim();
    const role = roleFilter();
    const ban = banFilter();
    const sort = sortBy();

    return props.users
      .filter((u) => {
        // Search filter
        if (q) {
          const matchName = u.name.toLowerCase().includes(q);
          const matchEmail = u.email.toLowerCase().includes(q);
          const matchCollege = (u.college ?? "").toLowerCase().includes(q);
          const matchBranch = (u.branch ?? "").toLowerCase().includes(q);
          const matchBatch = (u.batch ?? "").toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchCollege && !matchBranch && !matchBatch) {
            return false;
          }
        }

        // Role filter
        if (role !== "all" && (u.role ?? "player") !== role) {
          return false;
        }

        // Ban filter
        if (ban !== "all") {
          const lvl = String(u.banLevel ?? 0);
          if (ban === "banned" && (u.banLevel ?? 0) === 0) return false;
          if (ban !== "banned" && lvl !== ban) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "oldest")
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "streak") return (b.streakCount ?? 0) - (a.streakCount ?? 0);
        if (sort === "trust") return (a.trustScore ?? 100) - (b.trustScore ?? 100);
        // Default newest
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Users & Moderation</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Search participants, assign tester / admin roles, and enforce ban levels. Banned users
            are automatically excluded from the leaderboard.
          </p>
        </div>

        <div class="font-mono text-xs font-black px-2.5 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
          {filteredUsers().length} / {props.users.length} Users
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div class="card card-plain p-3 bg-[var(--paper-2)] space-y-3">
        <div class="grid sm:grid-cols-12 gap-2.5">
          {/* Search input */}
          <div class="sm:col-span-5 relative">
            <Search
              size={15}
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
            />
            <input
              type="text"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search by name, email, college, batch..."
              class="input w-full pl-8 text-xs font-semibold"
            />
            <Show when={search()}>
              <button
                type="button"
                onClick={() => setSearch("")}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </Show>
          </div>

          {/* Role Filter */}
          <div class="sm:col-span-2">
            <select
              value={roleFilter()}
              onChange={(e) => setRoleFilter(e.currentTarget.value)}
              class="input w-full text-xs font-bold"
            >
              <option value="all">All Roles</option>
              <option value="player">Players only</option>
              <option value="tester">Testers only</option>
              <option value="admin">Admins only</option>
            </select>
          </div>

          {/* Ban Filter */}
          <div class="sm:col-span-2">
            <select
              value={banFilter()}
              onChange={(e) => setBanFilter(e.currentTarget.value)}
              class="input w-full text-xs font-bold"
            >
              <option value="all">All Ban Status</option>
              <option value="0">0 · Clear</option>
              <option value="1">1 · Warning</option>
              <option value="2">2 · 3h Bench</option>
              <option value="3">3 · 24h Bench</option>
              <option value="4">4 · Hard Ban</option>
              <option value="banned">Any Active Ban (1–4)</option>
            </select>
          </div>

          {/* Sort By */}
          <div class="sm:col-span-3">
            <select
              value={sortBy()}
              onChange={(e) =>
                setSortBy(
                  e.currentTarget.value as "newest" | "oldest" | "name" | "streak" | "trust",
                )
              }
              class="input w-full text-xs font-bold"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="name">Sort: Name (A–Z)</option>
              <option value="streak">Sort: Highest Streak</option>
              <option value="trust">Sort: Lowest Trust Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div class="card card-plain p-0 overflow-hidden bg-[var(--paper)]">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-[var(--paper-2)] border-b-2 border-[var(--ink)] font-black uppercase text-[var(--ink)]">
              <tr>
                <th class="p-3">User & Email</th>
                <th class="p-3">College & Batch</th>
                <th class="p-3">Role</th>
                <th class="p-3">Trust</th>
                <th class="p-3">Streak</th>
                <th class="p-3">Ban Status</th>
                <th class="p-3 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20 font-semibold">
              <For
                each={filteredUsers()}
                fallback={
                  <tr>
                    <td colspan={7} class="p-8 text-center text-sm font-bold opacity-75">
                      No users found matching query.
                    </td>
                  </tr>
                }
              >
                {(u) => {
                  const isBanned = () => (u.banLevel ?? 0) > 0;
                  return (
                    <tr
                      class={`hover:bg-[var(--paper-2)] transition-colors ${
                        isBanned() ? "bg-red-50/50" : ""
                      }`}
                    >
                      <td class="p-3">
                        <div class="font-extrabold text-sm text-[var(--ink)] flex items-center gap-1.5">
                          <span>{u.name}</span>
                          <Show when={u.role === "admin"}>
                            <span class="badge text-[9px] py-0 px-1 bg-[var(--pop-yellow)] uppercase">
                              Admin
                            </span>
                          </Show>
                          <Show when={u.role === "tester"}>
                            <span class="badge text-[9px] py-0 px-1 bg-[var(--pop-teal)] uppercase">
                              Tester
                            </span>
                          </Show>
                        </div>
                        <div class="font-mono text-[11px] opacity-75">{u.email}</div>
                      </td>

                      <td class="p-3">
                        <div>{u.college ?? "Independent"}</div>
                        <Show when={u.branch || u.batch}>
                          <div class="text-[10px] opacity-70">
                            {u.branch?.toUpperCase() ?? ""}
                            {u.batch ? ` · Batch of '${u.batch}` : ""}
                          </div>
                        </Show>
                      </td>

                      <td class="p-3">
                        <select
                          value={u.role ?? "player"}
                          onChange={(e) =>
                            handleRoleChange(
                              u,
                              e.currentTarget.value as "player" | "tester" | "admin",
                            )
                          }
                          class="input py-1 px-1.5 text-xs font-bold"
                        >
                          <option value="player">player</option>
                          <option value="tester">tester</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>

                      <td class="p-3 font-mono">
                        <span
                          class={`font-bold ${
                            (u.trustScore ?? 100) < 60
                              ? "text-red-600"
                              : (u.trustScore ?? 100) < 85
                                ? "text-amber-600"
                                : "text-green-700"
                          }`}
                        >
                          {u.trustScore ?? 100}%
                        </span>
                      </td>

                      <td class="p-3 font-mono font-bold">
                        <span>🔥 {u.streakCount ?? 0}</span>
                      </td>

                      <td class="p-3">
                        <Show
                          when={isBanned()}
                          fallback={
                            <span class="inline-flex items-center gap-1 text-[11px] text-green-700 font-bold">
                              <CheckCircle size={13} />
                              Clear (0)
                            </span>
                          }
                        >
                          <div class="space-y-0.5">
                            <span
                              class={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-black uppercase text-white ${
                                u.banLevel === 4
                                  ? "bg-red-700"
                                  : u.banLevel === 3
                                    ? "bg-red-600"
                                    : u.banLevel === 2
                                      ? "bg-orange-500"
                                      : "bg-amber-500"
                              }`}
                            >
                              <ShieldAlert size={10} />
                              Level {u.banLevel} ·{" "}
                              {u.banLevel === 4
                                ? "Hard Ban"
                                : u.banLevel === 3
                                  ? "24h Bench"
                                  : u.banLevel === 2
                                    ? "3h Bench"
                                    : "Warning"}
                            </span>
                            <Show when={u.banUntil}>
                              <div class="text-[10px] font-mono opacity-70">
                                Until:{" "}
                                {new Date(u.banUntil!).toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </td>

                      <td class="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => openBanModal(u)}
                          class={`px-2.5 py-1 rounded text-xs font-extrabold border cursor-pointer ${
                            isBanned()
                              ? "bg-[var(--pop-yellow)] border-[var(--ink)] hover:bg-[var(--paper)]"
                              : "bg-[var(--paper-3)] border-[var(--ink-soft)]/50 hover:bg-[var(--pop-red)] hover:text-white"
                          }`}
                        >
                          {isBanned() ? "Adjust / Unban" : "Ban User"}
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ban Enforcement Modal */}
      <Show when={targetUser()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div class="relative w-full max-w-lg card p-6 bg-[var(--paper-2)] border-2 border-[var(--ink)] shadow-xl space-y-4">
            <div class="flex items-center justify-between pb-2 border-b-2 border-[var(--ink)]">
              <div>
                <h3 class="text-lg font-black">Moderate Player: {targetUser()!.name}</h3>
                <p class="text-xs font-mono opacity-70">{targetUser()!.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setTargetUser(null)}
                class="btn-ghost p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <label class="block font-black text-sm">Select Enforcement Tier</label>

              <div class="space-y-2">
                {[
                  {
                    level: 0,
                    title: "Level 0 · Clear / Unban",
                    desc: "Player has full unrestricted access and is listed on leaderboards.",
                    color: "border-green-400 bg-green-50/60",
                  },
                  {
                    level: 1,
                    title: "Level 1 · Acknowledge Warning",
                    desc: "Displays an in-app incident warning that the player must dismiss.",
                    color: "border-amber-400 bg-amber-50/60",
                  },
                  {
                    level: 2,
                    title: "Level 2 · 3-Hour Bench",
                    desc: "Temporarily benches player from starting games for 3 hours.",
                    color: "border-orange-400 bg-orange-50/60",
                  },
                  {
                    level: 3,
                    title: "Level 3 · 24-Hour Bench",
                    desc: "Benches player from participating for 24 hours.",
                    color: "border-red-400 bg-red-50/60",
                  },
                  {
                    level: 4,
                    title: "Level 4 · Hard Ban (Anti-Cheat / Disqualification)",
                    desc: "Completely blocks account and permanently removes player from all leaderboards.",
                    color: "border-red-600 bg-red-100",
                  },
                ].map((tier) => (
                  <label
                    class={`flex items-start gap-2.5 p-2.5 rounded border-2 cursor-pointer transition-all ${
                      tier.color
                    } ${
                      selectedBanLevel() === tier.level
                        ? "border-[var(--ink)] ring-2 ring-[var(--ink)] font-extrabold"
                        : "opacity-80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="banTier"
                      value={tier.level}
                      checked={selectedBanLevel() === tier.level}
                      onChange={() => setSelectedBanLevel(tier.level as 0 | 1 | 2 | 3 | 4)}
                      class="mt-0.5"
                    />
                    <div>
                      <div class="font-black text-sm text-[var(--ink)]">{tier.title}</div>
                      <p class="text-[11px] text-[var(--ink-soft)] font-medium mt-0.5">
                        {tier.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label class="block font-black mb-1">Reason for Action</label>
                <input
                  type="text"
                  value={banReasonInput()}
                  onInput={(e) => setBanReasonInput(e.currentTarget.value)}
                  placeholder="e.g. multi-account abuse, speed hack, script detected"
                  class="input w-full text-xs font-semibold"
                />
              </div>

              <div class="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setTargetUser(null)}
                  class="btn-ghost px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBan}
                  disabled={busy()}
                  class="btn-brand px-5 py-2 font-black"
                >
                  {busy() ? "Applying..." : "Save Enforcement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
