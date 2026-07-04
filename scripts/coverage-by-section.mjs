#!/usr/bin/env node
/**
 * Print line/branch/function coverage grouped by project section.
 * Reads coverage/coverage-final.json (produced by npm run test:coverage).
 */
import fs from 'node:fs'
import path from 'node:path'

const coveragePath = path.resolve('coverage/coverage-final.json')
if (!fs.existsSync(coveragePath)) {
  console.error(
    'No coverage report found. Run: npm run test:coverage\nExpected: coverage/coverage-final.json',
  )
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
const root = process.cwd() + path.sep

function pct(hit, total) {
  return total ? +((100 * hit) / total).toFixed(1) : 0
}

function getBucket(absFile) {
  const file = absFile.startsWith(root)
    ? absFile.slice(root.length).replace(/\\/g, '/')
    : absFile
  if (file.startsWith('api/')) return 'api'
  if (file.startsWith('src/features/')) {
    const m = file.match(/^src\/features\/([^/]+)/)
    return m ? `feature:${m[1]}` : 'feature:unknown'
  }
  if (file.startsWith('src/shared/')) {
    const m = file.match(/^src\/shared\/([^/]+)/)
    return m ? `shared:${m[1]}` : 'shared:root'
  }
  if (file.startsWith('src/app/')) return 'app'
  return 'other'
}

const buckets = {}

for (const [file, cov] of Object.entries(data)) {
  const bucket = getBucket(file)
  if (!buckets[bucket]) {
    buckets[bucket] = { s: 0, sc: 0, b: 0, bc: 0, f: 0, fc: 0, files: 0 }
  }
  const entry = buckets[bucket]
  entry.files++
  for (const v of Object.values(cov.s ?? {})) {
    entry.s++
    if (v > 0) entry.sc++
  }
  for (const v of Object.values(cov.b ?? {})) {
    for (const x of v) {
      entry.b++
      if (x > 0) entry.bc++
    }
  }
  for (const v of Object.values(cov.f ?? {})) {
    entry.f++
    if (v > 0) entry.fc++
  }
}

function rollup(prefix) {
  let files = 0
  let s = 0
  let sc = 0
  let b = 0
  let bc = 0
  let f = 0
  let fc = 0
  for (const [key, v] of Object.entries(buckets)) {
    if (prefix === 'feature' && !key.startsWith('feature:')) continue
    if (prefix === 'shared' && !key.startsWith('shared:')) continue
    if (prefix !== 'feature' && prefix !== 'shared' && key !== prefix) continue
    files += v.files
    s += v.s
    sc += v.sc
    b += v.b
    bc += v.bc
    f += v.f
    fc += v.fc
  }
  return {
    files,
    lines: pct(sc, s),
    branches: pct(bc, b),
    functions: pct(fc, f),
  }
}

const rows = Object.entries(buckets)
  .map(([section, v]) => ({
    section,
    files: v.files,
    lines: pct(v.sc, v.s),
    branches: pct(v.bc, v.b),
    functions: pct(v.fc, v.f),
  }))
  .sort((a, b) => a.section.localeCompare(b.section))

console.log('\nCoverage by section\n')
console.table(rows)

console.log('\nRollups\n')
for (const label of ['feature', 'shared', 'app', 'api']) {
  const r = rollup(label)
  console.log(
    `  ${label.padEnd(10)} ${r.files} files  lines ${r.lines}%  branches ${r.branches}%  functions ${r.functions}%`,
  )
}

let totalS = 0
let totalSc = 0
for (const v of Object.values(buckets)) {
  totalS += v.s
  totalSc += v.sc
}
console.log(
  `\n  ${'TOTAL'.padEnd(10)} ${Object.values(buckets).reduce((n, v) => n + v.files, 0)} files  lines ${pct(totalSc, totalS)}%\n`,
)
