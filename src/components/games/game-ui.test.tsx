import { renderToString } from "solid-js/web";
import { describe, expect, it } from "vite-plus/test";
import { GameDemo, HowToPlayPanel } from "./HowToPlay";
import { ProjectMark } from "./ProjectMark";
import { TinderRecap } from "./TinderRecap";

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
        reveal={[{ id: "firefox", name: "Firefox", category: "Browser", open: true, why: "MPL." }]}
      />
    ));
    expect(withReveal).toContain("MPL.");
  });
});
