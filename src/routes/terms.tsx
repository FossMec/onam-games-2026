import { Title } from "@solidjs/meta";
import { For } from "solid-js";

const SECTIONS = [
  {
    title: "Acceptance",
    body: 'By accessing or using foss-onam.onrender.com ("the Site"), you agree to these Terms. If you do not agree, please do not use the Site. The Site is operated by FOSS MEC for the FOSS Onam Games 2026 event.',
  },
  {
    title: "The games",
    body: "The Site runs seven days of daily browser games plus a community Code-a-Pookalam submission and voting track. Games are for personal, non-commercial enjoyment. We may change, pause, or end any game, schedule, or prize at our discretion.",
  },
  {
    title: "Eligibility",
    body: "The event is aimed at college students. You must be at least 13 years old to use the Site. You must provide accurate information when you sign in. Participating in prize events may have additional rules announced separately.",
  },
  {
    title: "Your account",
    body: "You sign in with Google; we never see your password. You are responsible for the activity on your account. One account per person, and - under the event's device rule - one account per device. Accounts created to bypass limits, abuse, or farm prizes may be restricted or removed.",
  },
  {
    title: "Fair play & anti-cheat",
    body: [
      "We take fair play seriously: automated play, scripts, exploits, and tampering are not allowed.",
      "The Site uses device fingerprinting and behaviour checks to detect abuse. Suspicious activity may be flagged, and players who cheat may be warned, benched, or disqualified.",
      "Attempting to circumvent these measures - including altering request payloads, timing, or device signals - violates these Terms.",
    ],
  },
  {
    title: "Community content",
    body: "Code-a-Pookalam submissions remain yours. By submitting, you grant FOSS MEC a non-exclusive, royalty-free licence to display, judge, and archive your submission for the event and its promotion. Do not submit content that is illegal, infringing, or that you do not own.",
  },
  {
    title: "Prizes",
    body: "Prizes are awarded per announced rules. Winners may be asked to verify identity and eligibility before a prize is given. Prizes are non-transferable, and we may substitute equivalent prizes. Decisions of the organisers are final.",
  },
  {
    title: "Privacy",
    body: "Our Privacy Policy explains what data we collect and how we use it. By using the Site you also agree to that policy.",
  },
  {
    title: "No warranty",
    body: 'The Site is provided "as is" and "as available", without warranties of any kind, express or implied. We do not guarantee the Site will be uninterrupted or error-free.',
  },
  {
    title: "Limitation of liability",
    body: "To the fullest extent permitted by law, FOSS MEC and its organisers are not liable for any indirect, incidental, or consequential damages arising from your use of the Site, including lost prizes or data.",
  },
  {
    title: "Changes to these Terms",
    body: "We may update these Terms from time to time. Updated Terms will be posted on this page with a revised date. Continued use of the Site after changes means you accept the updated Terms.",
  },
  {
    title: "Governing law",
    body: "These Terms are governed by the laws of India, and any disputes will be subject to the jurisdiction of the courts at Ernakulam, Kerala.",
  },
  {
    title: "Contact",
    body: "Questions? Reach the organisers at FOSS MEC (foss@mec.ac.in) or through the college's official channels.",
  },
];

export default function Terms() {
  return (
    <main class="container space-y-8 py-10 max-w-3xl">
      <Title>Terms of Service - FOSS Onam Games</Title>

      <header class="space-y-2">
        <p
          class="text-xs font-extrabold uppercase tracking-widest"
          style={{ color: "var(--pop-teal-deep)" }}
        >
          FOSS Onam Games 2026
        </p>
        <h1 class="text-3xl sm:text-4xl">Terms of Service</h1>
        <p class="comment font-semibold">Last updated: 15 August 2026</p>
      </header>

      <div class="space-y-6">
        <For each={SECTIONS}>
          {(section) => (
            <section class="card card-plain space-y-2">
              <h2 class="text-xl font-extrabold">{section.title}</h2>
              {typeof section.body === "string" ? (
                <p class="font-semibold leading-relaxed">{section.body}</p>
              ) : (
                <ul class="space-y-2">
                  <For each={section.body as string[]}>
                    {(item) => (
                      <li class="flex gap-2 font-semibold leading-relaxed">
                        <span style={{ color: "var(--pop-teal-deep)" }}>▸</span>
                        <span>{item}</span>
                      </li>
                    )}
                  </For>
                </ul>
              )}
            </section>
          )}
        </For>
      </div>
    </main>
  );
}
