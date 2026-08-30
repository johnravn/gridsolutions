# Vercel Deployments

Pushing **`main`** deploys **production** to [gridsolutions.app](https://gridsolutions.app).

This repo does not use feature branches or pull requests, so preview deployments are not part of the workflow. Test locally, then push `main`.

## Production (`main`)

**When**: every push to `main`

**URL**: `https://gridsolutions.app`

**Environment**: Production variables in the Vercel dashboard

**Process**:

1. Vercel detects the push
2. Builds the app
3. Deploys to gridsolutions.app (usually 1–3 minutes)

Verify at `https://gridsolutions.app` and in the Vercel dashboard.

## Environment Variables

Set **Production** variables in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

Preview-environment variables are unused while everything ships on `main`.

## Troubleshooting

### Production not updating

1. Confirm `git push origin main` succeeded
2. Check the Vercel dashboard for the deployment
3. Wait 1–3 minutes
4. Clear browser cache if needed

### Build fails

1. Check Vercel build logs
2. Verify Production environment variables
3. Reproduce locally: `npm run build:check`

## Related

- `GITHUB_ISSUES.md` — issues + commit/push on `main`
- `DEPLOYMENT_WORKFLOW.md` — migrations and deploy timing
