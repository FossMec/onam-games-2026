import { Title } from "@solidjs/meta";
import { createAsync } from "@solidjs/router";
import { ImageUp, Lock, TriangleAlert } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Bubble } from "~/components/art/Burst";
import { Countdown } from "~/components/Countdown";
import { POOKALAM } from "~/lib/event-content";
import { ImageRejected, preparePookalamImage } from "~/lib/pookalam-image";
import { getPookalamState, submitPookalam } from "~/server/pookalam/actions";

/**
 * The Code-a-Pookalam entry form.
 *
 * The form does not exist until the window opens. Before that the page is a
 * countdown, and there is deliberately no disabled-but-present submit button -
 * a greyed-out control invites people to keep poking it and then to email
 * asking why it does not work.
 *
 * The image is validated and downscaled in the browser before it is sent (see
 * `preparePookalamImage`) so a wrong-shaped render fails in the file picker
 * rather than after a slow upload. The server re-checks everything; this is the
 * fast copy of the rule, not the authority.
 */

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--pop-yellow)",
  approved: "var(--pop-teal)",
  rejected: "var(--pop-red)",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "waiting on review",
  approved: "accepted",
  rejected: "not accepted",
};

/**
 * The rules that decide whether an entry can be shown in the anonymous round.
 *
 * First two are hard: a signature or a watermark in the corner turns the day-7
 * arena from a judgement of pookalams into a popularity contest, and there is
 * no way to fix that after the fact except by disqualifying the entry.
 */
const IMAGE_RULES = [
  "No name, handle, watermark, signature or logo anywhere in the image. Day 7 voting is anonymous, and anything that identifies you gets the entry pulled.",
  "Square, 1:1. We check before uploading - a 16:9 screenshot will be refused.",
  "At least 320×320. We downscale to 1024×1024 and re-encode, which also strips the EXIF data off a photo.",
  "The render must be the output of your code. Not a photo of a real pookalam, not a raw image generation.",
];

export default function SubmitPookalam() {
  const state = createAsync(() => getPookalamState());

  const [title, setTitle] = createSignal("");
  const [sourceUrl, setSourceUrl] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [preview, setPreview] = createSignal("");
  const [imageDataUrl, setImageDataUrl] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [preparing, setPreparing] = createSignal(false);
  const [error, setError] = createSignal("");
  const [saved, setSaved] = createSignal(false);

  const submissions = () => state()?.phases.submissions;
  const opensAt = () => {
    const value = submissions()?.opensAt;
    return value ? new Date(value) : null;
  };
  const closesAt = () => {
    const value = submissions()?.closesAt;
    return value ? new Date(value) : null;
  };

  /** Fills the form from the existing entry so "edit" is not "retype". */
  const loadMine = () => {
    const mine = state()?.mine;
    if (!mine) return;
    setTitle(mine.title);
    setSourceUrl(mine.sourceUrl);
    setNotes(mine.notes ?? "");
    setPreview(mine.imageUrl);
    // Left empty on purpose: no new bytes means the server keeps the stored
    // artwork rather than re-uploading what it already has.
    setImageDataUrl("");
  };

  const onPickFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setPreparing(true);
    setError("");
    try {
      const prepared = await preparePookalamImage(file, state()?.aspectTolerancePct ?? 5);
      setImageDataUrl(prepared.dataUrl);
      setPreview(prepared.dataUrl);
    } catch (cause) {
      // Everything `preparePookalamImage` throws is already worded for the
      // entrant, so it goes straight through rather than being flattened.
      setError(
        cause instanceof ImageRejected
          ? cause.message
          : "Could not read that image. Try a PNG or WebP.",
      );
      input.value = "";
    } finally {
      setPreparing(false);
    }
  };

  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!imageDataUrl() && !state()?.mine) {
      setError("Upload a square render of your pookalam.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await submitPookalam({
        title: title(),
        sourceUrl: sourceUrl(),
        imageDataUrl: imageDataUrl() || undefined,
        notes: notes(),
      });
      setSaved(true);
      setImageDataUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="container space-y-8 py-6">
      <Title>Submit - {POOKALAM.title}</Title>

      <a
        href="/code-a-pookalam"
        class="inline-block text-sm font-extrabold underline decoration-2 underline-offset-4"
      >
        ← Back to the rules
      </a>

      <header class="space-y-2">
        <h1>Submit your pookalam</h1>
        <p class="comment">a repo, a render, a name. we run the code.</p>
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
          {/* The existing entry, and where it stands. */}
          <Show when={state()!.mine}>
            <div class="card space-y-2" style={{ "--pop": STATUS_COLOR[state()!.mine!.status] }}>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-extrabold">{state()!.mine!.title}</p>
                <div class="flex flex-wrap items-center gap-2">
                  <Show when={state()!.mine!.shortlisted}>
                    <span class="badge" style={{ "--pop": "var(--pop-purple)" }}>
                      shortlisted for Day 7
                    </span>
                  </Show>
                  <span class="badge" style={{ "--pop": STATUS_COLOR[state()!.mine!.status] }}>
                    {STATUS_LABEL[state()!.mine!.status]}
                  </span>
                </div>
              </div>
              <img
                src={state()!.mine!.imageUrl}
                alt={state()!.mine!.title}
                class="w-full max-w-[14rem]"
                style={{
                  "aspect-ratio": "1 / 1",
                  "object-fit": "contain",
                  background: "var(--paper-2)",
                  border: "var(--ink-w) solid var(--ink)",
                  "border-radius": "var(--radius)",
                }}
              />
              <Show when={state()!.mine!.reviewNote}>
                <p class="font-semibold">{state()!.mine!.reviewNote}</p>
              </Show>
              <Show when={submissions()?.open}>
                <button type="button" class="btn-ghost" onClick={loadMine}>
                  Edit this entry
                </button>
              </Show>
            </div>
          </Show>

          <Show
            when={submissions()?.open}
            fallback={
              <ClosedNotice
                reason={submissions()?.reason ?? "unscheduled"}
                opensAt={opensAt()}
                hasEntry={!!state()!.mine}
              />
            }
          >
            {/* The deadline, loud, while the form is actually usable. */}
            <Show when={closesAt()}>
              <div class="card pop-red space-y-2 text-center">
                <p class="text-xs uppercase font-extrabold" style={{ opacity: 0.8 }}>
                  Submissions close in
                </p>
                <Countdown target={closesAt()!} doneLabel="Submissions are closed" />
              </div>
            </Show>

            <section class="card pop-blue space-y-2">
              <div class="flex items-center gap-2">
                <TriangleAlert size={18} />
                <h2 class="text-base font-black m-0">Rules for the render</h2>
              </div>
              <ul class="space-y-1.5">
                <For each={IMAGE_RULES}>
                  {(rule) => (
                    <li class="flex items-start gap-2 text-xs sm:text-sm font-semibold leading-relaxed">
                      <span class="font-black shrink-0" style={{ color: "var(--pop-pink)" }}>
                        ▸
                      </span>
                      <span>{rule}</span>
                    </li>
                  )}
                </For>
              </ul>
            </section>

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
                <span class="comment">
                  voters see this. keep your name out of it - it is shown next to the image during
                  anonymous voting.
                </span>
              </label>

              <label class="block space-y-1">
                <span class="font-extrabold">Repository link</span>
                <input
                  class="input"
                  type="url"
                  value={sourceUrl()}
                  onInput={(e) => setSourceUrl(e.currentTarget.value)}
                  required
                  placeholder="https://github.com/username/pookalam"
                />
                <span class="comment">
                  GitHub, a Gist, GitLab, Codeberg, CodePen or similar. Include the source and how
                  to run it. Nobody sees this until results are out.
                </span>
              </label>

              <div class="space-y-2">
                <span class="font-extrabold">Your render</span>
                <div class="flex flex-wrap items-start gap-4">
                  <Show
                    when={preview()}
                    fallback={
                      <div
                        class="flex w-40 items-center justify-center"
                        style={{
                          "aspect-ratio": "1 / 1",
                          background: "var(--paper-2)",
                          border: "var(--ink-w) dashed var(--ink)",
                          "border-radius": "var(--radius)",
                        }}
                      >
                        <ImageUp size={28} style={{ opacity: 0.5 }} />
                      </div>
                    }
                  >
                    <img
                      src={preview()}
                      alt="Your pookalam"
                      class="w-40"
                      style={{
                        "aspect-ratio": "1 / 1",
                        "object-fit": "contain",
                        background: "var(--paper-2)",
                        border: "var(--ink-w) solid var(--ink)",
                        "border-radius": "var(--radius)",
                      }}
                    />
                  </Show>
                  <div class="flex-1 space-y-1 min-w-[12rem]">
                    <input
                      class="input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void onPickFile(e)}
                    />
                    <span class="comment">
                      {preparing()
                        ? "checking the shape…"
                        : "square png, jpeg or webp. we resize it for you."}
                    </span>
                  </div>
                </div>
              </div>

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
                editing an entry sends it back for review and takes it off the shortlist. that is on
                purpose - approving a design and then having the image change would make review
                pointless.
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

              <button type="submit" class="btn-brand" disabled={busy() || preparing()}>
                {busy() ? "Saving…" : state()!.mine ? "Update entry" : "Submit entry"}
              </button>
            </form>
          </Show>
        </Show>
      </Show>
    </main>
  );
}

/**
 * What the page is when there is no form.
 *
 * Three genuinely different situations, and collapsing them into "closed" is
 * how you get a stream of "is it broken?" messages: not open yet (here is the
 * countdown), deadline passed (nothing to do), and no dates configured at all
 * (which only happens before we have announced them).
 */
function ClosedNotice(props: { reason: string; opensAt: Date | null; hasEntry: boolean }) {
  return (
    <Show
      when={props.reason === "not_yet" && props.opensAt}
      fallback={
        <Bubble color="var(--paper-3)">
          <p class="font-semibold">
            <Show
              when={props.reason === "over"}
              fallback="Submissions aren't open yet. Dates go up here as soon as they're set."
            >
              Submissions have closed.{" "}
              <Show when={props.hasEntry} fallback="Voting is next - come back for Day 7.">
                Yours is in. Watch for the shortlist.
              </Show>
            </Show>
          </p>
        </Bubble>
      }
    >
      <div class="card pop-yellow space-y-3 text-center">
        <div class="flex items-center justify-center gap-2">
          <Lock size={18} />
          <p class="font-extrabold m-0">The entry form opens in</p>
        </div>
        <Countdown target={props.opensAt!} doneLabel="Submissions are open - refresh!" />
        <p class="comment">
          start coding now. you'll want the time - {POOKALAM.submitBy.toLowerCase()} is the
          deadline.
        </p>
      </div>
    </Show>
  );
}
