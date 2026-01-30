# Easy Database Switching Guide

## Quick Switch Commands

Switch between local and remote Supabase databases with simple npm commands:

```bash
# Switch to LOCAL database
npm run db:switch:local

# Switch to REMOTE database
npm run db:switch:remote

# Check current database
npm run db:switch:status
```

## How It Works

The script manages two configuration files:

- `.env.local.db` - Local Supabase settings
- `.env.remote.db` - Remote Supabase settings

When you switch, it updates `.env.local` with the appropriate values while preserving your other environment variables (like API keys).

## Setup

### 1. Initial Setup (One-time)

The script will create the config files automatically on first use. You may need to update them with your actual keys:

**Local Database:**

```bash
# Get your local anon key
npm run db:status

# Update .env.local.db with the key from the output
```

**Remote Database:**

```bash
# Get your remote anon key from:
# https://app.supabase.com/project/tlpgejkglrgoljgvpubn/settings/api

# Update .env.remote.db with your remote anon key
```

### 2. Switching

Just run the command:

```bash
npm run db:switch:local   # Use local database
npm run db:switch:remote  # Use remote database
```

## Workflow Examples

### Development Workflow

```bash
# Start local Supabase
npm run supabase:start

# Switch to local
npm run db:switch:local

# Start your app
npm run dev
```

### Production/Testing Workflow

```bash
# Switch to remote
npm run db:switch:remote

# Start your app (connects to remote)
npm run dev
```

### Quick Check

```bash
# See which database you're using
npm run db:switch:status
```

## What Gets Preserved

When switching, the script preserves all your other environment variables:

- `VITE_GOOGLE_MAPS_PLATFORM_API_KEY`
- `VITE_CONTA_API_URL`
- Any other custom variables

Only the Supabase-related variables are changed:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`

## Troubleshooting

### "No .env.local file found"

Create it manually or the script will create it on first switch.

### Local database not working

Make sure Supabase is running:

```bash
npm run supabase:start
npm run db:status  # Verify it's running
```

### Keys not updating

The config files (`.env.local.db` and `.env.remote.db`) store the keys. Update them directly if needed.

## Tips

- **Always check status** before starting development: `npm run db:switch:status`
- **Keep both configs updated** with the latest keys
- **Use local for development** - it's faster and free
- **Use remote for testing** production-like scenarios
