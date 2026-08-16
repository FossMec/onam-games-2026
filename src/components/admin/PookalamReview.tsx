import { RefreshCw, Scale, Sparkles, Star, ThumbsDown, ThumbsUp } from "lucide-solid";
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import {
  adminAdjustRating,
  adminAutoShortlist,
  adminListPookalams,
  adminReviewPookalam,
  adminSetShortlisted,
} from "~/server/pookalam/actions";

/**
 * Code-a-Pookalam review and shortlisting.
 *
 * Two separate decisions, which is why there are two sets of controls:
 *
 *   approve / reject   is this a real, on-brief, anonymous-safe entry?
 *   shortlist          is it one of the N the public actually votes between?
 *
 * Only shortlisted entries enter the day-7 pairing. That split is what keeps
 * the arena from being 60 entries deep, which no voter would ever get through
 * and which would leave every rating built on three matches.
 *
 * Tester verdicts are shown inline as the evidence for the second decision.
 * "Shortlist the top N" seeds the list from them in one click, and is then
 * meant to be edited by hand — a jury decision made purely by counting taps
 * from six testers is not a jury decision.
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
  const [shortlistCount, setShortlistCount] = createSignal(10);
  const [message, setMessage] = createSignal("");
  const [delta, setDelta] = createSignal<Record<string, string>>({});
  const [reason, setReason] = createSignal<Record<string, string>>({});

  const load = async () => {
    try {
      setRows(await adminListPookalams());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load submissions.");
    }
  };

  onMount(() => void load());

  const run = async (work: () => Promise<Row[]>) => {
    setBusy(true);
    setError("");
    try {
      setRows(await work());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  const review = (id: string, status: "approved" | "rejected") =>
    run(() => adminReviewPookalam(id, status, note()[id]));

  const shortlist = (id: string, next: boolean) => run(() => adminSetShortlisted(id, next));

  const adjust = async (id: string) => {
    const points = Number(delta()[id]);
    if (!Number.isFinite(points) || points === 0) {
      setError("Enter a non-zero number of points.");
      return;
    }
    await run(() => adminAdjustRating(id, points, reason()[id] ?? ""));
    setDelta({ ...delta(), [id]: "" });
    setReason({ ...reason(), [id]: "" });
  };

  /** Cancels an existing correction by applying its exact negative. */
  const undoAdjust = (id: string, current: number) =>
    run(() => adminAdjustRating(id, -current, "Reset to raw crowd Elo"));

  const autoPick = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminAutoShortlist(shortlistCount());
      setRows(result.rows);
      setMessage(`Shortlisted ${result.picked}. Edit it by hand from here.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not shortlist.");
    } finally {
      setBusy(false);
    }
  };

  const pending = createMemo(() => rows().filter((row) => row.status === "pending").length);
  const shortlisted = createMemo(() => rows().filter((row) => row.shortlisted).length);

  return (
    <section class="card space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2>Code-a-Pookalam</h2>
        <div class="flex flex-wrap items-center gap-2">
          {/* Ratings move as the crowd votes, so the numbers here go stale. */}
          <button
            type="button"
            class="btn-ghost text-xs inline-flex items-center gap-1.5"
            disabled={busy()}
            onClick={() => void load()}
          >
            <RefreshCw size={13} strokeWidth={2.5} />
            <span>Refresh</span>
          </button>
          <span class="badge" style={{ "--pop": "var(--pop-purple)" }}>
            {shortlisted()} shortlisted
          </span>
          <span
            class="badge"
            style={{ "--pop": pending() ? "var(--pop-yellow)" : "var(--paper-3)" }}
          >
            {pending()} awaiting review
          </span>
        </div>
      </div>

      {/* Seed the shortlist from tester verdicts, then edit by hand. */}
      <div class="card card-plain flex flex-wrap items-end gap-2">
        <label class="space-y-1">
          <span class="text-xs font-extrabold block">Shortlist size</span>
          <input
            class="input w-24"
            type="number"
            min="1"
            max="64"
            value={shortlistCount()}
            onInput={(e) => setShortlistCount(Number(e.currentTarget.value) || 10)}
          />
        </label>
        <button
          type="button"
          class="btn-brand inline-flex items-center gap-1.5"
          disabled={busy()}
          onClick={() => void autoPick()}
        >
          <Sparkles size={15} />
          <span>Shortlist top N by tester votes</span>
        </button>
        <p class="comment basis-full">
          replaces the whole shortlist, ranked by likes minus dislikes. a starting point — check it
          entry by entry before voting opens.
        </p>
      </div>

      <Show when={message()}>
        <p class="font-extrabold" style={{ color: "var(--pop-teal)" }}>
          {message()}
        </p>
      </Show>
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
                style={{ "--pop": row.shortlisted ? "var(--pop-purple)" : STATUS_POP[row.status] }}
              >
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
                    <Show when={row.shortlisted}>
                      <span class="badge" style={{ "--pop": "var(--pop-purple)" }}>
                        shortlisted
                      </span>
                    </Show>
                    <span class="badge" style={{ "--pop": STATUS_POP[row.status] }}>
                      {row.status}
                    </span>
                    <p class="font-extrabold m-0">{row.title}</p>
                    <span class="text-sm">
                      by {row.authorName} · {row.authorEmail}
                    </span>
                  </div>

                  <p class="text-sm font-extrabold inline-flex flex-wrap items-center gap-3">
                    <span class="inline-flex items-center gap-1">
                      <ThumbsUp size={14} /> {row.likes}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <ThumbsDown size={14} /> {row.dislikes}
                    </span>
                    {/*
                      Crowd Elo and the correction shown apart, never as one
                      total — the point of keeping them in separate columns is
                      that anyone reading this can see a human moved it.
                    */}
                    <span class="font-mono tabular-nums" style={{ opacity: 0.75 }}>
                      Elo {row.rating}
                      <Show when={row.adjustment !== 0}>
                        <span style={{ color: "var(--pop-red)" }}>
                          {" "}
                          {row.adjustment > 0 ? "+" : ""}
                          {row.adjustment}
                        </span>
                        {" = "}
                        <span class="font-black">{row.effectiveRating}</span>
                      </Show>
                    </span>
                    <span class="font-mono tabular-nums" style={{ opacity: 0.6 }}>
                      {row.wins}/{row.matches} won
                    </span>
                  </p>

                  <Show when={row.adjustmentNote}>
                    <p class="text-xs font-semibold m-0" style={{ color: "var(--pop-red)" }}>
                      adjustment: {row.adjustmentNote}
                    </p>
                  </Show>

                  {/* Score correction. Reason required — it goes to activity_logs. */}
                  <div class="flex flex-wrap items-center gap-2">
                    <input
                      class="input w-20 font-mono text-xs"
                      type="number"
                      step="10"
                      placeholder="±pts"
                      value={delta()[row.id] ?? ""}
                      onInput={(e) => setDelta({ ...delta(), [row.id]: e.currentTarget.value })}
                    />
                    <input
                      class="input flex-1 min-w-[10rem] text-xs"
                      placeholder="Reason (required, recorded)"
                      value={reason()[row.id] ?? ""}
                      onInput={(e) => setReason({ ...reason(), [row.id]: e.currentTarget.value })}
                    />
                    <button
                      type="button"
                      class="btn-ghost text-xs inline-flex items-center gap-1.5"
                      disabled={busy()}
                      onClick={() => void adjust(row.id)}
                    >
                      <Scale size={14} />
                      Adjust
                    </button>
                    <Show when={row.adjustment !== 0}>
                      <button
                        type="button"
                        class="btn-ghost text-xs"
                        disabled={busy()}
                        title="Subtract the current adjustment, returning the entry to its raw Elo"
                        onClick={() => void undoAdjust(row.id, row.adjustment)}
                      >
                        Reset to {row.rating}
                      </button>
                    </Show>
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

                  {/* The testers' reasoning — the evidence for shortlisting. */}
                  <Show when={row.comments.some((entry) => entry.comment)}>
                    <div class="space-y-0.5">
                      <For each={row.comments.filter((entry) => entry.comment)}>
                        {(entry) => (
                          <p class="text-xs font-semibold m-0">
                            <span>{entry.verdict === "like" ? "👍" : "👎"} </span>
                            <span class="font-black">{entry.reviewerName}</span>
                            <span style={{ opacity: 0.85 }}> — {entry.comment}</span>
                          </p>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={row.reviewNote}>
                    <p class="comment">{row.reviewNote}</p>
                  </Show>

                  <div class="flex flex-wrap gap-2">
                    <input
                      class="input flex-1 min-w-[10rem]"
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
                    <button
                      type="button"
                      class={row.shortlisted ? "btn-ghost" : "btn-brand"}
                      disabled={busy() || row.status === "rejected"}
                      onClick={() => void shortlist(row.id, !row.shortlisted)}
                    >
                      <span class="inline-flex items-center gap-1.5">
                        <Star size={14} />
                        {row.shortlisted ? "Drop from shortlist" : "Shortlist"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
