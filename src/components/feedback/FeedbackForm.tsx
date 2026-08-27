import { Heart, MessageSquare, Send } from "lucide-solid";
import { Show, createSignal, onMount } from "solid-js";
import { SpriteIcon } from "~/components/art/SpriteIcon";

export interface FeedbackFormData {
  enjoyedGames: string;
  favoriteThing: string;
  changesNextYear: string;
  codePookalamExperience: string;
  codePookalamRoadmap: string;
  openSourceLearning: string;
  wantMoreFossEvents: string;
  nextEventSuggestions: string;
  learnTopics: string;
  communityPookalamExperience: string;
  batch: string;
  college: string;
  additionalNotes: string;
}

const DEFAULT_FORM: FeedbackFormData = {
  enjoyedGames: "",
  favoriteThing: "",
  changesNextYear: "",
  codePookalamExperience: "",
  codePookalamRoadmap: "",
  openSourceLearning: "",
  wantMoreFossEvents: "",
  nextEventSuggestions: "",
  learnTopics: "",
  communityPookalamExperience: "",
  batch: "",
  college: "mec",
  additionalNotes: "",
};

export interface FeedbackFormProps {
  initialData?: Partial<FeedbackFormData>;
  onSaved?: () => void;
  onDismiss?: () => void;
  isModal?: boolean;
}

export function FeedbackForm(props: FeedbackFormProps) {
  const [form, setForm] = createSignal<FeedbackFormData>({ ...DEFAULT_FORM });
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal("");

  const STORAGE_KEY = "onam_feedback_draft_v2";

  onMount(async () => {
    // 1. Try local storage draft first for immediate display
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }

    // 2. Fetch saved feedback and user profile info (batch/college) from server
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.feedback) {
          const fb = data.feedback;
          setForm((prev) => ({
            ...prev,
            enjoyedGames: fb.enjoyedGames || prev.enjoyedGames,
            favoriteThing: fb.favoriteThing || prev.favoriteThing,
            changesNextYear: fb.changesNextYear || prev.changesNextYear,
            codePookalamExperience: fb.codePookalamExperience || prev.codePookalamExperience,
            codePookalamRoadmap: fb.codePookalamRoadmap || prev.codePookalamRoadmap,
            openSourceLearning: fb.openSourceLearning || prev.openSourceLearning,
            wantMoreFossEvents: fb.wantMoreFossEvents || prev.wantMoreFossEvents,
            nextEventSuggestions: fb.nextEventSuggestions || prev.nextEventSuggestions,
            learnTopics: fb.learnTopics || prev.learnTopics,
            communityPookalamExperience:
              fb.communityPookalamExperience || prev.communityPookalamExperience,
            batch: fb.batch || data.user?.batch || prev.batch,
            college: fb.college || data.user?.college || prev.college,
            additionalNotes: fb.additionalNotes || prev.additionalNotes,
          }));
        } else if (data.user?.batch) {
          setForm((prev) => ({
            ...prev,
            batch: data.user.batch,
            college: data.user.college || prev.college,
          }));
        }
      }
    } catch {
      // offline / guest
    }
  });

  const updateField = (field: keyof FeedbackFormData, val: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: val };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isBatch30 = () => form().batch === "30";

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form()),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save feedback");
      }

      setSubmitted(true);
      try {
        localStorage.setItem("onam_feedback_completed", "true");
      } catch {
        // ignore
      }

      if (props.onSaved) {
        setTimeout(() => {
          props.onSaved?.();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving your feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="w-full relative">
      <Show when={submitted()}>
        <div
          class="card pop-teal p-6 text-center space-y-4 my-6"
          style={{
            border: "var(--ink-w-bold) solid var(--ink)",
            background: "var(--paper-2)",
          }}
        >
          <div class="flex justify-center">
            <SpriteIcon name="octocat-garland" size={48} animate="wobble" />
          </div>
          <div class="space-y-1.5">
            <h3
              class="text-xl sm:text-2xl font-black text-[var(--ink)] m-0"
              style={{ "font-family": "var(--font-stack-display)" }}
            >
              Thank you for sharing your thoughts!
            </h3>
            <p class="text-sm font-semibold text-[var(--ink-soft)] max-w-md mx-auto m-0">
              Your feedback helps FOSS MEC craft even better events, games, and workshops for
              everyone. You can return anytime to update your responses.
            </p>
          </div>

          <div class="pt-2 flex justify-center gap-3">
            <Show when={props.onDismiss}>
              <button
                type="button"
                onClick={props.onDismiss}
                class="btn-brand px-6 py-2.5 font-black text-sm cursor-pointer"
              >
                Continue
              </button>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!submitted()}>
        <form onSubmit={handleSubmit} class="space-y-6">
          {/* Intro Card */}
          <div
            class="rounded-xl p-4 sm:p-5 relative overflow-hidden"
            style={{
              background: "var(--pop-yellow)",
              border: "var(--ink-w-bold) solid var(--ink)",
            }}
          >
            <div class="flex items-start gap-3">
              <div class="shrink-0 mt-0.5">
                <SpriteIcon name="maveli-laptop" size={40} animate="float" interactive />
              </div>
              <div class="space-y-1">
                <span
                  class="badge text-[10px] font-black uppercase tracking-wider"
                  style={{ "--pop": "var(--paper)" }}
                >
                  FOSS MEC · Community Voice
                </span>
                <h2
                  class="text-lg sm:text-2xl font-black text-[var(--ink)] leading-tight m-0"
                  style={{ "font-family": "var(--font-stack-display)" }}
                >
                  Tell us what you like about Onam Games
                </h2>
                <p class="text-xs sm:text-sm font-bold text-[var(--ink)] opacity-90 m-0">
                  No mandatory questions and no pressure. Share your honest thoughts to help us
                  shape next year's games and workshops.
                </p>
              </div>
            </div>
          </div>

          {/* FIRST YEARS (MEC '30) SPECIAL CARD - Rendered automatically if batch is 30 */}
          <Show when={isBatch30()}>
            <div
              class="rounded-xl p-4 sm:p-5 space-y-3 relative overflow-hidden"
              style={{
                background: "var(--paper-3)",
                border: "var(--ink-w-bold) solid var(--ink)",
              }}
            >
              <div class="flex items-start gap-3">
                <SpriteIcon name="arch-crown" size={36} animate="wobble" interactive />
                <div class="space-y-1">
                  <span
                    class="sticker text-[10px] font-black uppercase tracking-wider"
                    style={{ "--pop": "var(--pop-yellow)", transform: "rotate(-1deg)" }}
                  >
                    Welcome MEC Batch '30
                  </span>
                  <h3
                    class="text-base sm:text-lg font-black text-[var(--ink)] m-0 leading-snug"
                    style={{ "font-family": "var(--font-stack-display)" }}
                  >
                    We wish you the best 4 years at MEC. May the FOSS be with you!
                  </h3>
                  <p class="text-xs sm:text-sm font-semibold text-[var(--ink)] opacity-90 m-0">
                    Welcome to the Model Engineering College family! FOSS MEC is your home for
                    building things, exploring open-source software, breaking terminal environments,
                    and learning from seniors who have been in your exact shoes.
                  </p>
                </div>
              </div>

              <div
                class="rounded-lg p-3 text-xs font-bold leading-relaxed space-y-1"
                style={{
                  background: "var(--paper-2)",
                  border: "1.5px solid var(--ink)",
                }}
              >
                <p class="text-[var(--ink)] m-0 font-extrabold">Tips for your 1st year:</p>
                <p class="text-[var(--ink-soft)] m-0">
                  - Don't hesitate to ask doubts on our community groups; everyone starts from zero.
                </p>
                <p class="text-[var(--ink-soft)] m-0">
                  - Install a Linux distribution or play with Git early on; it makes everything
                  easier later.
                </p>
                <p class="text-[var(--ink-soft)] m-0">
                  - Watch out for upcoming FOSS MEC beginner bootcamps and hands-on sessions.
                </p>
              </div>
            </div>
          </Show>

          {/* Section 1: Overall Onam Games Experience */}
          <div
            class="card p-4 sm:p-5 space-y-3"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-center gap-2">
              <SpriteIcon name="sadya-leaf" size={22} />
              <label
                for="enjoyedGames"
                class="text-sm sm:text-base font-extrabold text-[var(--ink)]"
              >
                Did you enjoy the Onam Games? Tell us about your experience.
              </label>
            </div>
            <textarea
              id="enjoyedGames"
              rows={3}
              value={form().enjoyedGames}
              onInput={(e) => updateField("enjoyedGames", e.currentTarget.value)}
              placeholder="What made you laugh, what kept you on your toes, or how did it feel playing everyday at 1 PM?"
              class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
            />
          </div>

          {/* Section 2: Favorite Thing */}
          <div
            class="card p-4 sm:p-5 space-y-3"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-center gap-2">
              <Heart size={18} strokeWidth={2.5} class="text-[var(--ink)]" />
              <label
                for="favoriteThing"
                class="text-sm sm:text-base font-extrabold text-[var(--ink)]"
              >
                What is the one thing you liked most about Onam Games?
              </label>
            </div>
            <textarea
              id="favoriteThing"
              rows={2}
              value={form().favoriteThing}
              onInput={(e) => updateField("favoriteThing", e.currentTarget.value)}
              placeholder="Was it a specific puzzle, the meme lore, the real-time leaderboard race, or the comic aesthetic?"
              class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
            />
          </div>

          {/* Section 3: Next Year Changes */}
          <div
            class="card p-4 sm:p-5 space-y-3"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-center gap-2">
              <SpriteIcon name="terminal-star" size={22} />
              <label
                for="changesNextYear"
                class="text-sm sm:text-base font-extrabold text-[var(--ink)]"
              >
                What changes, features, or new mini-games would you want next year?
              </label>
            </div>
            <textarea
              id="changesNextYear"
              rows={3}
              value={form().changesNextYear}
              onInput={(e) => updateField("changesNextYear", e.currentTarget.value)}
              placeholder="Ideas for new game formats, difficulty adjustments, timing, multiplayer elements, or rules..."
              class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
            />
          </div>

          {/* Section 4: Code-a-Pookalam & Roadmap */}
          <div
            class="card p-4 sm:p-5 space-y-4"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-center gap-2">
              <SpriteIcon name="pookalam-flower" size={24} />
              <h3 class="text-sm sm:text-base font-extrabold text-[var(--ink)] m-0">
                Code-a-Pookalam & 1-Week Roadmap
              </h3>
            </div>

            <div class="space-y-2">
              <label
                for="codePookalamExperience"
                class="text-xs sm:text-sm font-bold text-[var(--ink)] block"
              >
                Have you participated in or explored Code-a-Pookalam? Do you think it is
                beginner-friendly and approachable?
              </label>
              <textarea
                id="codePookalamExperience"
                rows={2}
                value={form().codePookalamExperience}
                onInput={(e) => updateField("codePookalamExperience", e.currentTarget.value)}
                placeholder="Share your thoughts on creating pookalams with code (Canvas, Python, SVG, CSS, etc.) or whether the guidelines felt clear."
                class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
              />
            </div>

            <div class="space-y-2">
              <label
                for="codePookalamRoadmap"
                class="text-xs sm:text-sm font-bold text-[var(--ink)] block"
              >
                Did you read and follow along with the Code-a-Pookalam 1-week roadmap? Did it teach
                you something new, and are you interested in trying more code adventures?
              </label>
              <textarea
                id="codePookalamRoadmap"
                rows={2}
                value={form().codePookalamRoadmap}
                onInput={(e) => updateField("codePookalamRoadmap", e.currentTarget.value)}
                placeholder="Did the daily tutorials and code concepts help? Are you inspired to build more creative code or generative art?"
                class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
              />
            </div>
          </div>

          {/* Section 5: Open Source & FOSS MEC Workshops */}
          <div
            class="card p-4 sm:p-5 space-y-4"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-start gap-2">
              <SpriteIcon name="osi-logo" size={24} />
              <div>
                <h3 class="text-sm sm:text-base font-extrabold text-[var(--ink)] m-0">
                  Open Source & Future FOSS MEC Events
                </h3>
                <p class="text-xs font-semibold text-[var(--ink-soft)] m-0">
                  FOSS MEC conducts hands-on workshops and events. If you need any help, ask
                  here—tell us what you want to learn, and we can make it work for you!
                </p>
              </div>
            </div>

            <div class="space-y-2">
              <label
                for="openSourceLearning"
                class="text-xs sm:text-sm font-bold text-[var(--ink)] block"
              >
                Did you learn something new about open source through this festival? Do you want to
                participate in more FOSS events?
              </label>
              <textarea
                id="openSourceLearning"
                rows={2}
                value={form().openSourceLearning}
                onInput={(e) => updateField("openSourceLearning", e.currentTarget.value)}
                placeholder="Tell us if exploring open-source licenses, git repos, or community tools piqued your curiosity."
                class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
              />
            </div>

            <div class="space-y-2">
              <label
                for="nextEventSuggestions"
                class="text-xs sm:text-sm font-bold text-[var(--ink)] block"
              >
                What event or workshop should we conduct next? What skills or technologies do you
                want to master?
              </label>
              <textarea
                id="nextEventSuggestions"
                rows={3}
                value={form().nextEventSuggestions}
                onInput={(e) => updateField("nextEventSuggestions", e.currentTarget.value)}
                placeholder="E.g., Linux CLI Mastery, Full-stack Web Dev, Git & GitHub Hands-on, Game Development, AI/ML, Rust, Shaders & Creative Coding, Open Source Contributing..."
                class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
              />
            </div>
          </div>

          {/* Section 6: Community Pookalam & Mini-Games */}
          <div
            class="card p-4 sm:p-5 space-y-3"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-center gap-2">
              <SpriteIcon name="concentric-pookalam" size={22} />
              <label
                for="communityPookalamExperience"
                class="text-sm sm:text-base font-extrabold text-[var(--ink)]"
              >
                Did you enjoy the collaborative Community Pookalam and daily mini-games?
              </label>
            </div>
            <textarea
              id="communityPookalamExperience"
              rows={2}
              value={form().communityPookalamExperience}
              onInput={(e) => updateField("communityPookalamExperience", e.currentTarget.value)}
              placeholder="Did you place flower petals, post wishes, or play Jigsaw, Vallam, Maveli Jump, Tinder, Wend, or Treasure Hunt?"
              class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
            />
          </div>

          {/* Section 7: Additional Notes */}
          <div
            class="card p-4 sm:p-5 space-y-3"
            style={{
              background: "var(--paper-2)",
              border: "var(--ink-w) solid var(--ink)",
            }}
          >
            <div class="flex items-center gap-2">
              <MessageSquare size={18} strokeWidth={2.5} class="text-[var(--ink)]" />
              <label
                for="additionalNotes"
                class="text-sm sm:text-base font-extrabold text-[var(--ink)]"
              >
                Anything else on your mind? Shoutouts or suggestions?
              </label>
            </div>
            <textarea
              id="additionalNotes"
              rows={2}
              value={form().additionalNotes}
              onInput={(e) => updateField("additionalNotes", e.currentTarget.value)}
              placeholder="Drop any additional thoughts, feedback for the organizers, or notes..."
              class="w-full rounded-lg p-3 text-xs sm:text-sm font-medium bg-[var(--paper)] text-[var(--ink)] border-2 border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pop-teal)]"
            />
          </div>

          <Show when={errorMessage()}>
            <p class="text-xs sm:text-sm font-extrabold text-[var(--pop-red)] m-0">
              {errorMessage()}
            </p>
          </Show>

          {/* Action Buttons */}
          <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="submit"
              disabled={isSubmitting()}
              class="btn-brand px-6 py-3 text-sm sm:text-base font-black cursor-pointer inline-flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <Show when={isSubmitting()} fallback={<Send size={16} strokeWidth={2.5} />}>
                <span class="inline-block animate-spin">⟳</span>
              </Show>
              <span>{isSubmitting() ? "Saving Feedback..." : "Save Feedback"}</span>
            </button>

            <Show when={props.onDismiss}>
              <button
                type="button"
                onClick={props.onDismiss}
                class="px-4 py-3 rounded-lg text-xs sm:text-sm font-extrabold border-2 border-[var(--ink-soft)]/50 hover:border-[var(--ink)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer transition-all text-center order-2 sm:order-1"
              >
                I will fill this later →
              </button>
            </Show>
          </div>
        </form>
      </Show>
    </div>
  );
}
