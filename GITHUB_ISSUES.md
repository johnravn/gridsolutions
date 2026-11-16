# GitHub Issues & Feature-Branch Shipping

This repo uses **GitHub issues** as the unit of work. Day-to-day work happens on **one feature branch per change** so Vercel can publish a **Preview URL**. Production ships only when that branch is **merged into `main`**.

Agent rule (always on): `.cursor/rules/git-workflow.mdc`

## Flow

```
Issue (existing or created)
  └─> Feature branch from main (cursor/…)
      └─> Verify on hosted Dev + quality gates
          └─> Commit referencing the issue (only when John asks)
              └─> git push origin <feature-branch> (only when John asks)
                  └─> Vercel Preview (+ optional PR for review)
                      └─> When John asks to ship: merge → main → Production
                          └─> Closes #N auto-closes when the commit lands on main
```

**Review before ship:** Vercel Preview URL, agent desktop / Live, and/or local `npm run dev` against hosted Dev. Prefer Preview links for cloud-agent handoff. Do **not** use a shared staging branch.

## Issues

Use `gh` for everything:

```bash
gh issue list --state open --limit 30
gh issue view 142
gh issue create --title "Add customer CSV export" --body "..."
```

- Reuse an open issue when it already covers the work.
- Create a new issue only when nothing open fits.
- One issue per piece of work is enough; large issues are fine.

## Commits

Large commits are fine. Prefer **one commit per issue** (or one commit that closes every issue this change finishes).

Every commit must mention the issue:

```
Add customer CSV export

Closes #142
```

| Intent              | Keyword                  | Effect when landed on `main` |
| ------------------- | ------------------------ | ---------------------------- |
| Work is done        | `Closes #N` / `Fixes #N` | Issue auto-closes            |
| Partial / follow-up | `Refs #N`                | Issue stays open             |
| Several issues      | `Closes #12, #34`        | All listed issues close      |

## Branches & push

```bash
git checkout main
git pull origin main
git checkout -b cursor/add-customer-csv-export
# ... work ...
npm run check && npm run test && npm run build:check   # required before shipping to main
git add -A
git commit -m "$(cat <<'EOF'
Add customer CSV export

Closes #142
EOF
)"
git push -u origin HEAD
# Optional: open a PR for review + Preview link
```

- Pushing a **feature branch** (or opening a PR) triggers a **Vercel Preview** — not production.
- Shipping: when John asks, merge into `main` (PR merge or local merge), bump version if needed, push `main` → Production (`gridsolutions.app`).
- GitHub Actions CI already runs on `pull_request` and on pushes to `main`.

Do not force-push `main` unless explicitly asked. Do not commit or `git push` unless John explicitly asks (see `.cursor/rules/no-unsolicited-ship.mdc`). Asking to push a feature branch / open a PR is **not** permission to merge to `main`.

## Do not

- Push or merge to `main` unless John asks to ship
- Use a shared long-lived staging branch as the default review path
- Commit without an issue reference
- Force-push `main` unless explicitly asked
- Commit or `git push` unless John explicitly asks
