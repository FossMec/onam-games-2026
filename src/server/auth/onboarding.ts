import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { getSupabaseAdmin } from "~/server/supabase/client";
import { branchValues, batchValues, collegeValues, divValues } from "~/lib/profile";
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
 * punctuation only — enough for "St. Joseph's College" or "Working
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
    college: z.enum(collegeValues),
    /** Required when `college = 'other'`. */
    collegeOther: freeText(80),
    branch: z.enum(branchValues).optional(),
    /** Required when `branch = 'other'`. */
    branchOther: freeText(60),
    batch: z.enum(batchValues).optional(),
    div: z.enum(divValues).optional(),
    instagramHandle: optionalTrimmed(3, 30, /^[a-zA-Z0-9._]+$/),
    whatsappNumber: optionalTrimmed(10, 15, /^\+?[0-9]+$/),
  })
  .superRefine((val, ctx) => {
    if (val.college === "mec") {
      if (!val.branch) {
        ctx.addIssue({
          code: "custom",
          path: ["branch"],
          message: "Branch is required for MEC",
        });
      }
      if (!val.batch) {
        ctx.addIssue({
          code: "custom",
          path: ["batch"],
          message: "Batch is required for MEC",
        });
      }
      // "Other" branch is only meaningful if they say which one.
      if (val.branch === "other" && !val.collegeOther && !val.branchOther) {
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
        message: "Tell us where you're from — college, school, or work",
      });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const user = await requireCurrentUser();
  const normalized: OnboardingInput = {
    ...input,
    instagramHandle: input.instagramHandle?.trim().replace(/^@+/, "") || undefined,
    whatsappNumber: input.whatsappNumber?.replace(/[\s\-()]/g, "") || undefined,
  };
  const parsed = onboardingSchema.parse(normalized);
  const branch = parsed.branch ?? null;
  await getDb()
    .update(users)
    .set({
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
