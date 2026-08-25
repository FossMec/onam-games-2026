import { Eye, Search, Trash2, X } from "lucide-solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { purgeThreatLogsAction } from "~/server/admin/actions";

export interface ActivityRow {
  id: string;
  eventType: string;
  meta: unknown;
  ip: string | null;
  userEmail: string | null;
  createdAt: Date | string;
}

interface LogsTabProps {
  logs: ActivityRow[];
  onReload?: () => void;
  onNotify?: (msg: string) => void;
}

export function LogsTab(props: LogsTabProps) {
  const [search, setSearch] = createSignal("");
  const [typeFilter, setTypeFilter] = createSignal<string>("all");
  const [selectedLog, setSelectedLog] = createSignal<ActivityRow | null>(null);
  const [busy, setBusy] = createSignal(false);

  const handlePurge = async () => {
    if (!confirm("Are you sure you want to permanently clear all activity and threat logs?"))
      return;
    setBusy(true);
    try {
      await purgeThreatLogsAction();
      props.onNotify?.("All logs purged and database storage reclaimed");
      props.onReload?.();
    } catch (err) {
      props.onNotify?.(err instanceof Error ? err.message : "Failed to purge logs");
    } finally {
      setBusy(false);
    }
  };

  const eventTypes = createMemo(() => {
    return Array.from(new Set(props.logs.map((l) => l.eventType)));
  });

  const filteredLogs = createMemo(() => {
    const q = search().toLowerCase().trim();
    const type = typeFilter();

    return props.logs.filter((l) => {
      if (type !== "all" && l.eventType !== type) return false;
      if (q) {
        const matchEmail = (l.userEmail ?? "").toLowerCase().includes(q);
        const matchIp = (l.ip ?? "").toLowerCase().includes(q);
        const matchType = l.eventType.toLowerCase().includes(q);
        const matchMeta = JSON.stringify(l.meta ?? "")
          .toLowerCase()
          .includes(q);
        if (!matchEmail && !matchIp && !matchType && !matchMeta) return false;
      }
      return true;
    });
  });

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Audit & Activity Logs</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            Real-time audit log of user logins, game starts, score submissions, and admin actions.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <div class="font-mono text-xs font-black px-2.5 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
            {filteredLogs().length} / {props.logs.length} Events
          </div>
          <button
            type="button"
            onClick={handlePurge}
            disabled={busy()}
            class="btn-ghost text-xs px-2.5 py-1 text-red-700 hover:bg-red-100 border border-red-300 font-extrabold inline-flex items-center gap-1 cursor-pointer"
            title="Clear all activity logs to reclaim database space"
          >
            <Trash2 size={13} />
            <span>Purge Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div class="card card-plain p-3 bg-[var(--paper-2)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="relative w-full sm:w-80">
          <Search
            size={15}
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <input
            type="text"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
            placeholder="Search activity events, emails, IPs, metadata..."
            class="input w-full pl-8 text-xs font-semibold"
          />
        </div>

        <div class="w-full sm:w-auto">
          <select
            value={typeFilter()}
            onChange={(e) => setTypeFilter(e.currentTarget.value)}
            class="input w-full text-xs font-bold"
          >
            <option value="all">All Event Types</option>
            <For each={eventTypes()}>{(t) => <option value={t}>{t}</option>}</For>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div class="card card-plain p-0 overflow-hidden bg-[var(--paper)]">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-[var(--paper-2)] border-b-2 border-[var(--ink)] font-black uppercase text-[var(--ink)]">
              <tr>
                <th class="p-3">Event Type</th>
                <th class="p-3">User</th>
                <th class="p-3">IP Address</th>
                <th class="p-3">Event Details / Metadata</th>
                <th class="p-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--ink-soft)]/20 font-semibold font-mono">
              <For
                each={filteredLogs()}
                fallback={
                  <tr>
                    <td colspan={5} class="p-8 text-center font-sans font-bold opacity-70">
                      No activity logs recorded.
                    </td>
                  </tr>
                }
              >
                {(log) => (
                  <tr class="hover:bg-[var(--paper-2)] transition-colors">
                    <td class="p-3">
                      <span class="px-2 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--ink)] font-bold text-[11px]">
                        {log.eventType}
                      </span>
                    </td>
                    <td class="p-3 font-sans font-extrabold text-[var(--ink)]">
                      {log.userEmail ?? "anonymous"}
                    </td>
                    <td class="p-3 opacity-80">{log.ip ?? "-"}</td>

                    {/* Formatted Metadata Cell */}
                    <td class="p-3 font-sans max-w-sm">
                      <MetadataPreview meta={log.meta} onExpand={() => setSelectedLog(log)} />
                    </td>

                    <td class="p-3 text-right font-sans text-[11px] opacity-75 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Metadata Inspector Modal */}
      <Show when={selectedLog()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div class="relative w-full max-w-lg card p-5 bg-[var(--paper-2)] border-2 border-[var(--ink)] shadow-xl space-y-3">
            <div class="flex items-center justify-between pb-2 border-b-2 border-[var(--ink)]">
              <div>
                <h3 class="text-base font-black">Event Metadata Details</h3>
                <p class="text-xs font-mono text-[var(--ink-soft)]">
                  {selectedLog()!.eventType} · {selectedLog()!.userEmail ?? "anonymous"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                class="btn-ghost p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <pre class="p-3 rounded bg-[var(--paper)] border border-[var(--ink)] text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-80">
              {JSON.stringify(selectedLog()!.meta, null, 2)}
            </pre>

            <div class="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                class="btn-brand text-xs px-4 py-1.5 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

function MetadataPreview(props: { meta: unknown; onExpand: () => void }) {
  if (!props.meta || typeof props.meta !== "object") {
    return <span class="opacity-60 text-xs">-</span>;
  }

  const entries = Object.entries(props.meta as Record<string, unknown>);
  if (entries.length === 0) return <span class="opacity-60 text-xs">-</span>;

  return (
    <div class="flex items-center gap-1.5 flex-wrap">
      <For each={entries.slice(0, 3)}>
        {([key, val]) => (
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--paper-2)] border border-[var(--ink-soft)]/40 text-[11px] font-mono">
            <span class="opacity-60">{key}:</span>
            <span class="font-bold truncate max-w-[120px]">
              {typeof val === "string" || typeof val === "number" || typeof val === "boolean"
                ? String(val)
                : JSON.stringify(val)}
            </span>
          </span>
        )}
      </For>

      <button
        type="button"
        onClick={props.onExpand}
        class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--paper-3)] border border-[var(--ink-soft)]/50 hover:bg-[var(--pop-yellow)] hover:border-[var(--ink)] cursor-pointer transition-all inline-flex items-center gap-0.5"
        title="View Full JSON"
      >
        <Eye size={10} />
        <span>{entries.length > 3 ? `+${entries.length - 3} more` : "raw"}</span>
      </button>
    </div>
  );
}
