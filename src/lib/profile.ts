export const collegeValues = ["mec", "other"] as const;
export type College = (typeof collegeValues)[number];

export const branchValues = ["cs", "cu", "ee", "eb", "ec", "ev", "me", "other"] as const;
export type Branch = (typeof branchValues)[number];

export const batchValues = ["27", "28", "29", "30", "<=26"] as const;
export type Batch = (typeof batchValues)[number];

export const divValues = ["none", "a", "b", "c"] as const;
export type Div = (typeof divValues)[number];
