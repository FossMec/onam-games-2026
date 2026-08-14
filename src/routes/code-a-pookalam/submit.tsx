import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { POOKALAM } from "~/lib/event-content";
import { getPookalamState, submitPookalam } from "~/server/pookalam/actions";

/**
 * The Code-a-Pookalam entry form.
 *
 * Entries are links, not uploads: a repo and a render. Hosting images would
 * mean object storage and a content-moderation queue for a week-long club
 * event, and a coding contest wants the source anyway.
 *
 * Editing an approved entry sends it back to review — that rule lives on the
 * server, but the page says so out loud, because a silent status change after
 * a small edit is the kind of thing that reads as a bug.
 */

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--pop-yellow)",
  approved: "var(--pop-teal)",
  rejected: "var(--pop-red)",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "waiting on review",
  approved: "in the running",
  rejected: "not accepted",
};

export default function SubmitPookalam() {
  const state = createAsync(() => getPookalamState());

  const [title, setTitle] = createSignal("");
  const [sourceUrl, setSourceUrl] = createSignal("");
  const [imageUrl, setImageUrl] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [saved, setSaved] = createSignal(false);

  /** Fills the form from the existing entry so "edit" is not "retype". */
  const loadMine = () => {
    const mine = state()?.mine;
    if (!mine) return;
    setTitle(mine.title);
    setSourceUrl(mine.sourceUrl);
    setImageUrl(mine.imageUrl);
    setNotes(mine.notes ?? "");
  };

  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await submitPookalam({
        title: title(),
        sourceUrl: sourceUrl(),
        imageUrl: imageUrl(),
        notes: notes(),
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="container space-y-8 py-6">
      <Title>Submit — {POOKALAM.title}</Title>

      <a
        href="/code-a-pookalam"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back to the rules
      </a>

      <header class="space-y-2">
        <h1>Submit your pookalam</h1>
        <p class="comment">two links and a name. we run the code.</p>
      </header>

      <Show when={state()} fallback={<p class="font-semibold">Loading…</p>}>
        <Show
          when={state()!.signedIn}
          fallback={
            <div class="card pop-yellow space-y-3">
              <p class="font-extrabold">You need to sign in first.</p>
              <a href="/auth/signin" class="btn-brand">
                Sign in
              </a>
            </div>
          }
        >
          {/* The existing entry, and its review state. */}
          <Show when={state()!.mine}>
            <div class="card space-y-2" style={{ "--pop": STATUS_COLOR[state()!.mine!.status] }}>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-extrabold">{state()!.mine!.title}</p>
                <span class="badge" style={{ "--pop": STATUS_COLOR[state()!.mine!.status] }}>
                  {STATUS_LABEL[state()!.mine!.status]}
                </span>
              </div>
              <Show when={state()!.mine!.reviewNote}>
                <p class="font-semibold">{state()!.mine!.reviewNote}</p>
              </Show>
              <Show when={state()!.gates.submissionsOpen}>
                <button type="button" class="btn-ghost" onClick={loadMine}>
                  Edit this entry
                </button>
              </Show>
            </div>
          </Show>

          <Show
            when={state()!.gates.submissionsOpen}
            fallback={
              <Bubble color="var(--paper-3)">
                <p class="font-semibold">
                  Submissions are closed right now.{" "}
                  <Show
                    when={state()!.mine}
                    fallback="Check back — the form opens before the deadline."
                  >
                    Yours is already in.
                  </Show>
                </p>
              </Bubble>
            }
          >
            <form class="card card-plain space-y-4" onSubmit={onSubmit}>
              <label class="block space-y-1">
                <span class="font-extrabold">Title</span>
                <input
                  class="input"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  maxLength={80}
                  required
                  placeholder="Recursive Thumba"
                />
              </label>

              <label class="block space-y-1">
                <span class="font-extrabold">GitHub Repository Link</span>
                <input
                  class="input"
                  type="url"
                  value={sourceUrl()}
                  onInput={(e) => setSourceUrl(e.currentTarget.value)}
                  required
                  placeholder="https://github.com/username/pookalam"
                />
                <span class="comment">
                  GitHub repository or GitHub Gist link only. Include your source code and how to
                  run it.
                </span>
              </label>

              <label class="block space-y-1">
                <span class="font-extrabold">Image link</span>
                <input
                  class="input"
                  type="url"
                  value={imageUrl()}
                  onInput={(e) => setImageUrl(e.currentTarget.value)}
                  required
                  placeholder="https://…/pookalam.png"
                />
                <span class="comment">
                  a render of the output. this is the only thing voters see, so make it the good
                  one.
                </span>
              </label>

              <label class="block space-y-1">
                <span class="font-extrabold">Anything we should know? (optional)</span>
                <textarea
                  class="input"
                  rows="3"
                  value={notes()}
                  onInput={(e) => setNotes(e.currentTarget.value)}
                  maxLength={500}
                  placeholder="How to run it, what's going on in there, which bit you're proud of."
                />
              </label>

              <p class="comment">
                editing an entry sends it back for review. that is on purpose — approving a design
                and then having the link change would make review pointless.
              </p>

              <Show when={error()}>
                <p class="font-extrabold" style={{ color: "var(--pop-red)" }}>
                  {error()}
                </p>
              </Show>
              <Show when={saved()}>
                <p class="font-extrabold" style={{ color: "var(--pop-teal)" }}>
                  Saved. It's in the review queue.
                </p>
              </Show>

              <button type="submit" class="btn-brand" disabled={busy()}>
                {busy() ? "Saving…" : state()!.mine ? "Update entry" : "Submit entry"}
              </button>
            </form>
          </Show>
        </Show>
      </Show>
    </main>
  );
}
