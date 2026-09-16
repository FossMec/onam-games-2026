import { getDb } from "~/server/db/client";
import { HttpError } from "~/server/errors";
import { getRequestMeta } from "~/server/request";
import { invalidateShared } from "~/server/cache";
import { writeAuthCookie } from "./session";

/**
 * Name-only sign-up for open-to-all mode.
 *
 * A guest is a genuine `users` row - the leaderboard, attempts and streaks all
 * key off that table, so anything else would mean a parallel universe of code.
 * The only difference is that there is no Supabase identity behind it: the
 * `supabase_uid` is namespaced (`guest:<uuid>`) and the email is a local
 * placeholder, so a guest can never collide with a real Google account.
 *
 * The session is a normal `auth_sessions` row, which means `getCurrentUser`,
 * `requireCurrentUser`, the ban checks and every game endpoint keep working
 * untouched. The fake refresh/access tokens are never sent anywhere: guest
 * sessions carry no `expires_at`, so `refreshSessionIfNeeded` skips them and
 * `signOut` swallows the failed Supabase revoke.
 */

/**
 * What a leaderboard-friendly display name may contain.
 *
 * Same spirit as onboarding's `freeText`: letters, numbers and the punctuation
 * a real name actually uses, and nothing that could smuggle markup into a
 * public board.
 */
const NAME_PATTERN = /^[\p{L}\p{N} .,'’&()/-]+$/u;

export interface GuestAccount {
  userId: string;
  name: string;
}

export async function createGuestAccount(rawName: string): Promise<GuestAccount> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new HttpError(400, "Please enter a name with at least 2 characters.");
  if (name.length > 40) throw new HttpError(400, "That name is a little too long (40 max).");
  if (!NAME_PATTERN.test(name)) {
    throw new HttpError(400, "Use letters, numbers and simple punctuation only.");
  }

  const db = getDb();
  const meta = getRequestMeta();
  const guestId = crypto.randomUUID();
  const supabaseUid = `guest:${guestId}`;
  const email = `guest-${guestId}@open.local`;

  const createdUsers = await db<{ id: string }[]>`
    INSERT INTO users (
      supabase_uid,
      email,
      name,
      role,
      onboarding_completed,
      is_guest,
      last_login_at
    )
    VALUES (
      ${supabaseUid},
      ${email},
      ${name},
      'player'::role,
      true,
      true,
      NOW()
    )
    RETURNING id
  `;
  const userId = createdUsers[0].id;

  /*
   * A device row, because `requireCurrentDevice` hands its id to every game
   * attempt and `game_attempts.device_id` is a hard foreign key.
   *
   * Open mode deliberately skips fingerprinting and the one-user-per-device
   * rule. On a shared laptop at a demo table, the rule would lock the second
   * person out of a public playground for no security benefit - the board only
   * ever shows guests anyway. A fresh opaque device per session is enough to
   * satisfy the schema without pretending to be an anti-cheat signal.
   */
  const deviceHash = `guest-device:${crypto.randomUUID()}`;
  const createdDevices = await db<{ id: string }[]>`
    INSERT INTO devices (
      device_hash,
      user_agent,
      first_ip,
      last_ip,
      first_country,
      first_city,
      last_country,
      last_city
    )
    VALUES (
      ${deviceHash},
      ${meta.userAgent ?? null},
      ${meta.ip || null},
      ${meta.ip || null},
      ${meta.country ?? null},
      ${meta.city ?? null},
      ${meta.country ?? null},
      ${meta.city ?? null}
    )
    RETURNING id
  `;
  const deviceId = createdDevices[0].id;

  await db`
    INSERT INTO user_devices (user_id, device_id, is_primary, usage_count)
    VALUES (${userId}, ${deviceId}, true, 1)
  `;

  const createdSessions = await db<{ id: string }[]>`
    INSERT INTO auth_sessions (
      user_id,
      device_id,
      refresh_token,
      access_token,
      ip,
      user_agent,
      country,
      city
    )
    VALUES (
      ${userId},
      ${deviceId},
      ${`guest-refresh:${guestId}`},
      ${`guest-access:${guestId}`},
      ${meta.ip || null},
      ${meta.userAgent ?? null},
      ${meta.country ?? null},
      ${meta.city ?? null}
    )
    RETURNING id
  `;

  await writeAuthCookie({ sid: createdSessions[0].id, deviceId });

  // The new user must not be shadowed by a cached "nobody is signed in" read.
  invalidateShared("user:session:");

  return { userId, name };
}
