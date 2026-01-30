# Vercel Deployments Explained

## 🎯 Quick Answer

**The URL you got (`grid-c8vkk5lrv-johnravns-projects.vercel.app`) is a PREVIEW deployment.**

- ✅ This is **normal and expected** for feature branches
- ✅ It's a **preview** so you can test before production
- ✅ To deploy to **gridsolutions.app**, merge the PR to `main`

## Two Types of Deployments

### 1. Preview Deployments (Feature Branches)

**When they happen:**

- Every push to a feature branch
- Every PR created/updated
- Every commit to a non-main branch

**What you get:**

- Unique URL: `https://grid-xxxxx-johnravns-projects.vercel.app`
- Each branch gets its own preview URL
- URL stays the same for that branch (updates on new commits)

**Purpose:**

- Test changes before merging
- Share with team for feedback
- Verify everything works
- Catch bugs before production

**Environment Variables:**

- Uses **Preview** environment variables (if set)
- Falls back to **Production** variables if Preview not set

### 2. Production Deployments (Main Branch)

**When they happen:**

- Every merge to `main` branch
- Every direct push to `main` (not recommended)

**What you get:**

- Your custom domain: `https://gridsolutions.app`
- This is your **live production site**
- Users see this version

**Purpose:**

- Live production site
- What your users access
- Should always be stable

**Environment Variables:**

- Uses **Production** environment variables only

## The Complete Flow

```
1. Create Feature Branch
   └─> Make Changes
       └─> Push to GitHub
           └─> Vercel Creates PREVIEW Deployment
               └─> Test on Preview URL
                   └─> Create PR
                       └─> Review & Test
                           └─> Merge to Main
                               └─> Vercel Creates PRODUCTION Deployment
                                   └─> Live on gridsolutions.app
```

## How to Deploy to Your Domain

### Step 1: Test on Preview

1. Check the preview URL from your PR
2. Test all functionality
3. Verify everything works

### Step 2: Merge to Main

1. Go to your PR on GitHub
2. Click **Merge pull request**
3. Choose merge type (Squash and merge recommended)
4. Confirm merge

### Step 3: Production Deployment

1. Vercel automatically detects the merge
2. Builds the application
3. Deploys to `gridsolutions.app`
4. Usually takes 1-3 minutes

### Step 4: Verify

1. Visit `https://gridsolutions.app`
2. Check that your changes are live
3. Test production site

## Where to Find Deployment URLs

### In GitHub

1. Go to your PR
2. Scroll down to "Checks" section
3. Click "Details" on Vercel deployment
4. See preview URL

### In Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. See all deployments:
   - **Preview**: Feature branch deployments
   - **Production**: Main branch deployments

## Environment Variables Setup

### For Preview Deployments

1. Vercel Dashboard → Settings → Environment Variables
2. Add variables for **Preview** environment:
   ```
   VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
   ```

### For Production Deployments

1. Same location, but select **Production** environment
2. Add the same variables for Production

**Note**: You can use the same values for both, or use a staging Supabase project for Preview.

## Common Questions

### Q: Why didn't it deploy to my domain?

**A**: Because you're on a feature branch. Only `main` branch deploys to your custom domain.

### Q: Can I test the preview deployment?

**A**: Yes! That's the whole point. Test everything on the preview URL before merging.

### Q: What if the preview doesn't work?

**A**: Fix the issues, push more commits, and the preview updates automatically. Don't merge until it works!

### Q: How do I know when production is deployed?

**A**:

- Check Vercel dashboard
- Visit gridsolutions.app
- Check deployment status in GitHub (after merging)

### Q: Can I have multiple previews?

**A**: Yes! Each feature branch gets its own preview URL. Great for testing multiple features simultaneously.

## Best Practices

### ✅ Do's

- **Always test on preview** before merging
- **Use preview URLs** to share with team
- **Verify production** after merging
- **Set Preview environment variables** if using different config

### ❌ Don'ts

- **Don't skip preview testing** - catch issues early
- **Don't merge broken previews** - fix first
- **Don't panic** if preview fails - fix and redeploy
- **Don't forget** to set environment variables

## Troubleshooting

### Preview Not Working

1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Check for build errors
4. Push a fix and preview updates automatically

### Production Not Updating

1. Verify merge to `main` was successful
2. Check Vercel dashboard for deployment status
3. Wait 1-3 minutes for deployment
4. Clear browser cache if needed

### Wrong Environment Variables

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Check which environment (Preview vs Production)
3. Update as needed
4. Redeploy (or wait for next deployment)

## Summary

| Type           | Branch           | URL                     | Purpose                |
| -------------- | ---------------- | ----------------------- | ---------------------- |
| **Preview**    | Feature branches | `grid-xxxxx.vercel.app` | Test before production |
| **Production** | `main`           | `gridsolutions.app`     | Live production site   |

**Remember**:

- Preview = Testing ground (safe to break)
- Production = Live site (must be stable)
- Merge to `main` = Deploy to production

---

**Your current situation**: You have a preview deployment. Test it, and when ready, merge the PR to deploy to gridsolutions.app!
