import { eq } from "drizzle-orm";
import { z } from "zod";
import { logSuspicious } from "~/server/anti-cheat/log";
import { getDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
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
    const existingWithPhone = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.whatsappNumber, parsed.whatsappNumber))
      .limit(1);

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

  await db
    .update(users)
    .set({
      occupation: parsed.occupation ?? "student",
      college: parsed.college,
      // Only stored when the matching enum actually says "other", so a stale
      // free-text value can never shadow a real selection.
      collegeOther: parsed.college === "other" ? parsed.collegeOther?.trim() || null : null,
      branch,
      branchOther: branch === "other" ? parsed.branchOther?.trim() || null : null,
      batch: parsed.batch ?? null,
      div: parsed.div ?? "none",
      instagramHandle: parsed.instagramHandle?.trim() || null,
      whatsappNumber: parsed.whatsappNumber?.trim() || null,
      onboardingCompleted: true,
    })
    .where(eq(users.id, user.id));

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
  await getDb().update(users).set({ avatarUrl: data.publicUrl }).where(eq(users.id, user.id));
  return data.publicUrl;
}
