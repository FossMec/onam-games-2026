import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { SpriteIcon } from "~/components/art/SpriteIcon";
import { FeedbackForm } from "~/components/feedback/FeedbackForm";

export default function FeedbackPage() {
  return (
    <main class="container relative space-y-6 py-6 sm:py-10 max-w-2xl mx-auto">
      <Title>Feedback - Onam Games & FOSS MEC</Title>

      <div class="flex items-center justify-between gap-2">
        <A
          href="/"
          class="text-sm font-extrabold underline decoration-2 underline-offset-4 text-[var(--ink)]"
        >
          ← Back to Home
        </A>
      </div>

      <div class="space-y-2">
        <div class="flex items-center gap-2.5">
          <SpriteIcon name="foss-mec-badge" size={36} animate="float" />
          <h1
            class="text-2xl sm:text-3xl font-black text-[var(--ink)] m-0 leading-tight"
            style={{ "font-family": "var(--font-stack-display)" }}
          >
            Tell Us What You Think
          </h1>
        </div>
        <p class="text-xs sm:text-sm font-bold text-[var(--ink-soft)] m-0">
          Your thoughts directly shape our upcoming open-source games, workshops, and student
          community initiatives at FOSS MEC.
        </p>
      </div>

      <div class="relative">
        <FeedbackForm />
      </div>
    </main>
  );
}
