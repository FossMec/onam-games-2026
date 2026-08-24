import { z } from "zod";
import { getRequestEvent } from "solid-js/web";
import { logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { getSupabaseAdmin } from "~/server/supabase/client";
import { invalidateShared } from "~/server/cache";
import {
  branchValues,
  batchValues,
  collegeValues,
  divValues,
  occupationValues,
} from "~/lib/profile";
import { requireCurrentUser } from "./service";
import { readAuthCookie } from "./session";

const optionalTrimmed = (min: number, max: number, pattern?: RegExp) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(pattern ?? /.*/)
    .optional()
    .or(z.literal(""));

/**
 * Free text that ends up on a public leaderboard. Letters, digits and basic
 * punctuation only - enough for "St. Joseph's College" or "Working
 * professional", not enough to inject markup or paste an essay.
 */
const freeText = (max: number) =>
  z
    .string()
    .trim()
    .min(2)
    .max(max)
    .regex(/^[\p{L}\p{N} .,''&()/-]+$/u, "Use letters, numbers and basic punctuation only")
    .optional()
    .or(z.literal(""));

export const onboardingSchema = z
  .object({
    occupation: z.enum(occupationValues).optional(),
    college: z.enum(collegeValues),
    /** Required when `college = 'other'` or non-student occupations. */
    collegeOther: freeText(80),
    branch: z.enum(branchValues).optional(),
    /** Required when `branch = 'other'`. */
    branchOther: freeText(60),
    batch: z.enum(batchValues).optional(),
    div: z.enum(divValues).optional(),
    instagramHandle: optionalTrimmed(3, 30, /^[a-zA-Z0-9._]+$/),
    whatsappNumber: z
      .string()
      .trim()
      .regex(
        /^(?:\+91[-\s]?|91[-\s]?|0)?[6-9]\d{9}$/,
        "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)",
      ),
  })
  .superRefine((val, ctx) => {
    if (val.occupation === "student") {
      if (val.college === "mec") {
        if (!val.branch) {
          ctx.addIssue({
            code: "custom",
            path: ["branch"],
            message: "Branch is required for MEC students",
          });
        }
        if (!val.batch) {
          ctx.addIssue({
            code: "custom",
            path: ["batch"],
            message: "Batch / Graduation year is required",
          });
        }
        if (val.branch === "other" && !val.branchOther) {
          ctx.addIssue({
            code: "custom",
            path: ["branchOther"],
            message: "Tell us which branch",
          });
        }
      } else if (val.college === "other" && !val.collegeOther) {
        ctx.addIssue({
          code: "custom",
          path: ["collegeOther"],
          message: "Tell us your college name",
        });
      }
    } else if (val.occupation === "school_student" && !val.collegeOther) {
      ctx.addIssue({
        code: "custom",
        path: ["collegeOther"],
        message: "Tell us your school name",
      });
    } else if (val.occupation === "working_professional" && !val.collegeOther) {
      ctx.addIssue({
        code: "custom",
        path: ["collegeOther"],
        message: "Tell us your company or organization name",
      });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const user = await requireCurrentUser();
  const normalizedPhone = (input.whatsappNumber || "").replace(/\D/g, "").slice(-10);
  const normalized: OnboardingInput = {
    ...input,
    occupation: input.occupation || "student",
    instagramHandle: input.instagramHandle?.trim().replace(/^@+/, "") || undefined,
    whatsappNumber: normalizedPhone,
  };
  const parsed = onboardingSchema.parse(normalized);
  const branch = parsed.branch ?? null;
  const db = getDb();

  // Check if phone number was already used on another account
  if (parsed.whatsappNumber) {
    const existingWithPhone = await db<{ id: string; email: string }[]>`
      SELECT id, email FROM users WHERE whatsapp_number = ${parsed.whatsappNumber} LIMIT 1
    `;

    if (existingWithPhone[0] && existingWithPhone[0].id !== user.id) {
      await logSuspicious({
        userId: user.id,
        eventType: "duplicate_phone_number",
        severity: "warn",
        actionTaken: "flag",
        details: {
          otherUserId: existingWithPhone[0].id,
          phone: parsed.whatsappNumber,
        },
      });
    }
  }

  const collegeOther = parsed.college === "other" ? parsed.collegeOther?.trim() || null : null;
  const branchOther = branch === "other" ? parsed.branchOther?.trim() || null : null;
  const occupation = parsed.occupation ?? "student";
  const college = parsed.college;
  const batch = parsed.batch ?? null;
  const div = parsed.div ?? "none";
  const instagramHandle = parsed.instagramHandle?.trim() || null;
  const whatsappNumber = parsed.whatsappNumber?.trim() || null;

  await db`
    UPDATE users
    SET
      occupation = ${occupation},
      college = ${college},
      college_other = ${collegeOther},
      branch = ${branch},
      branch_other = ${branchOther},
      batch = ${batch},
      div = ${div},
      instagram_handle = ${instagramHandle},
      whatsapp_number = ${whatsappNumber},
      onboarding_completed = true,
      updated_at = NOW()
    WHERE id = ${user.id}
  `;

  // getCurrentUser() is memoized per-request on two layers:
  //   1. event.locals.currentUserPromise
  //   2. requestMemo(`user:session:${sid}`)  -> event.locals.__memo
  // invalidateShared only clears the shared global Map, so the stale
  // per-request memo would survive for the rest of this request and
  // the next server read in the same isolate would still see
  // onboardingCompleted=false. Clear both, and also clear the shared
  // store with the CORRECT prefix (`user:session:` not `session:`).
  const event = getRequestEvent();
  if (event) {
    (event.locals as Record<string, unknown>).currentUserPromise = undefined;
    const bag = (event.locals as Record<string, unknown>).__memo as
      | Map<string, unknown>
      | undefined;
    if (bag) {
      // we need sid to delete the exact key; read from already-decrypted cookie
      const sid = (await readAuthCookie())?.sid;
      if (sid) bag.delete(`user:session:${sid}`);
      // also drop the cookie memo so a re-read decrypts fresh
      bag.delete("auth:cookie");
    }
  }
  invalidateShared("user:session:");
  // keep legacy prefix too in case any isolate still has old keys
  invalidateShared("session:");
}

export async function uploadAvatar(dataUrl: string): Promise<string> {
  const user = await requireCurrentUser();
  const match = /^data:image\/(webp|png|jpeg);base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data");
  const mime = match[1];
  const ext = mime === "jpeg" ? "jpg" : mime;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 300_000) throw new Error("Image too large");

  const storage = getSupabaseAdmin().storage;
  const path = `avatars/${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await storage.from("avatars").upload(path, buffer, {
    contentType: `image/${mime}`,
    upsert: false,
  });
  if (error) throw new Error("Upload failed");

  const { data } = storage.from("avatars").getPublicUrl(path);
  const db = getDb();
  await db`UPDATE users SET avatar_url = ${data.publicUrl}, updated_at = NOW() WHERE id = ${user.id}`;
  return data.publicUrl;
}
