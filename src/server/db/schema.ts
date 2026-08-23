/**
 * Database schema type definitions for PostgreSQL tables.
 * Pure TypeScript interfaces without ORM runtime overhead.
 */

export type College = "mec" | "other";
export type Branch = "cs" | "cu" | "ee" | "eb" | "ec" | "ev" | "me" | "other";
export type Batch = "26" | "27" | "28" | "29" | "30" | "<=26" | "na";
export type Div = "none" | "a" | "b" | "c";
export type Role = "player" | "tester" | "admin";
export type HuntDifficulty = "first" | "easy" | "medium" | "hard";

export interface User {
  id: string;
  supabaseUid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  instagramHandle: string | null;
  whatsappNumber: string | null;
  occupation: string | null;
  college: College | null;
  collegeOther: string | null;
  branch: Branch | null;
  branchOther: string | null;
  batch: Batch | null;
  div: Div;
  role: Role;
  banLevel: number;
  banUntil: Date | null;
  banReason: string | null;
  banAckedAt: Date | null;
  trustScore: number;
  streakCount: number;
  bestStreak: number;
  lastStreakDay: string | null;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export type NewUser = Partial<User> & Pick<User, "supabaseUid" | "email" | "name">;

export interface Device {
  id: string;
  deviceHash: string;
  hardwareHash: string | null;
  fpVisitorId: string | null;
  fingerprintJson: unknown;
  fingerprintVersion: number;
  canvasHash: string | null;
  webglHash: string | null;
  fontHash: string | null;
  screenHash: string | null;
  audioHash: string | null;
  localIp: string | null;
  userAgent: string | null;
  platform: string | null;
  firstIp: string | null;
  lastIp: string | null;
  firstCountry: string | null;
  firstCity: string | null;
  lastCountry: string | null;
  lastCity: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isFlagged: boolean;
  flagReason: string | null;
  flagConfidence: number | null;
  flaggedAt: Date | null;
  attemptsCount: number;
}

export interface UserDevice {
  id: string;
  userId: string;
  deviceId: string;
  isPrimary: boolean;
  firstUsedAt: Date;
  lastUsedAt: Date;
  usageCount: number;
}

export interface Game {
  id: string;
  slug: string;
  day: number;
  title: string;
  hint: string | null;
  gameType: string;
  difficulty: string;
  releaseAt: Date | null;
  endAt: Date | null;
  previewAt: Date | null;
  testerEarlyHours: number;
  published: boolean;
  status?: string;
  assetsJson?: unknown;
  createdAt: Date;
  updatedAt?: Date;
}

export interface DailyLeaderboard {
  id: string;
  gameId: string;
  userId: string;
  attemptId: string | null;
  durationMs: number | null;
  score: number | null;
  rank: number | null;
  startedAt: Date;
  submittedAt: Date;
  createdAt: Date;
}

export interface GameAttempt {
  id: string;
  gameId: string;
  userId: string;
  deviceId: string | null;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date | null;
  status: "in_progress" | "submitted" | "abandoned" | "flagged" | "void";
  durationMs: number | null;
  score: number | null;
  movesCount: number | null;
  gameStateJson: unknown;
  clientTelemetryJson: unknown;
  traceLogJson: unknown;
  antiCheatFlagsJson: unknown;
  serverValid: boolean;
  isAnomalous: boolean;
  afterDeadline: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollabPookalam {
  id: string;
  dayKey: string;
  cells: Uint8Array;
  placed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollabPookalamDiff {
  id: string;
  cellIndex: number;
  flowerId: number;
  placedAt: Date;
}

export interface CollabMessage {
  id: string;
  dayKey: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  message: string;
  likesCount: number;
  createdAt: Date;
}

export interface CollabMessageLike {
  id: string;
  messageId: string;
  userId: string;
  createdAt: Date;
}

export interface PookalamSubmission {
  id: string;
  userId: string;
  title: string;
  sourceUrl: string;
  imageUrl: string;
  imagePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  shortlisted: boolean;
  rating: number;
  adjustment: number;
  adjustmentNote: string | null;
  matches: number;
  wins: number;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PookalamReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  verdict: "like" | "dislike";
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PookalamStanding {
  id: string;
  key: string;
  payload: unknown;
  computedAt: Date;
}

export interface PookalamVote {
  id: string;
  voterId: string;
  winnerId: string;
  loserId: string;
  pairKey: string;
  createdAt: Date;
}

export interface HuntQuestion {
  id: string;
  slug: string;
  title: string;
  hintHtml: string;
  answer: string;
  difficulty: HuntDifficulty;
  orderIndex: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type NewHuntQuestion = Partial<HuntQuestion> &
  Pick<HuntQuestion, "slug" | "title" | "hintHtml" | "answer">;

export interface UserHuntProgress {
  id: string;
  userId: string;
  currentQuestionId: string | null;
  solvedQuestionIds: string[];
  solvedCount: number;
  lastSubmittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  deviceId: string | null;
  ip: string | null;
  eventType: string;
  metaJson: unknown;
  createdAt: Date;
}

export interface SuspiciousLog {
  id: string;
  userId: string | null;
  deviceId: string | null;
  ip: string | null;
  eventType: string;
  severity: string;
  detailsJson: unknown;
  actionTaken: string;
  createdAt: Date;
}

export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  group: string;
  description: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tester {
  id: string;
  email: string;
  earlyHours: number;
  active: boolean;
  activatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockedIp {
  id: string;
  ip: string;
  reason: string | null;
  blockedBy: string | null;
  createdAt: Date;
}
