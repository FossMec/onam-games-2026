export const collegeValues = ["mec", "other"] as const;
export type College = (typeof collegeValues)[number];

export const branchValues = ["cs", "cu", "ee", "eb", "ec", "ev", "me", "other"] as const;
export type Branch = (typeof branchValues)[number];

export const batchValues = ["27", "28", "29", "30", "<=26"] as const;
export type Batch = (typeof batchValues)[number];

export const divValues = ["none", "a", "b", "c"] as const;
export type Div = (typeof divValues)[number];

export function batchLabel(batch: string | null | undefined): string {
  switch (batch) {
    case "27":
      return "Batch 2027 (4th Year)";
    case "28":
      return "Batch 2028 (3rd Year)";
    case "29":
      return "Batch 2029 (2nd Year)";
    case "30":
      return "Batch 2030 (1st Year)";
    case "<=26":
      return "2026 or earlier (Alumni / Passout)";
    default:
      return batch ?? "";
  }
}

export function branchLabel(branch: string | null | undefined): string {
  switch (branch) {
    case "cs":
      return "Computer Science (CS)";
    case "cu":
      return "Computer Science & Business Systems (CSB)";
    case "ee":
      return "Electrical & Electronics (EEE)";
    case "eb":
      return "Electronics & Biomedical (EBM)";
    case "ec":
      return "Electronics & Communication (ECE)";
    case "ev":
      return "Electronics & VLSI (EVL)";
    case "me":
      return "Mechanical Engineering (ME)";
    case "other":
      return "Other Branch";
    default:
      return (branch ?? "").toUpperCase();
  }
}

export function collegeOptionLabel(college: string): string {
  switch (college) {
    case "mec":
      return "Govt. Model Engineering College (MEC)";
    case "other":
      return "Other College / School / Organization";
    default:
      return college;
  }
}

/**
 * The college as a human would write it.
 *
 * `"other"` on its own is not a college, it is a form value — so it resolves to
 * whatever the player typed, and to nothing at all when they typed nothing.
 * Callers that print this must handle null rather than falling back to a label.
 */
export function collegeLabel(
  college: string | null | undefined,
  collegeOther?: string | null,
): string | null {
  if (college === "mec") return "Model Engineering College";
  return collegeOther?.trim() || null;
}
