import { signOutAction } from "~/server/auth/actions";

/**
 * Signs out and reloads the page.
 *
 * The reload is the point, not laziness. `signOutAction` revokes the session
 * and clears the cookie server-side, but the browser is still holding every
 * `createAsync` result it has already resolved — `getMe()`, the ban state, the
 * games list. None of those are router queries, so nothing invalidates them,
 * and the page carried on showing the signed-in user until something unrelated
 * happened to refetch. That looked exactly like sign-out being ignored.
 *
 * Discarding the whole client is also the correct semantics here: after signing
 * out, no component should still be holding the previous user's data. A partial
 * invalidation would have to enumerate every cached resource and would silently
 * rot the next time one was added.
 *
 * `location.replace` rather than `assign` so the back button does not land on a
 * page rendered for a user who is no longer signed in.
 */
export async function signOutAndReload(to = "/"): Promise<void> {
  try {
    await signOutAction();
  } finally {
    // Even if revocation failed, the local session must not survive the click.
    window.location.replace(to);
  }
}
