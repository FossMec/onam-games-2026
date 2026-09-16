# Setup

## 1. Supabase project

1. Create a project at https://supabase.com (free plan is fine).
2. **Google provider**: Authentication → Providers → Google → enable, add your Google OAuth Client ID/Secret (create one at https://console.cloud.google.com/apis/credentials).
3. **Redirect URLs** (Authentication → URL Configuration):
   - `http://localhost:3000/auth/callback`
   - `https://<your-domain>/auth/callback`
4. **Storage buckets**: two public buckets, `avatars` and `pookalams`. Once the
   environment variables below are in place, `pnpm run storage:buckets` creates
   whichever is missing and leaves existing ones untouched (it works against a
   local `supabase start` stack too). You can also create them by hand in
   Storage → New bucket.

   Both are written server-side with the service-role key, so no RLS policies
   are needed beyond public read. Contest artwork is stored under
   `pookalams/entries/<uuid>.webp` - a random name, never the user id, because
   those URLs are handed to every voter during an anonymous round. If the
   `pookalams` bucket is missing, submissions fail with "Could not save that
   image" and the real reason is only in the server log.

## 2. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable                    | Source                                                                            |
| --------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Supabase → Project Settings → Database → pooled connection string                 |
| `SUPABASE_URL`              | Project Settings → API → Project URL                                              |
| `SUPABASE_ANON_KEY`         | Project Settings → API → `anon` `public` key                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (server only, keep secret)            |
| `SESSION_SECRET`            | `openssl rand -base64 32`                                                         |
| `DEVICE_PEPPER`             | `openssl rand -base64 32`                                                         |
| `OPEN_TO_ALL`               | `true` to run the open playground; leave unset/`false` for the scheduled festival |

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` mirror the public Supabase values for the browser client.

### Open-to-all mode

With `OPEN_TO_ALL=true` the scheduled event becomes a public playground: every
published game is live at all times, the closed-beta door is lifted, and
sign-up asks for a name instead of a Google account. Only those name-only
players appear on the leaderboards. The flag is server-side only; flip it and
redeploy. Nothing else needs to change, and turning it back off restores the
normal event.

## 3. Database

Apply the generated migrations to Supabase:

```bash
vp run db:migrate
```

## 4. Dev

```bash
vp dev
```

Auth flow: `/auth/signin` → Google → `/auth/callback` → sets the HttpOnly session cookie → `/onboarding` (mandatory college/branch/batch/div) → home.

## 5. Deploy (Vercel)

- Framework: Vite+ (build `vp install` + `vp build`, output `.output`/`.vercel/output`).
- Add all env vars above to the project.
- Supabase lives outside Vercel, so moving accounts is only an env-var swap.
