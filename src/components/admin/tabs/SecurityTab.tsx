import { AlertTriangle, Lock, Search, ShieldAlert } from "lucide-solid";
import { For, createMemo, createSignal } from "solid-js";
import { addTester, blockIpAction, setTesterActive, unblockIpAction } from "~/server/admin/actions";

export interface TesterRow {
  id: string;
  email: string;
  earlyHours: number;
  active: boolean;
  activatedAt: Date | string | null;
  createdAt: Date | string;
}

export interface BlockedIpRow {
  ip: string;
  reason: string | null;
  scope: string;
  expiresAt: Date | string | null;
}

export interface SuspiciousRow {
  id: string;
  eventType: string;
  severity: "info" | "warn" | "critical" | (string & {});
  actionTaken: string;
  details: unknown;
  ip: string | null;
  userEmail: string | null;
  deviceHash: string | null;
  createdAt: Date | string;
}

interface SecurityTabProps {
  testers: TesterRow[];
  blockedIps: BlockedIpRow[];
  suspicious: SuspiciousRow[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

export function SecurityTab(props: SecurityTabProps) {
  // Tester form state
  const [testerEmail, setTesterEmail] = createSignal("");
  const [testerEarlyHours, setTesterEarlyHours] = createSignal(24);
  const [testerSearch, setTesterSearch] = createSignal("");

  // IP Block form state
  const [ipInput, setIpInput] = createSignal("");
  const [ipReason, setIpReason] = createSignal("");
  const [ipScope, setIpScope] = createSignal<"all" | "auth" | "game">("all");
  const [ipExpiresAt, setIpExpiresAt] = createSignal("");

  // Suspicious logs filter
  const [severityFilter, setSeverityFilter] = createSignal<string>("all");
  const [logSearch, setLogSearch] = createSignal("");

  const [busy, setBusy] = createSignal(false);

  const handleAddTester = async (e: Event) => {
    e.preventDefault();
    if (!testerEmail().trim()) return;
    setBusy(true);
    try {
      await addTester(testerEmail().trim(), testerEarlyHours());
      props.onNotify(`Tester ${testerEmail()} added`);
      setTesterEmail("");
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to add tester");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleTester = async (t: TesterRow) => {
    try {
      await setTesterActive(t.id, !t.active);
      props.onNotify(`Tester ${t.email} ${t.active ? "deactivated" : "activated"}`);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to toggle tester");
    }
  };

  const handleBlockIp = async (e: Event) => {
    e.preventDefault();
    if (!ipInput().trim()) return;
    setBusy(true);
    try {
      await blockIpAction({
        ip: ipInput().trim(),
        reason: ipReason().trim() || undefined,
        scope: ipScope(),
        expiresAt: ipExpiresAt() ? new Date(ipExpiresAt()).toISOString() : null,
      });
      props.onNotify(`IP ${ipInput()} blocked`);
      setIpInput("");
      setIpReason("");
      setIpExpiresAt("");
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to block IP");
    } finally {
      setBusy(false);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    if (!confirm(`Unblock IP ${ip}?`)) return;
    try {
      await unblockIpAction(ip);
      props.onNotify(`IP ${ip} unblocked`);
      props.onReload();
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to unblock IP");
    }
  };

  const filteredTesters = createMemo(() => {
    const q = testerSearch().toLowerCase().trim();
    if (!q) return props.testers;
    return props.testers.filter((t) => t.email.toLowerCase().includes(q));
  });

  const filteredSuspicious = createMemo(() => {
    const sev = severityFilter();
    const q = logSearch().toLowerCase().trim();

    return props.suspicious.filter((s) => {
      if (sev !== "all" && s.severity !== sev) return false;
      if (q) {
        const matchEmail = (s.userEmail ?? "").toLowerCase().includes(q);
        const matchIp = (s.ip ?? "").toLowerCase().includes(q);
        const matchType = s.eventType.toLowerCase().includes(q);
        if (!matchEmail && !matchIp && !matchType) return false;
      }
      return true;
    });
  });

  return (
    <div class="space-y-6">
      {/* 2-Column Grid: Testers on Left, Blocked IPs on Right */}
      <div class="grid lg:grid-cols-2 gap-4">
        {/* Testers Management Card */}
        <div class="card p-4 space-y-3.5 bg-[var(--paper-2)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Lock size={18} strokeWidth={2.5} />
              <h3 class="font-black text-base">Early Access Testers</h3>
            </div>
            <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--paper)] border border-[var(--ink)]">
              {props.testers.filter((t) => t.active).length} Active
            </span>
          </div>

          <p class="text-xs text-[var(--ink-soft)] font-medium">
            Testers can access the site during closed beta and play upcoming daily games early.
          </p>

          {/* Add Tester Form */}
          <form
            onSubmit={handleAddTester}
            class="p-3 rounded-md bg-[var(--paper)] border border-[var(--ink-soft)]/30 space-y-2"
          >
            <div class="font-extrabold text-xs text-[var(--ink)]">Add Authorized Beta Tester</div>
            <div class="grid sm:grid-cols-12 gap-2">
              <div class="sm:col-span-7">
                <input
                  type="email"
                  value={testerEmail()}
                  onInput={(e) => setTesterEmail(e.currentTarget.value)}
                  placeholder="tester@example.com"
                  class="input w-full text-xs"
                  required
                />
              </div>
              <div class="sm:col-span-5 flex items-center gap-1.5">
                <div class="relative flex-1">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={testerEarlyHours()}
                    onInput={(e) => setTesterEarlyHours(Number(e.currentTarget.value))}
                    class="input w-full text-xs font-mono pr-8 text-center"
                    title="Hours of early access before official game unlock"
                  />
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-60">
                    hrs
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={busy()}
                  class="btn-brand text-xs px-3 py-2 shrink-0 font-extrabold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
            <p class="text-[10px] text-[var(--ink-soft)] font-medium">
              The hour count determines how many hours before public launch this tester can play
              upcoming daily games (default: 24h).
            </p>
          </form>

          {/* Tester Search */}
          <div class="relative">
            <Search
              size={14}
              class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
            />
            <input
              type="text"
              value={testerSearch()}
              onInput={(e) => setTesterSearch(e.currentTarget.value)}
              placeholder="Search testers..."
              class="input w-full pl-8 text-xs font-medium py-1.5"
            />
          </div>

          {/* Testers List */}
          <div class="max-h-60 overflow-y-auto divide-y divide-[var(--ink-soft)]/20 border border-[var(--ink)] rounded-md bg-[var(--paper)] text-xs">
            <For
              each={filteredTesters()}
              fallback={<p class="p-4 text-center opacity-60">No testers registered.</p>}
            >
              {(t) => (
                <div class="p-2.5 flex items-center justify-between gap-2 hover:bg-[var(--paper-2)]">
                  <div class="min-w-0">
                    <div class="font-extrabold truncate text-[var(--ink)]">{t.email}</div>
                    <div class="text-[10px] opacity-70 font-mono">
                      {t.earlyHours}h early · Added {new Date(t.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleTester(t)}
                    class={`px-2 py-1 rounded text-[11px] font-extrabold border cursor-pointer ${
                      t.active
                        ? "bg-green-100 text-green-800 border-green-400 hover:bg-red-100 hover:text-red-700"
                        : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-green-100 hover:text-green-800"
                    }`}
                  >
                    {t.active ? "Active" : "Inactive"}
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Blocked IPs Card */}
        <div class="card p-4 space-y-3.5 bg-[var(--paper-2)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ShieldAlert size={18} strokeWidth={2.5} />
              <h3 class="font-black text-base">Blacklisted / Blocked IPs</h3>
            </div>
            <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--paper)] border border-[var(--ink)]">
              {props.blockedIps.length} Blocked
            </span>
          </div>

          <p class="text-xs text-[var(--ink-soft)] font-medium">
            Block requests from malicious proxies, brute force bots, or automated scrapers.
          </p>

          {/* Block IP Form */}
          <form onSubmit={handleBlockIp} class="space-y-2">
            <div class="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={ipInput()}
                onInput={(e) => setIpInput(e.currentTarget.value)}
                placeholder="192.168.1.1"
                class="input col-span-2 text-xs font-mono"
                required
              />
              <select
                value={ipScope()}
                onChange={(e) => setIpScope(e.currentTarget.value as "all" | "auth" | "game")}
                class="input text-xs font-bold"
              >
                <option value="all">All Traffic</option>
                <option value="auth">Auth Only</option>
                <option value="game">Games Only</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <input
                type="text"
                value={ipReason()}
                onInput={(e) => setIpReason(e.currentTarget.value)}
                placeholder="Reason (e.g. DoS attack, proxy spam)"
                class="input flex-1 text-xs"
              />
              <button
                type="submit"
                disabled={busy()}
                class="btn-brand text-xs px-3 py-2 font-extrabold shrink-0"
              >
                Block IP
              </button>
            </div>
          </form>

          {/* Blocked IPs List */}
          <div class="max-h-60 overflow-y-auto divide-y divide-[var(--ink-soft)]/20 border border-[var(--ink)] rounded-md bg-[var(--paper)] text-xs">
            <For
              each={props.blockedIps}
              fallback={<p class="p-4 text-center opacity-60">No IPs currently blacklisted.</p>}
            >
              {(ipRow) => (
                <div class="p-2.5 flex items-center justify-between gap-2 hover:bg-[var(--paper-2)]">
                  <div>
                    <div class="font-mono font-bold text-[var(--ink)]">{ipRow.ip}</div>
                    <div class="text-[10px] opacity-70">
                      Scope: {ipRow.scope} {ipRow.reason ? `· ${ipRow.reason}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblockIp(ipRow.ip)}
                    class="px-2 py-1 rounded bg-[var(--paper-3)] border border-[var(--ink-soft)]/40 hover:bg-red-600 hover:text-white font-extrabold text-[11px] cursor-pointer text-red-700"
                  >
                    Unblock
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Suspicious Logs Stream */}
      <div class="card p-4 space-y-3 bg-[var(--paper-2)]">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <AlertTriangle size={18} class="text-amber-600" />
            <h3 class="font-black text-base">Suspicious Activity Stream & Threat Detection</h3>
          </div>

          <div class="flex items-center gap-2">
            {/* Severity Filter */}
            <select
              value={severityFilter()}
              onChange={(e) => setSeverityFilter(e.currentTarget.value)}
              class="input text-xs font-bold py-1 px-2"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical only</option>
              <option value="warn">Warnings only</option>
              <option value="info">Info only</option>
            </select>

            <input
              type="text"
              value={logSearch()}
              onInput={(e) => setLogSearch(e.currentTarget.value)}
              placeholder="Search threat logs..."
              class="input text-xs font-semibold py-1 px-2 w-44"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div class="border border-[var(--ink)] rounded-md overflow-hidden bg-[var(--paper)]">
          <table class="w-full text-left text-xs">
            <thead class="bg-[var(--paper-3)] border-b border-[var(--ink)] font-black uppercase text-[var(--ink)]">
              <tr>
                <th class="p-2.5">Severity</th>
                <th class="p-2.5">Event Type</th>
                <th class="p-2.5">Action Taken</th>
                <th class="p-2.5">User Email</th>
                <th class="p-2.5">IP Address</th>
                <th class="p-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20 font-semibold font-mono">
              <For
                each={filteredSuspicious()}
                fallback={
                  <tr>
                    <td colspan={6} class="p-6 text-center font-sans font-bold opacity-60">
                      No suspicious activity detected.
                    </td>
                  </tr>
                }
              >
                {(row) => (
                  <tr class="hover:bg-[var(--paper-2)]">
                    <td class="p-2.5">
                      <span
                        class={`inline-block px-1.5 py-0.2 rounded text-[10px] font-black uppercase text-white ${
                          row.severity === "critical"
                            ? "bg-red-700"
                            : row.severity === "warn"
                              ? "bg-amber-600"
                              : "bg-blue-600"
                        }`}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td class="p-2.5 font-bold font-sans">{row.eventType}</td>
                    <td class="p-2.5 font-sans opacity-80">{row.actionTaken}</td>
                    <td class="p-2.5 font-sans truncate max-w-[150px]">
                      {row.userEmail ?? "anonymous"}
                    </td>
                    <td class="p-2.5">{row.ip ?? "-"}</td>
                    <td class="p-2.5 text-[11px] opacity-75 font-sans">
                      {/*
                        toLocaleString, not toLocaleTimeString: the latter
                        throws outright on `dateStyle` ("Invalid option"), and a
                        threat row needs the date as much as the time - an IP
                        that tripped a rule "at 14:02" is useless without
                        knowing which day.
                      */}
                      {new Date(row.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
