/**
 * Expand two numeric domains so their zeros sit at the same fraction of the
 * plot height (needed for dual Y-axes in Recharts).
 */
export function syncZeroAlignedDomains(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): { a: [number, number]; b: [number, number] } {
  let aLo = Math.min(aMin, 0)
  let aHi = Math.max(aMax, 0)
  let bLo = Math.min(bMin, 0)
  let bHi = Math.max(bMax, 0)

  if (aHi === aLo) aHi = aLo + 1
  if (bHi === bLo) bHi = bLo + 1

  const aDown = 0 - aLo
  const aUp = aHi - 0
  const bDown = 0 - bLo
  const bUp = bHi - 0

  const aRatioBelow = aDown / (aDown + aUp)
  const bRatioBelow = bDown / (bDown + bUp)

  if (aRatioBelow > bRatioBelow) {
    if (aRatioBelow >= 1) {
      // A is entirely ≤ 0 — pin both highs at 0 and match lows by span.
      const span = Math.max(aDown, bDown, 1)
      aLo = -span
      aHi = 0
      bLo = -span
      bHi = 0
    } else {
      const bDownNeeded = (aRatioBelow * bUp) / (1 - aRatioBelow)
      bLo = -bDownNeeded
    }
  } else if (bRatioBelow > aRatioBelow) {
    if (bRatioBelow >= 1) {
      const span = Math.max(aDown, bDown, 1)
      aLo = -span
      aHi = 0
      bLo = -span
      bHi = 0
    } else {
      const aDownNeeded = (bRatioBelow * aUp) / (1 - bRatioBelow)
      aLo = -aDownNeeded
    }
  }

  return { a: [aLo, aHi], b: [bLo, bHi] }
}

export function monthlyChartDomains(
  points: Array<{
    income: number
    expenses: number
    profit: number
    job_count: number
  }>,
): { money: [number, number]; jobs: [number, number] } {
  let moneyMin = 0
  let moneyMax = 0
  let jobsMax = 0
  for (const p of points) {
    moneyMin = Math.min(moneyMin, p.income, p.expenses, p.profit)
    moneyMax = Math.max(moneyMax, p.income, p.expenses, p.profit)
    jobsMax = Math.max(jobsMax, p.job_count)
  }
  const { a: money, b: jobs } = syncZeroAlignedDomains(
    moneyMin,
    moneyMax,
    0,
    Math.max(jobsMax, 1),
  )
  return { money, jobs }
}
