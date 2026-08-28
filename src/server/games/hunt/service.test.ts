import { describe, expect, it } from "vite-plus/test";
import { checkAnswerMatch, isTokenAnswer, normalizeAnswer, pickNextQuestion } from "./service";
import type { HuntQuestion } from "~/server/db/schema";

const mockQuestions: HuntQuestion[] = [
  {
    id: "q1",
    slug: "hunt-1",
    title: "Clue 1",
    hintHtml: "Hint 1",
    answer: "M4V371",
    difficulty: "first",
    orderIndex: 1,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "q2",
    slug: "hunt-2",
    title: "Clue 2",
    hintHtml: "Hint 2",
    answer: "3X91A4",
    difficulty: "medium",
    orderIndex: 2,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "q3",
    slug: "hunt-3",
    title: "Clue 3",
    hintHtml: "Hint 3",
    answer: "4X2YAO",
    difficulty: "easy",
    orderIndex: 3,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "q4",
    slug: "hunt-4",
    title: "Clue 4",
    hintHtml: "Hint 4",
    answer: "rocket",
    difficulty: "medium",
    orderIndex: 4,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "q5",
    slug: "hunt-5",
    title: "Clue 5",
    hintHtml: "Hint 5",
    answer: "maveli@pathalam.btw",
    difficulty: "hard",
    orderIndex: 5,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("treasure hunt logic & progression", () => {
  it("determines token answers vs word/string answers", () => {
    expect(isTokenAnswer("M4V371")).toBe(true);
    expect(isTokenAnswer("3X91A4")).toBe(true);
    expect(isTokenAnswer("rocket")).toBe(true); // 6 chars alphanumeric
    expect(isTokenAnswer("maveli@pathalam.btw")).toBe(false);
    expect(isTokenAnswer("short")).toBe(false);
    expect(isTokenAnswer("TOOLONG123")).toBe(false);
  });

  it("normalizes and matches answers case-insensitively and handles SSH formats", () => {
    expect(normalizeAnswer(" m4v371 ")).toBe("M4V371");
    expect(checkAnswerMatch("m4v371", "M4V371")).toBe(true);
    expect(checkAnswerMatch("ROCKET", "rocket")).toBe(true);
    expect(checkAnswerMatch("ssh maveli@pathalam.btw", "maveli@pathalam.btw")).toBe(true);
    expect(checkAnswerMatch("maveli@pathalam.btw", "maveli@pathalam.btw")).toBe(true);
    expect(checkAnswerMatch("wronganswer", "M4V371")).toBe(false);
  });

  it("progresses questions in strict 1 -> 2 -> 3 -> 4 -> 5 sequence without randomness", () => {
    const solved = new Set<string>();

    // Step 1: initial question is q1 (orderIndex: 1)
    const q1 = pickNextQuestion(mockQuestions, solved);
    expect(q1?.id).toBe("q1");
    expect(q1?.orderIndex).toBe(1);

    // Step 2: after solving q1, next is q2 (orderIndex: 2)
    solved.add("q1");
    const q2 = pickNextQuestion(mockQuestions, solved);
    expect(q2?.id).toBe("q2");
    expect(q2?.orderIndex).toBe(2);

    // Step 3: after solving q2, next is q3 (orderIndex: 3)
    solved.add("q2");
    const q3 = pickNextQuestion(mockQuestions, solved);
    expect(q3?.id).toBe("q3");
    expect(q3?.orderIndex).toBe(3);

    // Step 4: after solving q3, next is q4 (orderIndex: 4)
    solved.add("q3");
    const q4 = pickNextQuestion(mockQuestions, solved);
    expect(q4?.id).toBe("q4");
    expect(q4?.orderIndex).toBe(4);

    // Step 5: after solving q4, next is q5 (final clue, orderIndex: 5)
    solved.add("q4");
    const q5 = pickNextQuestion(mockQuestions, solved);
    expect(q5?.id).toBe("q5");
    expect(q5?.orderIndex).toBe(5);

    // Step 6: after solving q5 (all clues solved), returns null (completed)
    solved.add("q5");
    const qFinal = pickNextQuestion(mockQuestions, solved);
    expect(qFinal).toBeNull();
  });
});
