# Setup

## 1. Supabase project

1. Create a project at https://supabase.com (free plan is fine).
2. **Google provider**: Authentication → Providers → Google → enable, add your Google OAuth Client ID/Secret (create one at https://console.cloud.google.com/apis/credentials).
3. **Redirect URLs** (Authentication → URL Configuration):
   - `http://localhost:3000/auth/callback`
   - `https://<your-domain>/auth/callback`
4. **Storage bucket**: create a public bucket named `avatars`.

## 2. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable                                              | Source                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                        | Supabase → Project Settings → Database → pooled connection string      |
| `SUPABASE_URL`                                        | Project Settings → API → Project URL                                   |
| `SUPABASE_ANON_KEY`                                   | Project Settings → API → `anon` `public` key                           |
| `SUPABASE_SERVICE_ROLE_KEY`                           | Project Settings → API → `service_role` key (server only, keep secret) |
| `SESSION_SECRET`                                      | `openssl rand -base64 32`                                              |
| `DEVICE_PEPPER`                                       | `openssl rand -base64 32`                                              |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash console (Redis REST)                                           |

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` mirror the public Supabase values for the browser client.

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
- Supabase and Upstash live outside Vercel, so moving accounts is only an env-var swap.
