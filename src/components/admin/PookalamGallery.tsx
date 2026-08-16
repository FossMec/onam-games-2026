import { ExternalLink, ThumbsDown, ThumbsUp } from "lucide-solid";
import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { reviewerListPookalams, reviewerSetVerdict } from "~/server/pookalam/actions";

/**
 * The shortlisting gallery — the tester half of the Pookalam admin tab.
 *
 * Between the day-6 deadline and the day-7 arena somebody has to look at every
 * entry: check the code runs, check nothing in the image identifies its author,
 * and say which ones deserve the public round.
 *
 * Authors are not shown here even though this sits inside /admin. Testers are
 * drawn from the same club as the entrants, so a shortlist picked by people who
 * could see the names would be exactly the popularity contest the anonymous
 * round exists to avoid. The admin queue below reveals authors; this does not.
 *
 * A verdict without a reason is nearly useless to whoever picks the final ten,
 * so the comment box sits inline with the buttons rather than behind one.
 */

type Row = Awaited<ReturnType<typeof reviewerListPookalams>>[number];

export function PookalamGallery() {
  const [rows, setRows] = createSignal<Row[] | null>(null);
  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");

  const load = async () => {
    try {
      setRows(await reviewerListPookalams());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the entries.");
      setRows([]);
    }
  };

  onMount(() => void load());

  const vote = async (id: string, verdict: "like" | "dislike") => {
    setBusy(id);
    setError("");
    try {
      setRows(await reviewerSetVerdict(id, verdict, drafts()[id]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(null);
    }
  };

  const judged = createMemo(() => rows()?.filter((row) => row.myVerdict).length ?? 0);

  return (
    <section class="card space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2>Shortlisting gallery</h2>
        <Show when={rows()}>
          <span class="badge" style={{ "--pop": "var(--pop-teal)" }}>
            {judged()} / {rows()!.length} judged
          </span>
        </Show>
      </div>

      <p class="comment">
        no names, on purpose. say what you think and why — the why is what the shortlist gets picked
        on. flag anything with a watermark or a signature in it.
      </p>

      <Show when={error()}>
        <p class="font-extrabold" style={{ color: "var(--pop-red)" }}>
          {error()}
        </p>
      </Show>

      <Show when={rows()} fallback={<p class="text-sm">Loading…</p>}>
        <Show when={rows()!.length > 0} fallback={<p class="text-sm">Nothing submitted yet.</p>}>
          <div class="grid gap-3 md:grid-cols-2">
            <For each={rows()!}>
              {(row) => (
                <article
                  class="card space-y-2.5"
                  style={{
                    "--pop": row.shortlisted
                      ? "var(--pop-purple)"
                      : row.myVerdict === "like"
                        ? "var(--pop-teal)"
                        : row.myVerdict === "dislike"
                          ? "var(--pop-red)"
                          : "var(--paper-3)",
                  }}
                >
                  <img
                    src={row.imageUrl}
                    alt={row.title}
                    loading="lazy"
                    class="w-full"
                    style={{
                      "aspect-ratio": "1 / 1",
                      "object-fit": "contain",
                      background: "var(--paper-2)",
                      border: "var(--ink-w) solid var(--ink)",
                      "border-radius": "var(--radius)",
                    }}
                  />

                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="font-extrabold m-0">{row.title}</p>
                    <div class="flex items-center gap-2">
                      <Show when={row.shortlisted}>
                        <span class="badge" style={{ "--pop": "var(--pop-purple)" }}>
                          shortlisted
                        </span>
                      </Show>
                      <span class="text-sm font-extrabold tabular-nums">
                        👍 {row.likes} · 👎 {row.dislikes}
                      </span>
                    </div>
                  </div>

                  <Show when={row.notes}>
                    <p class="text-sm font-semibold">{row.notes}</p>
                  </Show>

                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    class="btn-ghost inline-flex items-center gap-1.5 text-xs"
                  >
                    <ExternalLink size={14} />
                    <span>Read the code</span>
                  </a>

                  <textarea
                    class="input"
                    rows="2"
                    maxLength={500}
                    placeholder="Why? (the shortlist gets picked on these)"
                    value={drafts()[row.id] ?? row.myComment ?? ""}
                    onInput={(e) => setDrafts({ ...drafts(), [row.id]: e.currentTarget.value })}
                  />

                  <div class="flex gap-2">
                    <button
                      type="button"
                      class={row.myVerdict === "like" ? "btn-brand" : "btn-ghost"}
                      disabled={busy() === row.id}
                      onClick={() => void vote(row.id, "like")}
                    >
                      <span class="inline-flex items-center gap-1.5">
                        <ThumbsUp size={15} />
                        Like
                      </span>
                    </button>
                    <button
                      type="button"
                      class={row.myVerdict === "dislike" ? "btn-brand" : "btn-ghost"}
                      disabled={busy() === row.id}
                      onClick={() => void vote(row.id, "dislike")}
                    >
                      <span class="inline-flex items-center gap-1.5">
                        <ThumbsDown size={15} />
                        Dislike
                      </span>
                    </button>
                  </div>

                  {/* What the other reviewers said. Named — this half is not anonymous. */}
                  <Show when={row.comments.some((entry) => entry.comment)}>
                    <div class="space-y-1 pt-1">
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
                </article>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  );
}
