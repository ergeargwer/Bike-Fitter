#!/bin/bash
set -e

# Send a Slack notification if SLACK_WEBHOOK_URL is set.
# Usage: notify_failure "message"
notify_failure() {
  local MESSAGE="$1"
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    local PAYLOAD
    PAYLOAD=$(printf '{"text":"%s"}' "$MESSAGE")
    curl -s -X POST -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$SLACK_WEBHOOK_URL" >/dev/null || true
  fi
}

pnpm install --frozen-lockfile
pnpm --filter db push

# Run CI checks before syncing to GitHub
# Build is scoped to non-Expo artifacts: bike-fitter-mobile uses Metro bundler
# which requires the full Expo workflow environment and always times out in CI.
# Typecheck already catches all type errors for the mobile artifact.
echo "Running CI checks (typecheck + build)..."
if ! pnpm run typecheck; then
  echo "ERROR: typecheck failed — skipping GitHub sync"
  notify_failure "Bike Fitter post-merge: typecheck failed — GitHub sync skipped."
  exit 1
fi
if ! pnpm --filter "!@workspace/bike-fitter-mobile" run build; then
  echo "ERROR: build failed — skipping GitHub sync"
  notify_failure "Bike Fitter post-merge: build failed — GitHub sync skipped."
  exit 1
fi
echo "CI checks passed."

# Auto-sync to GitHub
if [ -n "$GITHUB_TOKEN" ]; then
  GITHUB_REMOTE="https://ergeargwer:${GITHUB_TOKEN}@github.com/ergeargwer/Bike-Fitter.git"
  if git remote get-url github >/dev/null 2>&1; then
    git remote set-url github "$GITHUB_REMOTE"
  else
    git remote add github "$GITHUB_REMOTE"
  fi

  git config user.email "123177572+ergeargwer@users.noreply.github.com"
  git config user.name "Peter0910"

  # Fetch latest remote state
  git fetch github main -q

  AHEAD=$(git rev-list --count github/main..HEAD 2>/dev/null || echo 0)
  BEHIND=$(git rev-list --count HEAD..github/main 2>/dev/null || echo 0)

  if [ "$AHEAD" -eq 0 ] && [ "$BEHIND" -eq 0 ]; then
    echo "GitHub already up-to-date."
  elif [ "$BEHIND" -gt 0 ]; then
    # Local is behind or diverged — stash, rebase, push, restore
    echo "Local is $BEHIND commit(s) behind GitHub — rebasing before push..."
    STASHED=0
    if ! git diff --quiet || ! git diff --cached --quiet; then
      git stash push -u -q -m "post-merge-sync-stash"
      STASHED=1
    fi
    if ! git rebase github/main -q; then
      notify_failure "Bike Fitter post-merge: rebase against github/main failed — manual intervention required."
      exit 1
    fi
    AHEAD_AFTER=$(git rev-list --count github/main..HEAD 2>/dev/null || echo 0)
    if [ "$AHEAD_AFTER" -gt 0 ]; then
      if ! git push github main; then
        notify_failure "Bike Fitter post-merge: git push to GitHub failed (after rebase)."
        exit 1
      fi
      echo "Pushed $AHEAD_AFTER commit(s) to GitHub after rebase."
    else
      echo "Nothing new to push after rebase."
    fi
    if [ "$STASHED" -eq 1 ]; then
      git stash pop -q || true
    fi
  else
    # Local is purely ahead — simple fast-forward push
    echo "Pushing $AHEAD commit(s) to GitHub..."
    if ! git push github main; then
      notify_failure "Bike Fitter post-merge: git push to GitHub failed."
      exit 1
    fi
  fi
else
  echo "GITHUB_TOKEN is not set — skipping GitHub sync"
fi
