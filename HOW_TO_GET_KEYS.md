# How to Get Your Supabase Keys

## Remote Anon Key

1. **Go to your Supabase project dashboard:**
   - https://app.supabase.com/project/tlpgejkglrgoljgvpubn

2. **Navigate to Settings:**
   - Click on the gear icon (⚙️) in the left sidebar
   - Or go directly to: https://app.supabase.com/project/tlpgejkglrgoljgvpubn/settings/api

3. **Find the API Keys section:**
   - Look for "Project API keys"
   - You'll see several keys listed

4. **Copy the `anon` `public` key:**
   - This is the key labeled as "anon" or "public"
   - It's safe to use in your frontend code
   - Click the "Reveal" button if it's hidden, then copy it

5. **Update your `.env.remote.db` file:**
   ```bash
   # Open the file and replace YOUR_REMOTE_ANON_KEY_HERE with the actual key
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Local Anon Key

1. **Make sure Supabase is running:**

   ```bash
   npm run supabase:start
   ```

2. **Get the status:**

   ```bash
   npm run db:status
   ```

3. **Look for "Publishable" key:**
   - In the output, find the section "🔑 Authentication Keys"
   - Copy the value next to "Publishable"

4. **Update your `.env.local.db` file:**
   ```bash
   # Replace the key in .env.local.db
   VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
   ```

## Quick Reference

- **Remote Dashboard:** https://app.supabase.com/project/tlpgejkglrgoljgvpubn/settings/api
- **Local Status:** `npm run db:status`

## Important Notes

- ⚠️ **Never commit these keys to git** - they're already in `.gitignore`
- ✅ The `anon` key is safe for frontend use
- ❌ The `service_role` key should NEVER be used in frontend code
- 🔄 Keys are different for local vs remote - make sure you use the right one!
