# Supabase Local Development Setup

This directory contains your Supabase configuration and migrations.

## Quick Start (No Docker Required!)

### 1. Login to Supabase CLI

```bash
npx supabase login
```

This will open a browser window for you to authenticate.

### 2. Link to Your Remote Project

You need your Supabase project reference ID (found in your project settings or URL).

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Generate TypeScript Types

Generate types directly from your remote database (no Docker needed):

```bash
npm run db:types:remote
```

**That's it!** You're ready to develop with type-safe database access.

---

## Optional: Pull Schema as Migrations (Requires Docker)

If you want to track your database schema as migration files:

**Note:** This requires Docker Desktop to be installed and running.

```bash
npx supabase db pull
```

This will create migration files in `supabase/migrations/` that represent your current database state.

If you're working with a local Supabase instance:

```bash
npm run db:types
```

## Daily Workflow

### Making Schema Changes

1. Make changes in your Supabase dashboard or via SQL
2. Generate a migration file:
   ```bash
   npm run db:diff new_migration_name
   ```
3. Regenerate types:
   ```bash
   npm run db:types:remote
   ```

### Available Commands

- `npm run db:types` - Generate types from local database
- `npm run db:types:remote` - Generate types from remote database
- `npm run db:diff <name>` - Create a migration from remote changes
- `npm run db:reset` - Reset local database to migrations
- `npm run db:push` - Push local migrations to remote

## Environment Variables

Make sure you have these in your `.env.local`:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_PROJECT_REF=your-project-ref
```
