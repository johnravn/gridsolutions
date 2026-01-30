# Docker Installation Guide for macOS

## Quick Install Steps

### 1. Determine Your Mac's Processor

Run this command to check:

```bash
uname -m
```

- `arm64` = Apple Silicon (M1/M2/M3) → Download **Apple Chip** version
- `x86_64` = Intel → Download **Intel Chip** version

### 2. Download Docker Desktop

**For Apple Silicon (M1/M2/M3):**

- Direct download: https://desktop.docker.com/mac/main/arm64/Docker.dmg

**For Intel Macs:**

- Direct download: https://desktop.docker.com/mac/main/amd64/Docker.dmg

**Or visit:** https://www.docker.com/products/docker-desktop/

### 3. Install Docker Desktop

1. Open the downloaded `Docker.dmg` file
2. Drag the Docker icon to your Applications folder
3. Open Docker from Applications (or Launchpad)
4. Click "Open" when macOS asks for permission
5. Enter your password if prompted
6. Accept the Docker Subscription Service Agreement

### 4. Verify Installation

Once Docker Desktop is running (you'll see the Docker whale icon in your menu bar), verify it works:

```bash
docker --version
docker ps
```

### 5. Start Using Docker with Supabase

After Docker is installed and running:

```bash
# Start local Supabase
npm run supabase:start

# Check status
npm run db:status
```

## Troubleshooting

### Docker Desktop Won't Start

1. **Check System Requirements:**
   - macOS 10.15 or newer
   - At least 4GB RAM
   - VirtualBox prior to version 4.3.30 must NOT be installed

2. **Grant Permissions:**
   - System Preferences → Security & Privacy → Allow Docker

3. **Restart Docker:**
   - Quit Docker Desktop completely
   - Restart your Mac if needed
   - Launch Docker Desktop again

### "Docker daemon not running"

- Make sure Docker Desktop is running (whale icon in menu bar)
- Click the Docker icon → "Start" if it's stopped

### Rosetta 2 (for Apple Silicon)

If you encounter compatibility issues, install Rosetta 2:

```bash
softwareupdate --install-rosetta
```

## Next Steps After Installation

1. **Start Docker Desktop** (keep it running)
2. **Start local Supabase:**
   ```bash
   npm run supabase:start
   ```
3. **Get local credentials:**
   ```bash
   npm run db:status
   ```
4. **Update `.env.local`** with local URLs (optional, for local development)

## Resources

- [Official Docker Desktop Docs](https://docs.docker.com/desktop/install/mac-install/)
- [Docker Desktop Download](https://www.docker.com/products/docker-desktop/)
