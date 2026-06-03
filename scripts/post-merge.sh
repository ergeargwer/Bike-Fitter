#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Auto-sync to GitHub
if [ -n "$GITHUB_TOKEN" ]; then
  GITHUB_REMOTE="https://ergeargwer:${GITHUB_TOKEN}@github.com/ergeargwer/Bike-Fitter.git"
  if git remote get-url github >/dev/null 2>&1; then
    git remote set-url github "$GITHUB_REMOTE"
  else
    git remote add github "$GITHUB_REMOTE"
  fi

  # Fetch latest remote state so the ahead count is accurate
  git fetch github main -q 2>/dev/null || true

  AHEAD=$(git rev-list --count github/main..HEAD 2>/dev/null || echo 0)

  if [ "$AHEAD" -gt 0 ]; then
    echo "Pushing $AHEAD commit(s) to GitHub..."
    # Non-force push only — protected branches reject force-push;
    # if push fails (e.g. required status checks), log a warning but
    # do NOT fail the post-merge setup so the merge itself still succeeds.
    git push github main 2>&1 || echo "WARNING: GitHub push skipped (branch protection or network issue — push manually when checks pass)"
  else
    echo "GitHub already up-to-date."
  fi
else
  echo "GITHUB_TOKEN is not set — skipping GitHub sync"
fi
