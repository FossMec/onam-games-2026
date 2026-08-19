import { Heart, MessageSquare, RefreshCw, Trash2 } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { adminDeleteCollabMessageAction } from "~/server/admin/actions";

export interface CollabMessageRow {
  id: string;
  dayKey: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  message: string;
  likesCount: number;
  createdAt: Date;
}

interface CollabWishesTabProps {
  messages: CollabMessageRow[];
  onReload: () => void;
  onNotify: (msg: string) => void;
}

export function CollabWishesTab(props: CollabWishesTabProps) {
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  const handleDelete = async (msg: CollabMessageRow) => {
    setDeletingId(msg.id);
    try {
      const result = await adminDeleteCollabMessageAction(msg.id);
      if (result.ok) {
        props.onNotify(`Deleted wish from ${msg.userName}`);
        props.onReload();
      } else {
        props.onNotify(result.reason ?? "Failed to delete");
      }
    } catch (err) {
      props.onNotify(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (d: Date) =>
    new Date(d).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-xl font-black">Community Onam Wishes</h2>
          <p class="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
            All community wishes posted alongside the collab pookalam. Delete any inappropriate
            content here.
          </p>
        </div>
        <div class="font-mono text-xs font-black px-2.5 py-1 rounded bg-[var(--paper-2)] border border-[var(--ink)]">
          {props.messages.length} wishes
        </div>
      </div>

      {/* Empty state */}
      <Show when={props.messages.length === 0}>
        <div class="card card-plain p-10 text-center space-y-2">
          <MessageSquare size={32} class="mx-auto text-[var(--ink-soft)]" />
          <p class="font-bold text-sm text-[var(--ink-soft)]">No community wishes yet.</p>
        </div>
      </Show>

      {/* Message list */}
      <div class="space-y-2">
        <For each={props.messages}>
          {(msg) => (
            <div class="card card-plain p-3 bg-[var(--paper)] border-2 border-[var(--ink)] flex items-start gap-3">
              {/* Avatar */}
              <div class="shrink-0 w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper-3)]">
                <Show
                  when={msg.userAvatar}
                  fallback={
                    <div class="w-full h-full flex items-center justify-center text-xs font-black text-[var(--ink-soft)]">
                      {msg.userName.slice(0, 1).toUpperCase()}
                    </div>
                  }
                >
                  <img
                    src={msg.userAvatar!}
                    alt={msg.userName}
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </Show>
              </div>

              {/* Content */}
              <div class="flex-1 min-w-0 space-y-0.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-black text-xs text-[var(--ink)] truncate">{msg.userName}</span>
                  <span
                    class="font-mono text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{ background: "var(--paper-2)", color: "var(--ink-soft)" }}
                  >
                    {msg.dayKey}
                  </span>
                  <span class="text-[9px] font-semibold text-[var(--ink-soft)]">
                    {fmt(msg.createdAt)}
                  </span>
                </div>
                <p class="text-sm font-semibold text-[var(--ink)] leading-snug break-words">
                  "{msg.message}"
                </p>
                <div class="flex items-center gap-1 text-[10px] font-black text-[var(--ink-soft)]">
                  <Heart size={10} />
                  <span>{msg.likesCount} likes</span>
                </div>
              </div>

              {/* Delete */}
              <button
                type="button"
                onClick={() => handleDelete(msg)}
                disabled={deletingId() === msg.id}
                class="shrink-0 p-1.5 rounded border-2 border-[var(--ink-soft)]/30 hover:border-[var(--pop-red)] hover:bg-[var(--pop-red)]/10 hover:text-[var(--pop-red)] text-[var(--ink-soft)] transition-all cursor-pointer disabled:opacity-40"
                title={`Delete wish from ${msg.userName}`}
              >
                <Show
                  when={deletingId() !== msg.id}
                  fallback={<RefreshCw size={13} class="animate-spin" />}
                >
                  <Trash2 size={13} />
                </Show>
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
