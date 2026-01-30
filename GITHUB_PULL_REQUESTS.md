# GitHub Pull Requests Guide

## What is a Pull Request (PR)?

A **Pull Request** is a way to propose changes to your codebase. It's like saying:

> "Hey, I made some changes in this branch. Can you review them and merge them into the main branch?"

## How Pull Requests Work

### The Flow

```
1. Create Feature Branch
   └─> Make Changes
       └─> Commit Changes
           └─> Push to GitHub
               └─> Create Pull Request
                   └─> Review & Discuss
                       └─> Merge to Main
                           └─> Deploy to Production
```

### Step-by-Step Process

#### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main  # Get latest changes
git checkout -b feature/my-new-feature
```

#### 2. Make Your Changes

Edit files, add features, fix bugs, etc.

#### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

#### 4. Push to GitHub

```bash
git push -u origin feature/my-new-feature
```

#### 5. Create Pull Request on GitHub

1. Go to your repository on GitHub
2. You'll see a banner: "Compare & pull request"
3. Click it, or go to **Pull requests** → **New pull request**
4. Select:
   - **Base branch**: `main` (where you want to merge TO)
   - **Compare branch**: `feature/my-new-feature` (your changes)
5. Fill out the PR template
6. Click **Create pull request**

#### 6. Review Process

- **Review your own PR**: Check the diff, verify changes
- **Get feedback**: Others can comment on specific lines
- **Make updates**: Push more commits to the same branch (PR updates automatically)
- **Resolve discussions**: Address comments and mark as resolved

#### 7. Merge the PR

Once approved and ready:

1. Click **Merge pull request**
2. Choose merge type:
   - **Squash and merge** (recommended): Combines all commits into one
   - **Merge commit**: Preserves all individual commits
   - **Rebase and merge**: Linear history (less common)
3. Confirm merge
4. Delete the feature branch (optional, but recommended)

## PR Template

When you create a PR, GitHub automatically uses `.github/pull_request_template.md`:

- **Description**: What changes you made and why
- **Database Changes**: Any migrations or schema changes
- **Testing**: How you tested the changes
- **Checklist**: Pre-merge verification items

## Best Practices

### ✅ Do's

- **Write clear PR descriptions**: Explain what and why
- **Keep PRs focused**: One feature/fix per PR
- **Link related issues**: Use "Closes #123" to auto-close issues
- **Request reviews**: Ask teammates to review (if you have any)
- **Test before merging**: Verify everything works
- **Keep PRs small**: Easier to review and less risky

### ❌ Don'ts

- **Don't merge your own PRs immediately**: Give yourself time to review
- **Don't skip the template**: Fill out all relevant sections
- **Don't mix unrelated changes**: Create separate PRs
- **Don't force push to main**: Always use PRs

## PR Workflow for This Project

### Standard Workflow

1. **Create feature branch**: `git checkout -b feature/add-inventory-tracking`
2. **Make changes**: Code, test locally
3. **Create migration** (if needed): `npm run db:migrate add_tracking`
4. **Test locally**: `npm run db:reset && npm run dev`
5. **Push migration** (if backward-compatible): `npm run db:push`
6. **Commit and push**: `git push origin feature/add-inventory-tracking`
7. **Create PR**: Use GitHub interface
8. **Fill PR template**: Check all boxes
9. **Wait for Vercel preview**: Check preview deployment
10. **Review and test**: Test on preview URL
11. **Merge to main**: Deploys to production domain

### PR Checklist

Before creating a PR:

- [ ] Code works locally
- [ ] Migrations tested (if applicable)
- [ ] Types updated (if schema changed)
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)
- [ ] PR description filled out
- [ ] Database changes documented

## Common PR Actions

### Update a PR

Just push more commits to the same branch:

```bash
git add .
git commit -m "fix: address review comments"
git push origin feature/my-feature
```

The PR updates automatically!

### Close a PR Without Merging

If you decide not to merge:

1. Click **Close pull request**
2. Delete the branch (optional)

### Reopen a Closed PR

1. Go to closed PRs
2. Click **Reopen pull request**

## PR vs Direct Push to Main

### Using PRs (Recommended) ✅

- **Safety**: Review before merging
- **History**: Clear record of what changed and why
- **Rollback**: Easy to see what to revert
- **Testing**: Preview deployments for each PR
- **Documentation**: PR descriptions explain changes

### Direct Push to Main ❌

- **Risky**: No review process
- **No preview**: Can't test before production
- **Hard to track**: Less clear history
- **No safety net**: Mistakes go straight to production

## For Solo Developers

Even if you're working alone, PRs are still valuable:

- **Preview deployments**: Test on Vercel before production
- **Documentation**: PR descriptions explain your changes
- **History**: Clear record of what changed
- **Practice**: Good habit for when you collaborate
- **Safety**: Review your own code before merging

## Next Steps

1. **Create your first real PR**: Try the workflow with a small feature
2. **Review the diff**: Check what changed
3. **Test the preview**: Use the Vercel preview URL
4. **Merge when ready**: Deploy to production

---

**Remember**: PRs are your safety net. Even for solo projects, they help you catch issues before they reach production!
