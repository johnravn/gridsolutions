import { execSync } from 'node:child_process'

export default async function globalSetup() {
  execSync('node scripts/seed-test-users.mjs', {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
}
