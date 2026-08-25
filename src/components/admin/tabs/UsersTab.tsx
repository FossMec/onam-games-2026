/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */
import {
  AtSign,
  CheckCircle,
  GraduationCap,
  Layers,
  Phone,
  Search,
  ShieldAlert,
  X,
} from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { setUserBanLevel, setUserRole } from "~/server/admin/actions";
import { UserAttemptReset } from "~/components/admin/UserAttemptReset";
import { batchLabel, branchShort, collegeLabel } from "~/lib/profile";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "player" | "tester" | "admin" | null;
  college: string | null;
  collegeOther: string | null;
  branch: string | null;
  branchOther: string | null;
  batch: string | null;
  div: string | null;
  occupation: string | null;
  instagramHandle: string | null;
  whatsappNumber: string | null;
  avatarUrl: string | null;
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
  games: { id: string; title: string; day: number }[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

const BATCH_ORDER = ["30", "29", "28", "27", "26", "<=26", "na"] as const;
const _BATCH_LABEL_SHORT: Record<string, string> = {
  "30": "’30 · 1st Yr",
  "29": "’29 · 2nd Yr",
  "28": "’28 · 3rd Yr",
  "27": "’27 · 4th Yr",
  "26": "’26",
  "<=26": "Alumni ≤’26",
  na: "N/A",
};
const YEAR_LABEL: Record<string, string> = {
  "30": "1st Year",
  "29": "2nd Year",
  "28": "3rd Year",
  "27": "4th Year",
  "26": "Alumni",
  "<=26": "Alumni",
  na: "N/A",
};
const BRANCH_ORDER = ["cs", "cu", "ec", "eb", "ev", "ee", "me", "other"] as const;

export function UsersTab(props: UsersTabProps) {
  const [search, setSearch] = createSignal("");
  const [roleFilter, setRoleFilter] = createSignal<string>("all");
  const [banFilter, setBanFilter] = createSignal<string>("all");
  const [collegeFilter, setCollegeFilter] = createSignal<string>("all");
  const [batchFilter, setBatchFilter] = createSignal<string>("all");
  const [branchFilter, setBranchFilter] = createSignal<string>("all");
  const [divFilter, setDivFilter] = createSignal<string>("all");
  const [contactFilter, setContactFilter] = createSignal<string>("all");
  const [sortBy, setSortBy] = createSignal<"newest" | "oldest" | "name" | "streak" | "trust">(
    "newest",
  );
  const [showAllExact, setShowAllExact] = createSignal(false);

  // Ban Modal state
  const [targetUser, setTargetUser] = createSignal<UserRow | null>(null);
  const [selectedBanLevel, setSelectedBanLevel] = createSignal<0 | 1 | 2 | 3 | 4>(0);
  const [banReasonInput, setBanReasonInput] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  // Detail drawer state - clicking a row shows full profile inc. phone
  const [detailUser, setDetailUser] = createSignal<UserRow | null>(null);
  const [localRoles, setLocalRoles] = createSignal<Record<string, "player" | "tester" | "admin">>(
    {},
  );

  const userRole = (u: UserRow) => localRoles()[u.id] ?? u.role ?? "player";

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
    setLocalRoles((prev) => ({ ...prev, [user.id]: role }));
    try {
      await setUserRole(user.id, role);
      props.onNotify(`Role for ${user.name} changed to ${role}`);
      props.onReload();
    } catch (err) {
      setLocalRoles((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      props.onNotify(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const filteredUsers = createMemo(() => {
    const q = search().toLowerCase().trim();
    const role = roleFilter();
    const ban = banFilter();
    const college = collegeFilter();
    const batchF = batchFilter();
    const branchF = branchFilter();
    const divF = divFilter();
    const contact = contactFilter();
    const sort = sortBy();

    return props.users
      .filter((u) => {
        if (q) {
          const matchName = u.name.toLowerCase().includes(q);
          const matchEmail = u.email.toLowerCase().includes(q);
          const matchCollege = (u.college ?? "").toLowerCase().includes(q);
          const matchCollegeOther = (u.collegeOther ?? "").toLowerCase().includes(q);
          const matchBranch = (u.branch ?? "").toLowerCase().includes(q);
          const matchBranchOther = (u.branchOther ?? "").toLowerCase().includes(q);
          const matchBatch = (u.batch ?? "").toLowerCase().includes(q);
          const matchDiv = (u.div ?? "").toLowerCase().includes(q);
          const matchInsta = (u.instagramHandle ?? "").toLowerCase().includes(q);
          const matchPhone = (u.whatsappNumber ?? "").toLowerCase().includes(q);
          if (
            !matchName &&
            !matchEmail &&
            !matchCollege &&
            !matchCollegeOther &&
            !matchBranch &&
            !matchBranchOther &&
            !matchBatch &&
            !matchDiv &&
            !matchInsta &&
            !matchPhone
          )
            return false;
        }
        if (role !== "all" && (u.role ?? "player") !== role) return false;
        if (ban !== "all") {
          const lvl = String(u.banLevel ?? 0);
          if (ban === "banned" && (u.banLevel ?? 0) === 0) return false;
          if (ban !== "banned" && lvl !== ban) return false;
        }
        if (college !== "all" && (u.college ?? "other") !== college) return false;
        if (batchF !== "all" && (u.batch ?? "na") !== batchF) return false;
        if (branchF !== "all" && (u.branch ?? "other") !== branchF) return false;
        if (divF !== "all" && (u.div ?? "none") !== divF) return false;
        if (contact !== "all") {
          const hasInsta = !!u.instagramHandle?.trim();
          const hasPhone = !!u.whatsappNumber?.trim();
          if (contact === "has_insta" && !hasInsta) return false;
          if (contact === "no_insta" && hasInsta) return false;
          if (contact === "has_phone" && !hasPhone) return false;
          if (contact === "no_phone" && hasPhone) return false;
          if (contact === "has_both" && !(hasInsta && hasPhone)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "oldest")
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "streak") return (b.streakCount ?? 0) - (a.streakCount ?? 0);
        if (sort === "trust") return (a.trustScore ?? 100) - (b.trustScore ?? 100);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  // Analytics — computed from filtered set so search/filter reflects instantly without refetch.
  // MEC-scoped year/batch are PRIMARY per request.
  const stats = createMemo(() => {
    const users = filteredUsers();
    const total = users.length;
    const mecUsers = users.filter((u) => u.college === "mec");
    const mecTotal = mecUsers.length;

    const countBy = (
      arr: UserRow[],
      key: (u: UserRow) => string | null,
      orderedKeys: readonly string[],
    ) => {
      const m = new Map<string, number>();
      for (const k of orderedKeys) m.set(k, 0);
      let other = 0;
      for (const u of arr) {
        const v = key(u) ?? "na";
        if (m.has(v)) m.set(v, (m.get(v) ?? 0) + 1);
        else other++;
      }
      return { map: m, other };
    };

    const mecBatch = countBy(mecUsers, (u) => u.batch, BATCH_ORDER);
    const mecYearMap = new Map<string, number>([
      ["1st Year", 0],
      ["2nd Year", 0],
      ["3rd Year", 0],
      ["4th Year", 0],
      ["Alumni", 0],
      ["N/A", 0],
    ]);
    for (const u of mecUsers) {
      const y = YEAR_LABEL[u.batch ?? "na"] ?? "N/A";
      mecYearMap.set(y, (mecYearMap.get(y) ?? 0) + 1);
    }

    const mecBranch = countBy(mecUsers, (u) => u.branch, BRANCH_ORDER);
    const mecDivMap = new Map<string, number>([
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["none", 0],
    ]);
    for (const u of mecUsers) {
      const d = (u.div ?? "none") as string;
      mecDivMap.set(d, (mecDivMap.get(d) ?? 0) + 1);
    }

    // exact class = Year + Batch + Branch + Division combined (e.g. "3rd Yr ’28 · CS · A")
    const mecExactMap = new Map<string, number>();
    for (const u of mecUsers) {
      const b = u.batch ?? "na";
      const br = (u.branch ?? "other") as string;
      const dv = (u.div ?? "none") as string;
      const year = YEAR_LABEL[b] ?? "N/A";
      const batchPart = b === "na" ? "N/A" : `’${b}`;
      const branchPart = branchShort(br).toUpperCase();
      const divPart = dv === "none" ? "—" : dv.toUpperCase();
      const label = `${year} ${batchPart} · ${branchPart} · ${divPart}`;
      mecExactMap.set(label, (mecExactMap.get(label) ?? 0) + 1);
    }
    const mecExactEntries = Array.from(mecExactMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    // overall college split
    const collegeMec = users.filter((u) => u.college === "mec").length;
    const collegeOther = total - collegeMec;
    const instaYes = users.filter((u) => !!u.instagramHandle?.trim()).length;
    const phoneYes = users.filter((u) => !!u.whatsappNumber?.trim()).length;

    // bans in filtered set
    const banned = users.filter((u) => (u.banLevel ?? 0) > 0).length;

    return {
      total,
      mecTotal,
      mecBatch,
      mecYearMap,
      mecBranch,
      mecDivMap,
      mecExactEntries,
      collegeMec,
      collegeOther,
      instaYes,
      phoneYes,
      banned,
    };
  });

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Users & Moderation</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Search participants, assign tester / admin roles, and enforce ban levels. Click any row
            to see phone &amp; full profile. Banned users are hidden from leaderboards.
          </p>
        </div>
        <div class="font-mono text-xs font-black px-2.5 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
          {filteredUsers().length} / {props.users.length} Users
        </div>
      </div>

      {/* Filter & Search Bar — every data element filterable, graphs + table share same filteredUsers */}
      <div class="card card-plain p-3 bg-[var(--paper-2)] space-y-3">
        <div class="grid sm:grid-cols-12 gap-2.5">
          <div class="sm:col-span-5 relative">
            <Search
              size={15}
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
            />
            <input
              type="text"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search name, email, college, batch, phone…"
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
        {/* Second row — college / batch / branch / division / contact — all filter both table AND hero graphs */}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select
            value={collegeFilter()}
            onChange={(e) => setCollegeFilter(e.currentTarget.value)}
            class="input w-full text-xs font-bold"
          >
            <option value="all">College: All</option>
            <option value="mec">MEC only</option>
            <option value="other">Other colleges</option>
          </select>
          <select
            value={batchFilter()}
            onChange={(e) => setBatchFilter(e.currentTarget.value)}
            class="input w-full text-xs font-bold"
          >
            <option value="all">Batch: All</option>
            <option value="30">Batch ’30 (1st Yr)</option>
            <option value="29">Batch ’29 (2nd Yr)</option>
            <option value="28">Batch ’28 (3rd Yr)</option>
            <option value="27">Batch ’27 (4th Yr)</option>
            <option value="26">Batch ’26</option>
            <option value="<=26">Alumni ≤’26</option>
            <option value="na">Batch N/A</option>
          </select>
          <select
            value={branchFilter()}
            onChange={(e) => setBranchFilter(e.currentTarget.value)}
            class="input w-full text-xs font-bold"
          >
            <option value="all">Branch: All</option>
            <option value="cs">CS</option>
            <option value="cu">CU</option>
            <option value="ec">EC</option>
            <option value="eb">EB</option>
            <option value="ev">EV</option>
            <option value="ee">EE</option>
            <option value="me">ME</option>
            <option value="other">Other</option>
          </select>
          <select
            value={divFilter()}
            onChange={(e) => setDivFilter(e.currentTarget.value)}
            class="input w-full text-xs font-bold"
          >
            <option value="all">Division: All</option>
            <option value="a">Div A</option>
            <option value="b">Div B</option>
            <option value="c">Div C</option>
            <option value="none">No division</option>
          </select>
          <select
            value={contactFilter()}
            onChange={(e) => setContactFilter(e.currentTarget.value)}
            class="input w-full text-xs font-bold"
          >
            <option value="all">Contact: All</option>
            <option value="has_phone">Has phone</option>
            <option value="no_phone">No phone</option>
            <option value="has_insta">Has Instagram</option>
            <option value="no_insta">No Instagram</option>
            <option value="has_both">Has both</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setRoleFilter("all");
              setBanFilter("all");
              setCollegeFilter("all");
              setBatchFilter("all");
              setBranchFilter("all");
              setDivFilter("all");
              setContactFilter("all");
              setSortBy("newest");
            }}
            class="input w-full text-xs font-black bg-[var(--paper)] hover:bg-[var(--paper-3)] cursor-pointer text-center"
          >
            Clear all filters
          </button>
        </div>
        <p class="text-[11px] font-semibold opacity-60">
          Filters drive both the graphs and the table below — e.g. pick “Players only”, “MEC only”,
          or “’30” and the year/batch hero charts update instantly (no refetch). Click any row to
          see phone number & full profile — table stays mounted on ban/role edits.
        </p>
      </div>

      {/* PRIMARY INSIGHTS — MEC year & batch are the hero graphs */}
      <div class="grid lg:grid-cols-2 gap-3">
        {/* MEC by Year — MOST IMPORTANT */}
        <div class="card p-3 bg-[var(--paper)] border-2 border-[var(--ink)] space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)]">
                <GraduationCap size={14} strokeWidth={2.5} />
              </span>
              <h3 class="font-black text-sm leading-none">
                MEC Students by Year
                <span class="ml-1.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] align-middle">
                  PRIMARY
                </span>
              </h3>
            </div>
            <span class="text-[11px] font-mono font-bold opacity-70">
              MEC {stats().mecTotal}/{stats().total}
            </span>
          </div>
          <p class="text-[11px] font-semibold opacity-70 -mt-1">
            Batch → year mapping: ’30=1st, ’29=2nd, ’28=3rd, ’27=4th
          </p>
          <MiniBarChart
            entries={Array.from(stats().mecYearMap.entries()).map(([label, count]) => ({
              label,
              count,
            }))}
            total={stats().mecTotal}
            color="var(--pop-yellow)"
            emptyLabel="No MEC users in this filtered set"
          />
        </div>

        {/* MEC by Exact Class — SECOND HERO: Year + Branch + Division combined */}
        <div class="card p-3 bg-[var(--paper)] border-2 border-[var(--ink)] space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded bg-[var(--pop-teal)] border border-[var(--ink)]">
                <Layers size={14} strokeWidth={2.5} />
              </span>
              <h3 class="font-black text-sm leading-none">
                MEC Students by Exact Class
                <span class="ml-1.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--pop-teal)] border border-[var(--ink)] align-middle">
                  PRIMARY
                </span>
              </h3>
            </div>
            <span class="text-[11px] font-mono font-bold opacity-70">{stats().mecTotal} total</span>
          </div>
          <p class="text-[11px] font-semibold opacity-70 -mt-1">
            Year + Batch + Branch + Division — each bar is one classroom (e.g. 3rd Yr ’28 · CS · A)
          </p>
          <div class={`${showAllExact() ? "max-h-64 overflow-y-auto pr-1 scrollbar-thin" : ""}`}>
            <MiniBarChart
              entries={
                showAllExact() ? stats().mecExactEntries : stats().mecExactEntries.slice(0, 6)
              }
              total={stats().mecTotal}
              color="var(--pop-teal)"
              emptyLabel="No MEC classes in this filtered set"
            />
          </div>
          <Show when={stats().mecExactEntries.length > 6}>
            <button
              type="button"
              onClick={() => setShowAllExact((v) => !v)}
              class="text-[11px] font-black underline decoration-2 underline-offset-2 hover:opacity-70 cursor-pointer"
            >
              {showAllExact() ? "Show less" : `Show ${stats().mecExactEntries.length - 6} more`}
            </button>
          </Show>
        </div>
      </div>

      {/* SECONDARY INSIGHTS — lightweight, pure CSS */}
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SmallStatCard title="MEC Division" icon={<Layers size={13} />}>
          <MiniBarChart
            entries={[
              { label: "A", count: stats().mecDivMap.get("a") ?? 0 },
              { label: "B", count: stats().mecDivMap.get("b") ?? 0 },
              { label: "C", count: stats().mecDivMap.get("c") ?? 0 },
              { label: "— / none", count: stats().mecDivMap.get("none") ?? 0 },
            ]}
            total={stats().mecTotal}
            color="var(--pop-pink)"
            compact
          />
        </SmallStatCard>

        <SmallStatCard title="MEC Branch (class)" icon={<GraduationCap size={13} />}>
          <MiniBarChart
            entries={BRANCH_ORDER.map((b) => ({
              label: branchShort(b).toUpperCase(),
              count: stats().mecBranch.map.get(b) ?? 0,
            }))}
            total={stats().mecTotal}
            color="var(--pop-purple)"
            compact
          />
        </SmallStatCard>

        <SmallStatCard title="College split" icon={<GraduationCap size={13} />}>
          <div class="flex gap-2 text-[11px] font-bold">
            <span class="px-2 py-1 rounded bg-[var(--pop-yellow)] border border-[var(--ink)] flex-1 text-center">
              MEC {stats().collegeMec}
            </span>
            <span class="px-2 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)] flex-1 text-center">
              Other {stats().collegeOther}
            </span>
          </div>
          <div class="mt-2 flex h-2 rounded-full overflow-hidden border border-[var(--ink)]">
            <div
              class="bg-[var(--pop-yellow)] transition-all"
              style={{
                width: `${stats().total ? (stats().collegeMec / stats().total) * 100 : 0}%`,
              }}
            />
            <div class="bg-[var(--ink-soft)] transition-all flex-1" />
          </div>
          <div class="mt-1 flex justify-between text-[10px] font-mono opacity-60">
            <span>
              {stats().total ? Math.round((stats().collegeMec / stats().total) * 100) : 0}% MEC
            </span>
            <span>{stats().banned} banned in view</span>
          </div>
        </SmallStatCard>

        <SmallStatCard title="Contact given" icon={<Phone size={13} />}>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[11px] font-bold">
              <span class="inline-flex items-center gap-1">
                <AtSign size={12} /> Instagram
              </span>
              <span class="font-mono">
                {stats().instaYes}/{stats().total}
              </span>
            </div>
            <div class="h-1.5 rounded-full bg-[var(--paper-2)] border border-[var(--ink)] overflow-hidden">
              <div
                class="h-full bg-[var(--pop-pink)] transition-all"
                style={{
                  width: `${stats().total ? (stats().instaYes / stats().total) * 100 : 0}%`,
                }}
              />
            </div>
            <div class="flex items-center justify-between text-[11px] font-bold pt-1">
              <span class="inline-flex items-center gap-1">
                <Phone size={12} /> WhatsApp
              </span>
              <span class="font-mono">
                {stats().phoneYes}/{stats().total}
              </span>
            </div>
            <div class="h-1.5 rounded-full bg-[var(--paper-2)] border border-[var(--ink)] overflow-hidden">
              <div
                class="h-full bg-[var(--pop-teal)] transition-all"
                style={{
                  width: `${stats().total ? (stats().phoneYes / stats().total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </SmallStatCard>
      </div>

      {/* Users Table — stable: only filteredUsers memo changes, outer page does NOT remount */}
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
                      onClick={() => setDetailUser(u)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailUser(u);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      class={`hover:bg-[var(--paper-2)] transition-colors cursor-pointer ${
                        isBanned() ? "bg-red-50/50" : ""
                      }`}
                      title="Click to view phone & full profile"
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
                        <div>{collegeLabel(u.college, u.collegeOther) ?? u.college ?? "—"}</div>
                        <Show when={u.branch || u.batch}>
                          <div class="text-[10px] opacity-70">
                            {u.branch ? branchShort(u.branch).toUpperCase() : ""}
                            {u.branchOther ? ` (${u.branchOther})` : ""}
                            {u.batch ? ` · ${batchLabel(u.batch)}` : ""}
                          </div>
                        </Show>
                        <Show when={u.div && u.div !== "none"}>
                          <div class="text-[10px] font-mono opacity-60">
                            Div {u.div?.toUpperCase()}
                          </div>
                        </Show>
                      </td>
                      <td class="p-3" onClick={(e) => e.stopPropagation()}>
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
                      <td class="p-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                        <Show when={u.role === "tester" || u.role === "admin"}>
                          <UserAttemptReset
                            userId={u.id}
                            userName={u.name}
                            games={props.games}
                            onReload={props.onReload}
                            onNotify={props.onNotify}
                          />
                        </Show>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer — shows phone number etc on row click */}
      <Show when={detailUser()}>
        {(du) => {
          const u = du();
          return (
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div class="relative w-full max-w-lg card p-6 bg-[var(--paper)] border-2 border-[var(--ink)] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div class="flex items-start justify-between pb-3 border-b-2 border-[var(--ink)] gap-3">
                  <div class="flex items-center gap-3">
                    <Show
                      when={u.avatarUrl}
                      fallback={
                        <div class="w-10 h-10 rounded-full bg-[var(--paper-2)] border-2 border-[var(--ink)] flex items-center justify-center font-black text-sm">
                          {u.name.slice(0, 1).toUpperCase()}
                        </div>
                      }
                    >
                      <img
                        src={u.avatarUrl!}
                        alt={u.name}
                        class="w-10 h-10 rounded-full border-2 border-[var(--ink)] object-cover"
                      />
                    </Show>
                    <div>
                      <h3 class="text-lg font-black leading-none">{u.name}</h3>
                      <p class="text-xs font-mono opacity-70">{u.email}</p>
                      <p class="text-[11px] font-bold opacity-60">
                        ID {u.id.slice(0, 8)}… · {u.role ?? "player"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    class="btn-ghost p-1 cursor-pointer shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div class="col-span-2">
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Phone / WhatsApp
                    </div>
                    <Show
                      when={u.whatsappNumber?.trim()}
                      fallback={<div class="font-mono font-bold opacity-50">— not provided —</div>}
                    >
                      <a
                        href={`https://wa.me/${u.whatsappNumber!.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        class="font-mono font-black text-sm underline decoration-2 underline-offset-2 hover:text-[var(--pop-teal)] inline-flex items-center gap-1.5"
                      >
                        <Phone size={14} /> {u.whatsappNumber}
                      </a>
                    </Show>
                  </div>

                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Occupation
                    </div>
                    <div class="font-bold">{u.occupation ?? "—"}</div>
                  </div>

                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      College
                    </div>
                    <div class="font-bold">
                      {collegeLabel(u.college, u.collegeOther) ?? u.college ?? "—"}
                    </div>
                    <Show when={u.collegeOther}>
                      <div class="text-[10px] opacity-60">{u.collegeOther}</div>
                    </Show>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Branch / Class
                    </div>
                    <div class="font-bold">
                      {u.branch ? `${branchShort(u.branch).toUpperCase()} · ${u.branch}` : "—"}
                    </div>
                    <Show when={u.branchOther}>
                      <div class="text-[10px] opacity-60">{u.branchOther}</div>
                    </Show>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Batch / Year
                    </div>
                    <div class="font-bold">
                      {u.batch ? `${u.batch} · ${batchLabel(u.batch)}` : "—"}
                    </div>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Division
                    </div>
                    <div class="font-bold">
                      {u.div && u.div !== "none" ? u.div.toUpperCase() : "— (no division)"}
                    </div>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Trust / Streak
                    </div>
                    <div class="font-mono font-bold">
                      {u.trustScore ?? 100}% · 🔥 {u.streakCount ?? 0}
                    </div>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">Ban</div>
                    <div class="font-bold">
                      {(u.banLevel ?? 0) === 0
                        ? "Clear (0)"
                        : `Level ${u.banLevel} · ${u.banReason ?? ""}`}
                    </div>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Joined
                    </div>
                    <div class="font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <div class="font-black text-[11px] uppercase tracking-wide opacity-60">
                      Last login
                    </div>
                    <div class="font-mono text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN") : "—"}
                    </div>
                  </div>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    class="btn-ghost px-4 py-2 text-xs"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailUser(null);
                      openBanModal(u);
                    }}
                    class="btn-brand px-4 py-2 text-xs font-black"
                  >
                    Moderate / Ban
                  </button>
                </div>
              </div>
            </div>
          );
        }}
      </Show>

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
              <div class="block font-black text-sm">Select Enforcement Tier</div>
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
                    class={`flex items-start gap-2.5 p-2.5 rounded border-2 cursor-pointer transition-all ${tier.color} ${selectedBanLevel() === tier.level ? "border-[var(--ink)] ring-2 ring-[var(--ink)] font-extrabold" : "opacity-80"}`}
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
                <div class="block font-black mb-1">Reason for Action</div>
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

function SmallStatCard(props: { title: string; icon: unknown; children: unknown }) {
  return (
    <div class="card p-3 bg-[var(--paper)] border border-[var(--ink-soft)]/30 space-y-2">
      <div class="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wide">
        {props.icon as any}
        <span>{props.title}</span>
      </div>
      <div>{props.children as any}</div>
    </div>
  );
}

function MiniBarChart(props: {
  entries: { label: string; count: number }[];
  total: number;
  color: string;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const max = () => Math.max(1, ...props.entries.map((e) => e.count));
  const isEmpty = () => props.total === 0 || props.entries.every((e) => e.count === 0);
  return (
    <Show
      when={!isEmpty()}
      fallback={
        <div class="text-[11px] font-semibold opacity-50 py-2 text-center border border-dashed border-[var(--ink-soft)]/30 rounded">
          {props.emptyLabel ?? "No data"}
        </div>
      }
    >
      <div class={`space-y-1 ${props.compact ? "" : ""}`}>
        <For each={props.entries}>
          {(e) => {
            const pctOfTotal = () => (props.total ? (e.count / props.total) * 100 : 0);
            const pctOfMax = () => (e.count / max()) * 100;
            return (
              <div class={`${props.compact ? "space-y-0.5" : "space-y-0.5"}`}>
                <div class="flex items-center justify-between gap-2">
                  <span
                    class={`font-bold truncate ${props.compact ? "text-[10px]" : "text-[11px]"}`}
                  >
                    {e.label}
                  </span>
                  <span
                    class={`font-mono font-black shrink-0 ${props.compact ? "text-[10px]" : "text-[11px]"}`}
                  >
                    {e.count}{" "}
                    <span class="font-normal opacity-60">({pctOfTotal().toFixed(0)}%)</span>
                  </span>
                </div>
                <div
                  class={`rounded-full bg-[var(--paper-2)] border border-[var(--ink)] overflow-hidden ${props.compact ? "h-1.5" : "h-2.5"}`}
                >
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pctOfMax()}%`,
                      background: props.color,
                      "min-width": e.count > 0 ? "4px" : "0",
                    }}
                  />
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
