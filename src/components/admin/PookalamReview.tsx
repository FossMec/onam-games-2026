import { For, Show, createSignal, onMount } from "solid-js";
import { adminListPookalams, adminReviewPookalam } from "~/server/pookalam/actions";

/**
 * Code-a-Pookalam review queue.
 *
 * Approval is a real gate, not a formality: an entry only enters the voting
 * pairing once it is approved, and both links here are user-supplied URLs
 * pointed at by pages every voter loads. Somebody has to look at them.
 *
 * Its own component rather than another block in the 475-line admin page —
 * this has its own loading and mutation state and would otherwise tangle with
 * the shared `run`/`reload` plumbing there.
 */

type Row = Awaited<ReturnType<typeof adminListPookalams>>[number];

const STATUS_POP: Record<string, string> = {
  pending: "var(--pop-yellow)",
  approved: "var(--pop-teal)",
  rejected: "var(--pop-red)",
};

export function PookalamReview() {
  const [rows, setRows] = createSignal<Row[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [note, setNote] = createSignal<Record<string, string>>({});
  const [page, setPage] = createSignal(0);

  const load = async (pageNumber = page()) => {
    try {
      setRows(await adminListPookalams(pageNumber));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load submissions.");
    }
  };

  onMount(() => void load());

  const changePage = async (next: number) => {
    if (next < 0) return;
    setPage(next);
    await load(next);
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    setBusy(true);
    setError("");
    try {
      setRows(await adminReviewPookalam(id, status, note()[id]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  const pending = () => rows().filter((row) => row.status === "pending").length;

  return (
    <section class="card space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2>Code-a-Pookalam</h2>
        <span class="badge" style={{ "--pop": pending() ? "var(--pop-yellow)" : "var(--paper-3)" }}>
          {pending()} awaiting review
        </span>
      </div>

      <Show when={error()}>
        <p class="font-extrabold" style={{ color: "var(--pop-red)" }}>
          {error()}
        </p>
      </Show>

      <Show when={rows().length > 0} fallback={<p class="text-sm">No submissions yet.</p>}>
        <div class="space-y-3">
          <For each={rows()}>
            {(row) => (
              <div
                class="card space-y-2 sm:flex sm:items-start sm:gap-3 sm:space-y-0"
                style={{ "--pop": STATUS_POP[row.status] }}
              >
                {/*
                  Loaded from a URL the entrant chose, so it may well be broken
                  or enormous. Constrained hard and lazily loaded — the review
                  queue must stay usable when half the links are dead.
                */}
                <img
                  src={row.imageUrl}
                  alt={row.title}
                  loading="lazy"
                  class="w-full sm:w-32 sm:shrink-0"
                  style={{
                    "aspect-ratio": "1 / 1",
                    "object-fit": "contain",
                    background: "var(--paper-2)",
                    border: "var(--ink-w) solid var(--ink)",
                  }}
                />
                <div class="w-full space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="badge" style={{ "--pop": STATUS_POP[row.status] }}>
                      {row.status}
                    </span>
                    <p class="font-extrabold">{row.title}</p>
                    <span class="text-sm">by {row.authorName}</span>
                  </div>

                  <Show when={row.notes}>
                    <p class="text-sm">{row.notes}</p>
                  </Show>

                  <p class="text-sm">
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      class="underline decoration-2 underline-offset-4"
                    >
                      {row.sourceUrl}
                    </a>
                  </p>

                  <p class="text-sm">
                    Elo {Math.round(row.rating)} · {row.wins}/{row.matches} won
                  </p>

                  <Show when={row.reviewNote}>
                    <p class="comment">{row.reviewNote}</p>
                  </Show>

                  <div class="flex flex-wrap gap-2">
                    <input
                      class="input flex-1"
                      placeholder="Note to the entrant (optional)"
                      value={note()[row.id] ?? ""}
                      onInput={(e) => setNote({ ...note(), [row.id]: e.currentTarget.value })}
                    />
                    <button
                      type="button"
                      class="btn-brand"
                      disabled={busy() || row.status === "approved"}
                      onClick={() => void review(row.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="btn-ghost"
                      disabled={busy() || row.status === "rejected"}
                      onClick={() => void review(row.id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          class="btn-ghost text-xs"
          disabled={page() === 0 || busy()}
          onClick={() => void changePage(page() - 1)}
        >
          Previous
        </button>
        <span class="text-xs font-bold">Page {page() + 1}</span>
        <button
          type="button"
          class="btn-ghost text-xs"
          disabled={rows().length < 50 || busy()}
          onClick={() => void changePage(page() + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
