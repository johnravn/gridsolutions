# Environment Variables Setup Guide

This guide explains how to configure environment variables for local development and production deployment.

## 🎯 Quick Answer

**Your `.env.local` with localhost is CORRECT** if you're using local Supabase (Docker).

- **Local Development**: Use `http://127.0.0.1:54321` in `.env.local`
- **Vercel/Production**: Use `https://tlpgejkglrgoljgvpubn.supabase.co` in Vercel Dashboard

## 📁 File Structure

```
.env.local          # Local development (NOT committed to git)
.env.example        # Template (committed to git)
Vercel Dashboard    # Production environment variables
```

## 🏠 Local Development Setup

### Option 1: Using Local Supabase (Docker) - Recommended

**When to use:** You want to develop locally with a local database.

**Setup:**

1. Start local Supabase:

   ```bash
   npm run supabase:start
   ```

2. Get local credentials:

   ```bash
   npm run db:status
   ```

   This shows your local Supabase URL and anon key.

3. Create `.env.local`:

   ```env
   # Local Supabase (Docker)
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # From db:status
   SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
   ```

4. Switch to local database:
   ```bash
   npm run db:switch:local
   ```

**Benefits:**

- ✅ Faster development (no network latency)
- ✅ Free (no API rate limits)
- ✅ Safe to test migrations
- ✅ Works offline

### Option 2: Connecting Directly to Production

**When to use:** You don't want to use Docker, or you want to test against production data.

**Setup:**

1. Get production credentials from Supabase Dashboard:
   - Go to https://app.supabase.com
   - Select your project
   - Go to **Settings → API**

2. Create `.env.local`:

   ```env
   # Production Supabase (for local development)
   VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
   VITE_SUPABASE_ANON_KEY=your-production-anon-key
   SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
   ```

3. Switch to remote database:
   ```bash
   npm run db:switch:remote
   ```

**⚠️ Warning:** Be careful when testing against production data!

## 🚀 Vercel/Production Setup

### Setting Environment Variables in Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project (gridsolutions.app)
3. Go to **Settings → Environment Variables**
4. Add these variables for **Production**:

```
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
CRON_SECRET=generate-a-long-random-string
```

`SUPABASE_SERVICE_ROLE_KEY` is required for serverless API routes (`/api/calendar/feed`, `/api/cron/sync-conta`). Without it, scheduled Conta sync will fail silently in production.

`CRON_SECRET` protects manual cron triggers. Vercel's built-in cron uses the `vercel-cron` user agent; GitHub Actions (`.github/workflows/sync-conta.yml`) sends `Authorization: Bearer <CRON_SECRET>`.

5. Also add them for **Preview** (for feature branch deployments):
   - Click "Add Another" or select "Preview" environment
   - Add the same values

### Finding Your Production Values

1. **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. **Settings → API**
4. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **anon public** key → Use for `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → Use for `SUPABASE_SERVICE_ROLE_KEY` (server/cron only — never expose in client code)
   - **Project Reference ID** → Found in URL: `https://app.supabase.com/project/YOUR-PROJECT-REF`

## 🔄 Switching Between Local and Production

### Check Current Connection

```bash
npm run db:switch:status
```

### Switch to Local

```bash
npm run db:switch:local
# Make sure .env.local has: VITE_SUPABASE_URL=http://127.0.0.1:54321
```

### Switch to Production

```bash
npm run db:switch:remote
# Make sure .env.local has: VITE_SUPABASE_URL=https://...supabase.co
```

## ✅ Verification Checklist

### Local Development

- [ ] `.env.local` exists (not committed to git)
- [ ] `VITE_SUPABASE_URL` matches your setup (localhost or production)
- [ ] `VITE_SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_PROJECT_REF` is set
- [ ] `npm run db:switch:status` shows correct connection

### Vercel/Production

- [ ] Environment variables set in Vercel Dashboard
- [ ] Production environment has all 3 variables
- [ ] Preview environment has all 3 variables (optional)
- [ ] Values use production Supabase URL (not localhost!)

## 🐛 Troubleshooting

### "Invalid API key" or Connection Errors

1. **Check your `.env.local` file exists:**

   ```bash
   cat .env.local
   ```

2. **Verify the URL matches your setup:**
   - Using Docker? → `http://127.0.0.1:54321`
   - Using production? → `https://...supabase.co`

3. **Check if local Supabase is running:**

   ```bash
   npm run db:status
   ```

4. **Verify Vercel environment variables:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Make sure they're set for "Production" environment

### Localhost Not Working

If `http://127.0.0.1:54321` doesn't work:

1. **Start local Supabase:**

   ```bash
   npm run supabase:start
   ```

2. **Wait for it to start** (takes 30-60 seconds)

3. **Get the correct URL:**

   ```bash
   npm run db:status
   ```

4. **Update `.env.local`** with the URL from `db:status`

### Vercel Build Fails

1. **Check Vercel build logs** for environment variable errors
2. **Verify all 3 variables are set** in Vercel Dashboard
3. **Make sure URLs use `https://`** (not `http://`)
4. **Redeploy** after adding/changing variables

## 📝 Summary

| Environment            | File/Location    | URL Format               |
| ---------------------- | ---------------- | ------------------------ |
| **Local (Docker)**     | `.env.local`     | `http://127.0.0.1:54321` |
| **Local (Production)** | `.env.local`     | `https://...supabase.co` |
| **Vercel Production**  | Vercel Dashboard | `https://...supabase.co` |
| **Vercel Preview**     | Vercel Dashboard | `https://...supabase.co` |

**Remember:**

- ✅ Localhost in `.env.local` is correct if using Docker
- ✅ Production URL in Vercel Dashboard is required
- ✅ Never commit `.env.local` to git
- ✅ Always use `https://` for production URLs
