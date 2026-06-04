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

    MAX_ATTEMPTS=3
    ATTEMPT=0
    PUSH_OK=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
      ATTEMPT=$((ATTEMPT + 1))
      if git push github main 2>&1; then
        PUSH_OK=1
        break
      fi

      if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        WAIT=$((ATTEMPT * 5))
        echo "GitHub push attempt $ATTEMPT failed — retrying in ${WAIT}s..."
        sleep "$WAIT"
      fi
    done

    if [ $PUSH_OK -eq 0 ]; then
      echo "ERROR: GitHub push failed after $MAX_ATTEMPTS attempt(s). Check network connectivity, token permissions, and branch protection rules." >&2
      exit 1
    fi
  else
    echo "GitHub already up-to-date."
  fi
else
  echo "GITHUB_TOKEN is not set — skipping GitHub sync"
fi
