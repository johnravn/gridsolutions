# Local Supabase Development Workflow (with Docker)

## 🎯 Yes, You Get the Same GUI!

When you run `npm run supabase:start`, you get **Supabase Studio** - the exact same interface you see on supabase.com, but running locally on your machine.

## 🚀 Quick Start

### 1. Start Local Supabase

```bash
npm run supabase:start
```

This will:

- Pull Docker images (first time only - takes a few minutes)
- Start all Supabase services
- Create a local database
- Apply all your migrations

### 2. Access Supabase Studio (GUI)

Once it's running, open your browser to:

**http://localhost:54323**

This is your **local Supabase Studio** - same interface as supabase.com!

### 3. Get Your Local Credentials

```bash
npm run db:status
```

This shows you:

- **API URL**: `http://127.0.0.1:54321`
- **Studio URL**: `http://localhost:54323`
- **Anon Key**: (for your `.env.local`)
- **Service Role Key**: (for admin operations)

## 📊 What You Get Locally

### Supabase Studio (GUI) - Port 54323

- ✅ **Table Editor** - View/edit tables just like on supabase.com
- ✅ **SQL Editor** - Run SQL queries
- ✅ **Authentication** - Manage users
- ✅ **Storage** - Manage buckets and files
- ✅ **Database** - View schema, relationships, etc.
- ✅ **Logs** - See API and database logs
- ✅ **Settings** - Configure your local instance

### API - Port 54321

- Your app connects to: `http://127.0.0.1:54321`
- Same API as production, but local

### Database - Port 54322

- Direct PostgreSQL connection
- Connection string shown in `npm run db:status`

### Other Services

- **Inbucket** (Email testing): http://localhost:54324
- **Analytics**: Port 54327

## 🔄 Daily Workflow with Local Supabase

### Option A: Use the GUI (Like supabase.com)

1. **Start Supabase:**

   ```bash
   npm run supabase:start
   ```

2. **Open Studio:** http://localhost:54323

3. **Make changes in the GUI:**
   - Create/edit tables
   - Add columns
   - Create relationships
   - Test queries

4. **Capture changes as migration:**

   ```bash
   npm run db:diff capture_gui_changes
   ```

   This creates a migration file from your GUI changes!

5. **Test your app:**
   - Update `.env.local` to use local URLs (optional)
   - Your app connects to local Supabase
   - Fast iteration, no network latency!

### Option B: Use Migration Files (Recommended)

1. **Start Supabase:**

   ```bash
   npm run supabase:start
   ```

2. **Create migration:**

   ```bash
   npm run db:migrate add_new_feature
   ```

3. **Edit the migration file** in `supabase/migrations/`

4. **Apply migration:**

   ```bash
   npm run db:reset  # Resets and applies all migrations
   # OR
   npx supabase migration up  # Applies new migrations only
   ```

5. **View in Studio:** http://localhost:54323

6. **Generate types:**
   ```bash
   npm run db:types  # From local
   ```

## 🎨 Using Supabase Studio Locally

### Accessing the Studio

1. Make sure Supabase is running:

   ```bash
   npm run db:status
   ```

2. Open: **http://localhost:54323**

3. You'll see the familiar Supabase interface!

### What You Can Do in Studio

- **Table Editor:**
  - View all your tables
  - Add/edit/delete rows
  - See relationships
  - Edit column types

- **SQL Editor:**
  - Run queries
  - Test migrations
  - Debug issues

- **Authentication:**
  - Create test users
  - Test login flows
  - Manage sessions

- **Storage:**
  - Upload test files
  - Test bucket policies
  - Manage storage

- **Database:**
  - View schema
  - See indexes
  - Check RLS policies
  - View functions/triggers

## 🔧 Switching Between Local and Remote

### For Local Development

Update `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<get-from-npm-run-db-status>
```

### For Production/Staging

Use remote URLs:

```env
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=<your-remote-key>
```

## 💡 Best Practices

### 1. Start Fresh When Needed

```bash
# Reset local database (applies all migrations)
npm run db:reset
```

### 2. Capture GUI Changes

If you make changes in Studio GUI:

```bash
npm run db:diff capture_changes
```

### 3. Test Migrations Locally First

```bash
# Create migration
npm run db:migrate test_feature

# Edit migration file
# ...

# Test it
npm run db:reset

# If good, push to remote
npm run db:push
```

### 4. Keep Types in Sync

```bash
# After local changes
npm run db:types

# Before deploying
npm run db:types:remote
```

## 🛠️ Useful Commands

```bash
# Start Supabase
npm run supabase:start

# Stop Supabase
npm run supabase:stop

# Check status (shows all URLs and keys)
npm run db:status

# Reset database (fresh start)
npm run db:reset

# Generate types from local
npm run db:types

# Generate types from remote
npm run db:types:remote
```

## 🎯 Workflow Comparison

### Remote (supabase.com)

- ✅ Production data
- ✅ Shared with team
- ❌ Network latency
- ❌ API rate limits
- ❌ Costs (on paid plans)

### Local (Docker)

- ✅ Fast (no network)
- ✅ Free (no limits)
- ✅ Safe to experiment
- ✅ Works offline
- ❌ Data is local only
- ❌ Not shared

## 🚨 Important Notes

1. **Local data is temporary** - Resets when you run `db:reset`
2. **Use migrations** - Don't rely on GUI changes alone
3. **Test locally, deploy remotely** - Best of both worlds
4. **Keep Docker running** - Supabase needs Docker Desktop to be running

## 📝 Example Workflow

```bash
# 1. Start local Supabase
npm run supabase:start

# 2. Open Studio
open http://localhost:54323

# 3. Make changes in GUI or via migrations
npm run db:migrate add_user_preferences

# 4. Test locally
npm run db:reset
npm run db:types

# 5. When ready, push to remote
npm run db:push
npm run db:types:remote
```

## 🎉 You're All Set!

Once Docker finishes pulling images, you'll have:

- ✅ Full Supabase Studio GUI at http://localhost:54323
- ✅ Local API at http://127.0.0.1:54321
- ✅ Fast, free local development
- ✅ Same interface you're used to!
