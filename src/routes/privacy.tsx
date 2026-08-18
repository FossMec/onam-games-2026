import { Title } from "@solidjs/meta";
import { For } from "solid-js";

const SECTIONS = [
  {
    title: "What we collect",
    body: [
      "Sign-in identity: when you sign in with Google, we receive your name, email address, and avatar picture from Google. We do not receive or store your Google password.",
      "Device fingerprint: a hardware-derived visitor ID and device signals (browser, OS, screen size) used to enforce the one-account-per-device rule and detect automated play.",
      "Gameplay data: your attempts, moves, timings, scores, and leaderboard entries, stored so we can score games, rank players, and enforce fair-play rules.",
      "Network data: your IP address (kept briefly) to block abusive traffic and apply rate limits.",
      "Submission data: anything you submit, including Code-a-Pookalam artwork, your college/branch/batch, and social links you choose to add.",
    ],
  },
  {
    title: "What we do not collect",
    body: [
      "No payment information: this site involves no purchases and never asks for card or bank details.",
      "No selling of data: we do not sell, rent, or trade your personal information to anyone.",
      "No third-party advertising or tracking for ad purposes: our analytics and anti-cheat run on our own infrastructure.",
    ],
  },
  {
    title: "Where data lives",
    body: [
      "Data is stored on Supabase (hosted Postgres in Singapore). Processing happens on Vercel's serverless platform.",
      "We retain gameplay and account data for the duration of the event and a reasonable period afterwards for results, prize distribution, and record-keeping.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To run the games, compute scores, maintain leaderboards, and verify fairness.",
      "To enforce event rules: device binding, account limits, and anti-cheat checks.",
      "To contact you about prizes, event changes, or issues with your account (via the email you signed up with).",
      "To keep the site safe: rate limiting, blocking abusive traffic, and investigating suspected cheating.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "Your public leaderboard name, score, and (where shown) avatar and college are visible to other players as part of the game.",
      "We share data with service providers (Vercel, Supabase) only to the extent needed to operate the site.",
      "We will not share your personal data with other third parties unless required by law.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can delete your account and its data by contacting us at the address below. We will remove your account record; note that leaderboard history may be anonymised rather than erased so scores and results stay consistent.",
      "If you prefer not to be fingerprinted, you can still browse most public pages, but signing in and playing requires the device checks.",
    ],
  },
  {
    title: "Children",
    body: [
      "This event is aimed at college students. If you are under 13, please do not create an account or submit data; ask a parent or guardian to contact us if you believe data about you was submitted.",
    ],
  },
  {
    title: "Changes",
    body: [
      "We may update this policy as the event evolves. Material changes will be reflected here, and continued use of the site after changes means you accept the updated policy.",
    ],
  },
];

export default function Privacy() {
  return (
    <main class="container space-y-8 py-10 max-w-3xl">
      <Title>Privacy Policy - Onam Games</Title>

      <header class="space-y-2">
        <p
          class="text-xs font-extrabold uppercase tracking-widest"
          style={{ color: "var(--pop-teal-deep)" }}
        >
          Onam Games 2026
        </p>
        <h1 class="text-3xl sm:text-4xl">Privacy Policy</h1>
        <p class="comment font-semibold">Last updated: 15 August 2026</p>
      </header>

      <p class="card card-plain font-semibold leading-relaxed">
        FOSS MEC runs the Onam Games website. This policy explains what information we collect, why,
        and the choices you have. It is written for people, not lawyers.
      </p>

      <div class="space-y-6">
        <For each={SECTIONS}>
          {(section) => (
            <section class="card card-plain space-y-2">
              <h2 class="text-xl font-extrabold">{section.title}</h2>
              <ul class="space-y-2">
                <For each={section.body}>
                  {(item) => (
                    <li class="flex gap-2 font-semibold leading-relaxed">
                      <span style={{ color: "var(--pop-teal-deep)" }}>▸</span>
                      <span>{item}</span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>
      </div>

      <section class="card card-plain space-y-1">
        <h2 class="text-xl font-extrabold">Contact</h2>
        <p class="font-semibold leading-relaxed">
          Questions about this policy or your data? Contact the organisers at the FOSS MEC club
          (foss@mec.ac.in) or via the college's official channels.
        </p>
      </section>
    </main>
  );
}
