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

export const onboardingSchema = z
  .object({
    college: z.enum(collegeValues),
    branch: z.enum(branchValues).optional(),
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
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const user = await requireCurrentUser();
  const parsed = onboardingSchema.parse(input);
  const isMec = parsed.college === "mec";
  await getDb()
    .update(users)
    .set({
      college: parsed.college,
      branch: isMec ? (parsed.branch ?? null) : null,
      batch: isMec ? (parsed.batch ?? null) : null,
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
