# Supabase CLI & TypeScript Types Setup Guide

## ✅ What's Been Set Up

1. **Supabase CLI** installed as a dev dependency
2. **Project initialized** with `supabase init` - created `/supabase` directory
3. **TypeScript types** infrastructure ready at `src/shared/types/database.types.ts`
4. **Supabase client updated** to use TypeScript types
5. **NPM scripts added** for easy database operations

## 🎯 What You Need to Do (Manual Steps)

### Two Options: Simple (No Docker) vs Full (With Docker)

#### ⚡ OPTION A: Simple Setup (No Docker Required - Recommended to Start)

**Step 1:** Create a file called `.env.local` in your project root:

```env
# Your Supabase project URL (from project settings)
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Your Supabase anon/public key (from project settings > API)
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Your Supabase project reference ID (from project URL or settings)
SUPABASE_PROJECT_REF=your-project-ref
```

> **Where to find these:**
>
> - Go to your Supabase dashboard
> - Project Settings → API
> - The project ref is in your project URL: `https://app.supabase.com/project/YOUR-PROJECT-REF`

**Step 2:** Login to Supabase CLI (run in your terminal):

```bash
npx supabase login
```

This opens a browser for authentication. You only need to do this once.

**Step 3:** Link to your remote project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

**Step 4:** Generate TypeScript types directly from remote:

```bash
npm run db:types:remote
```

**That's it!** You now have type-safe TypeScript definitions without Docker.

---

#### 🐳 OPTION B: Full Setup (With Docker - For Local Development)

If you want to run a local Supabase instance or create migrations, you'll need Docker:

**Step 1-3:** Same as Option A above

**Step 4:** Install Docker Desktop from https://www.docker.com/products/docker-desktop

**Step 5:** Pull your database schema:

```bash
npx supabase db pull
```

This creates migration files in `supabase/migrations/` representing your current database.

**Step 6:** Generate TypeScript types:

```bash
npm run db:types:remote
```

## 📝 Daily Workflow

### When You Make Database Changes

**Option A: Changes via Supabase Dashboard**

1. Make your changes in the Supabase dashboard
2. Pull the changes: `npx supabase db pull`
3. Generate new types: `npm run db:types:remote`
4. Commit the migration files to git

**Option B: Changes via SQL Migration Files**

1. Create a new migration: `npx supabase migration new your_change_name`
2. Edit the migration file in `supabase/migrations/`
3. Push to remote: `npm run db:push`
4. Generate new types: `npm run db:types:remote`

## 🛠️ Available Commands

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run db:types`        | Generate types from local database   |
| `npm run db:types:remote` | Generate types from remote database  |
| `npm run db:diff <name>`  | Create migration from remote changes |
| `npm run db:reset`        | Reset local database to migrations   |
| `npm run db:push`         | Push local migrations to remote      |

## 💡 Benefits for AI Development

Once you generate the types, I (your AI assistant) can:

- ✅ See your exact database schema
- ✅ Provide type-safe code suggestions
- ✅ Catch database-related errors before runtime
- ✅ Auto-complete table and column names
- ✅ Understand relationships between tables

## 🎉 Usage Example

After generating types, your Supabase queries will be fully type-safe:

```typescript
// Before (no types)
const { data } = await supabase.from('jobs').select('*')
// data is 'any' 😢

// After (with types)
const { data } = await supabase.from('jobs').select('*')
// data is Jobs[] with autocomplete! 🎉
```

## 📚 More Info

- Full Supabase CLI docs: https://supabase.com/docs/guides/cli
- Migration guide: https://supabase.com/docs/guides/cli/local-development
