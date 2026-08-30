# GitHub Issues & Shipping on `main`

This repo uses **GitHub issues** as the unit of work and ships by **pushing `main`**. There are no pull requests and no feature branches.

Agent rule (always on): `.cursor/rules/git-workflow.mdc`

## Flow

```
Issue (existing or created)
  └─> Work on main
      └─> Test locally + quality gates
          └─> Commit referencing the issue
              └─> git push origin main
                  └─> Vercel deploys gridsolutions.app
                      └─> Closes #N auto-closes the issue
```

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

| Intent              | Keyword                  | Effect on push to `main` |
| ------------------- | ------------------------ | ------------------------ |
| Work is done        | `Closes #N` / `Fixes #N` | Issue auto-closes        |
| Partial / follow-up | `Refs #N`                | Issue stays open         |
| Several issues      | `Closes #12, #34`        | All listed issues close  |

## Push

```bash
git checkout main
git pull origin main
# ... work ...
npm run check && npm run test && npm run build:check
git add -A
git commit -m "$(cat <<'EOF'
Add customer CSV export

Closes #142
EOF
)"
git push origin main
```

Pushing `main` deploys production. Test locally first — there is no PR preview.

If GitHub blocks the push, turn off branch protection / required PRs on `main` (Settings → Branches). This repo is meant to push `main` directly.

## Do not

- Create pull requests (`gh pr create`, GitHub UI, etc.)
- Create feature branches
- Commit without an issue reference
- Force-push `main` unless explicitly asked
