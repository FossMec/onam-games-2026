export const occupationValues = ["student", "working_professional", "other"] as const;
export type Occupation = (typeof occupationValues)[number];

export const collegeValues = ["mec", "other"] as const;
export type College = (typeof collegeValues)[number];

export const branchValues = ["cs", "cu", "ec", "eb", "ev", "ee", "me", "other"] as const;
export type Branch = (typeof branchValues)[number];

export const batchValues = ["26", "27", "28", "29", "30", "<=26", "na"] as const;
export type Batch = (typeof batchValues)[number];

export const divValues = ["none", "a", "b", "c"] as const;
export type Div = (typeof divValues)[number];

export function occupationLabel(occ: string | null | undefined): string {
  switch (occ) {
    case "student":
      return "Student";
    case "working_professional":
      return "Working Professional";
    case "other":
      return "Other";
    default:
      return occ || "Student";
  }
}

export function batchLabel(batch: string | null | undefined): string {
  switch (batch) {
    case "26":
      return "Batch 2026 (Passout / Final Year)";
    case "27":
      return "Batch 2027 (4th Year)";
    case "28":
      return "Batch 2028 (3rd Year)";
    case "29":
      return "Batch 2029 (2nd Year)";
    case "30":
      return "Batch 2030 (1st Year)";
    case "<=26":
      return "2026 or earlier (Alumni)";
    case "na":
      return "Not Applicable";
    default:
      return batch ?? "Not Applicable";
  }
}

export function branchLabel(branch: string | null | undefined): string {
  switch (branch) {
    case "cs":
      return "Computer Science (CS)";
    case "cu":
      return "Computer Science & Business Systems (CU / CSBS)";
    case "ec":
      return "Electronics & Communication (EC / ECE)";
    case "eb":
      return "Electronics & Biomedical (EB / EBM)";
    case "ev":
      return "Electronics & VLSI (EV / EVL)";
    case "ee":
      return "Electrical & Electronics (EE / EEE)";
    case "me":
      return "Mechanical Engineering (ME)";
    case "other":
      return "Other Branch";
    default:
      return (branch ?? "").toUpperCase();
  }
}

export function branchShort(branch: string | null | undefined): string {
  switch (branch) {
    case "cs":
      return "CS";
    case "cu":
      return "CU";
    case "ec":
      return "EC";
    case "eb":
      return "EB";
    case "ev":
      return "EV";
    case "ee":
      return "EE";
    case "me":
      return "ME";
    case "other":
      return "Other";
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
 */
export function collegeLabel(
  college: string | null | undefined,
  collegeOther?: string | null,
): string | null {
  if (college === "mec") return "Model Engineering College";
  return collegeOther?.trim() || null;
}
