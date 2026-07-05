/**
 * Kill orphaned Vitest worker processes for this project.
 *
 * Vitest's fork pool can leave `node (vitest N)` workers running when the parent
 * process exits abruptly (IDE cancel, piped output/SIGPIPE, SIGKILL, etc.).
 * See https://github.com/vitest-dev/vitest/issues/8800
 */
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = process.cwd()

function listProcesses() {
  try {
    return execSync('ps -ax -o pid=,ppid=,command=', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
        if (!match) return null
        return {
          pid: Number(match[1]),
          ppid: Number(match[2]),
          command: match[3],
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function getProcessCwd(pid) {
  try {
    const out = execSync(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`, {
      encoding: 'utf8',
    })
    const match = out.match(/^n(.+)$/m)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function isVitestWorker(command) {
  return /node \(vitest \d+\)/.test(command)
}

function isVitestMain(command) {
  return /node \(vitest\)/.test(command) && !isVitestWorker(command)
}

function belongsToProject(pid) {
  const cwd = getProcessCwd(pid)
  return cwd?.startsWith(projectRoot) ?? false
}

export function killVitestOrphans({ quiet = false, workersOnly = false } = {}) {
  const processes = listProcesses()
  let killed = 0

  for (const proc of processes) {
    if (!belongsToProject(proc.pid)) continue

    const worker = isVitestWorker(proc.command)
    const main = isVitestMain(proc.command)
    if (!worker && !main) continue
    if (workersOnly && !worker) continue

    try {
      process.kill(proc.pid, 'SIGTERM')
      killed++
    } catch {
      // already exited
    }
  }

  if (!quiet && killed > 0) {
    console.log(
      `Stopped ${killed} leftover Vitest process(es) for ${projectRoot}`,
    )
  }

  return killed
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMain) {
  killVitestOrphans()
}
