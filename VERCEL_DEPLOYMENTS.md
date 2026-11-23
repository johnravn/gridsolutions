# Vercel Deployments

| Git ref                    | Vercel target  | URL                                                  |
| -------------------------- | -------------- | ---------------------------------------------------- |
| **`main`**                 | **Production** | [gridsolutions.app](https://gridsolutions.app)       |
| **Feature branches / PRs** | **Preview**    | Per-deployment `*.vercel.app` URL (share for review) |

Repo config (`vercel.json`) sets routes/headers/crons only — it does **not** disable Preview deployments. Pushing a non-`main` branch (or opening a PR) should create a Preview. GitHub Actions CI also runs on `pull_request`.

Review via the **Preview URL**, agent desktop / Live, or local `npm run dev` on hosted Dev. Prefer one feature branch per change (not a shared staging branch). Push/merge **`main` only when John asks to ship**.

## Production (`main`)

**When**: every push/merge to `main`

**URL**: `https://gridsolutions.app`

**Environment**: Production variables in the Vercel dashboard — **must point at Prod Supabase**, never Dev

**Process**:

1. Vercel detects the push to `main`
2. Builds the app
3. Deploys to gridsolutions.app (usually 1–3 minutes)

Verify at `https://gridsolutions.app` and in the Vercel dashboard.

## Preview (feature branches / PRs)

**When**: push to a feature branch or open/update a PR

**URL**: deployment-specific Preview URL from the Vercel dashboard / GitHub check / PR

**Environment**: Vercel **Preview** variables — **must use hosted Dev** (or a dedicated non-Prod project), **never Prod** credentials, `service_role`, or production Resend keys. See `ENVIRONMENT_SETUP.md` and `docs/EMAIL.md`.

**Process**:

1. Agent (or human) pushes the feature branch when John asks for preview/review
2. Vercel builds a Preview deployment
3. Share the Preview URL in the handoff / PR

If Preview env vars are missing or still point at Prod, fix them in the Vercel dashboard before treating Preview as a safe review surface.

## Environment Variables

Set **Production** variables in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

Set **Preview** to the **Dev** project (same shape of keys, Dev ref/URL). Do not reuse Prod `SUPABASE_SERVICE_ROLE_KEY` / `RESEND_*` on Preview.

Day-to-day app/agent secrets use **hosted Dev** — see `ENVIRONMENT_SETUP.md`. Cloud agents must not use Prod `service_role`.

## Troubleshooting

### Production not updating

1. Confirm `git push origin main` (or merge to `main`) succeeded
2. Check the Vercel dashboard for the deployment
3. Wait 1–3 minutes
4. Clear browser cache if needed

### Preview missing

1. Confirm the feature branch was pushed to GitHub
2. Check Vercel → Deployments for that branch/PR
3. Confirm the Git integration is connected and Preview deployments are enabled for the project

### Build fails

1. Check Vercel build logs
2. Verify environment variables for that target (Prod vs Preview/Dev)
3. Reproduce locally: `npm run build:check`

## Related

- `AGENTS.md` — agent hard gates + feature-branch workflow
- `GITHUB_ISSUES.md` — issues, feature branches, merge to `main`
- `DEPLOYMENT_WORKFLOW.md` — migrations and deploy timing
