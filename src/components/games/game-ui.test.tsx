import { renderToString } from "solid-js/web";
import { describe, expect, it } from "vite-plus/test";
import { GameDemo, HowToPlayModal, HowToPlayPanel } from "./HowToPlay";
import { ProjectMark } from "./ProjectMark";
import { TinderRecap } from "./TinderRecap";
import { BRAND_ICONS } from "~/lib/brand-icons";

describe("ssr smoke", () => {
  it("renders every game demo", () => {
    for (const t of ["tinder", "jigsaw", "wend", "unblock", "jump", "hunt"]) {
      const html = renderToString(() => <GameDemo gameType={t} />);
      expect(html.length).toBeGreaterThan(50);
    }
  });

  it("renders the how-to panel", () => {
    const html = renderToString(() => <HowToPlayPanel gameType="tinder" steps={["one", "two"]} />);
    expect(html).toContain("How to play");
  });

  it("renders curated and generic project marks", () => {
    for (const id of ["firefox", "linux", "chrome", "not-a-real-project"]) {
      const html = renderToString(() => <ProjectMark id={id} name="Some Project" />);
      expect(html).toContain("<svg");
    }
  });

  it("renders the tinder recap with and without the reveal", () => {
    const cards = [{ id: "firefox", name: "Firefox", category: "Browser" }];
    const passes = [[{ id: "firefox", open: false }]];
    expect(renderToString(() => <TinderRecap cards={cards} passes={passes} />)).toContain(
      "Firefox",
    );
    const withReveal = renderToString(() => (
      <TinderRecap
        cards={cards}
        passes={passes}
        reveal={[
          {
            id: "firefox",
            name: "Firefox",
            category: "Browser",
            open: true,
            why: "MPL.",
            fact: "Mozilla's browser, and the last major engine that isn't Chromium.",
          },
        ]}
      />
    ));
    expect(withReveal).toContain("MPL.");
    expect(withReveal).toContain("last major engine");
  });
});

describe("how to play", () => {
  const steps = ["drag them around", "they snap"];

  it("shows the four-piece jigsaw demo, drawn with the real outlines", () => {
    const html = renderToString(() => <GameDemo gameType="jigsaw" />);
    // Four pieces, each a full outline with interlocking curves.
    const pieces = html.match(/<path d="M 0 0/g) ?? [];
    expect(pieces).toHaveLength(4);
    expect(html).toContain("demo-join");
  });

  /*
   * Mid-run the rules must be readable without offering anything that looks
   * like it might restart the attempt — the case that sent somebody looking for
   * a how-to that only existed behind the start button.
   */
  it("offers no start button when opened read-only", () => {
    const html = renderToString(() => (
      <HowToPlayModal gameType="jigsaw" title="Pookalam Jigsaw" steps={steps} onClose={() => {}} />
    ));
    expect(html).toContain("Got it");
    expect(html).not.toContain("Not yet");
    expect(html).toContain("clock is still running");
  });

  it("offers the start button when opened on the way in", () => {
    const html = renderToString(() => (
      <HowToPlayModal
        gameType="jigsaw"
        title="Pookalam Jigsaw"
        steps={steps}
        startLabel="Start the clock"
        onStart={() => {}}
        onClose={() => {}}
      />
    ));
    expect(html).toContain("Start the clock");
    expect(html).toContain("Not yet");
  });
});

describe("brand marks", () => {
  it("renders the real logo when there is one", () => {
    const html = renderToString(() => <ProjectMark id="firefox" name="Firefox" />);
    expect(html).toContain(BRAND_ICONS.firefox.hex);
    expect(html).toContain('aria-label="Firefox"');
  });

  it("keeps both halves of a trap pair on the same hand-drawn mark", () => {
    // A logo that appears for Chrome but not Chromium would be the answer.
    for (const id of ["chrome", "chromium", "vscode", "vscodium"]) {
      expect(BRAND_ICONS[id], id).toBeUndefined();
    }
  });

  it("gives Docker Engine and Docker Desktop the identical mark", () => {
    expect(BRAND_ICONS.dockerengine.path).toBe(BRAND_ICONS.dockerdesktop.path);
  });
});
