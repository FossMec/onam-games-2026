import { describe, expect, it } from "vite-plus/test";
import { buildSendOff, type SendOffInput } from "./road-sendoff";

const base: SendOffInput = {
  name: "Aravind",
  done: [],
  notes: {},
  ratings: {},
  titles: {
    "first-shape": "Draw one circle",
    "make-it-round": "Make it go round",
    "rings-and-colour": "Rings, colour, taste",
    git: "Save your work with git",
  },
  total: 9,
};

const body = (input: Partial<SendOffInput>) => buildSendOff({ ...base, ...input }).lines.join(" ");

describe("buildSendOff", () => {
  it("greets by name and softens the opening when the road is unfinished", () => {
    expect(buildSendOff({ ...base, done: ["a", "b", "c", "d"] }).title).toBe(
      "Hey Aravind, it's been a good ride so far.",
    );
    expect(buildSendOff({ ...base, done: Array(9).fill("x") }).title).toBe(
      "Hey Aravind, you walked the whole thing.",
    );
  });

  it("works without a name", () => {
    expect(buildSendOff({ ...base, name: undefined, done: ["a"] }).title).toContain("Hey, ");
  });

  it("counts only notes with something in them", () => {
    expect(body({ done: ["a", "b"], notes: { a: "  ", b: "petals = 24" } })).toContain(
      "1 of them with a note",
    );
    expect(body({ done: ["a"], notes: {} })).toContain("no notes needed");
  });

  it("names the stop they found hardest, using their own word for it", () => {
    const text = body({ done: ["first-shape"], ratings: { "first-shape": 1 } });
    expect(text).toContain('"Draw one circle"');
    expect(text).toContain("brutal");
  });

  it("does not claim git when git was never ticked", () => {
    const text = body({ done: ["first-shape", "make-it-round", "rings-and-colour"] });
    expect(text).toContain("One circle, then a ring");
    expect(text).not.toContain("git");
  });

  it("mentions git and the repo once both stops are done", () => {
    const text = body({ done: ["git", "github"] });
    expect(text).toContain("public repo");
  });

  it("teases a clean sweep of easy ratings", () => {
    const text = body({ done: ["a"], ratings: { a: 5, b: 4, c: 5 } });
    expect(text).toContain("either talent or a very good week");
  });

  it("does not call somebody a beginner when they rated everything easy", () => {
    const text = body({ done: ["a", "b", "c", "d"], ratings: { a: 5, b: 4, c: 5 } });
    expect(text).not.toContain("first go at programming");
  });

  it("drops the beginner line once the whole road is walked", () => {
    const finished = body({ done: Array(9).fill("x") });
    expect(finished).not.toContain("first go at programming");
    expect(finished).toContain("hope you win it");
  });

  it("always ends by asking for the pookalam", () => {
    for (const done of [["a", "b", "c", "d"], Array(9).fill("x")]) {
      const { lines } = buildSendOff({ ...base, done });
      expect(lines.at(-1)).toContain("Waiting to see your pookalam");
    }
  });
});
