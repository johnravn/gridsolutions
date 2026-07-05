/**
 * Run Vitest with pre/post cleanup of orphaned worker processes.
 */
import { spawn } from 'node:child_process'
import { killVitestOrphans } from './kill-vitest-orphans.mjs'

const args = process.argv.slice(2)

killVitestOrphans({ quiet: true, workersOnly: true })

const child = spawn('npx', ['vitest', ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
})

let cleanedUp = false

function cleanup(exitCode = 0) {
  if (cleanedUp) return
  cleanedUp = true
  killVitestOrphans({ quiet: true, workersOnly: true })
  process.exit(exitCode)
}

child.on('exit', (code, signal) => {
  if (signal) {
    cleanup(1)
    return
  }
  cleanup(code ?? 0)
})

child.on('error', () => {
  cleanup(1)
})

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    child.kill(signal)
    setTimeout(() => cleanup(130), 2_000)
  })
}
