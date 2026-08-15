export const occupationValues = [
  "student",
  "school_student",
  "working_professional",
  "other",
] as const;
export type Occupation = (typeof occupationValues)[number];

export const collegeValues = ["mec", "other"] as const;
export type College = (typeof collegeValues)[number];

export const branchValues = ["cs", "cu", "ec", "eb", "ev", "ee", "me", "other"] as const;
export type Branch = (typeof branchValues)[number];

export const batchValues = ["30", "29", "28", "27", "26", "<=26", "na"] as const;
export type Batch = (typeof batchValues)[number];

export const activeBatchValues = ["30", "29", "28", "27", "<=26"] as const;

export const divValues = ["none", "a", "b", "c"] as const;
export type Div = (typeof divValues)[number];

export function occupationLabel(occ: string | null | undefined): string {
  switch (occ) {
    case "student":
      return "College Student";
    case "school_student":
      return "School Student";
    case "working_professional":
      return "Working Professional";
    case "other":
      return "Other";
    default:
      return occ || "College Student";
  }
}

export function batchLabel(batch: string | null | undefined): string {
  switch (batch) {
    case "30":
      return "1st Year (Batch '30)";
    case "29":
      return "2nd Year (Batch '29)";
    case "28":
      return "3rd Year (Batch '28)";
    case "27":
      return "4th Year (Batch '27 / Final Year)";
    case "26":
    case "<=26":
      return "Alumni";
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
      return "Computer Science & Business Systems (CU)";
    case "ec":
      return "Electronics & Communication (EC)";
    case "eb":
      return "Biomedical Engineering (EB)";
    case "ev":
      return "Electronics & VLSI (EV / VLSI)";
    case "ee":
      return "Electrical & Electronics (EE)";
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
      return "Other College";
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
