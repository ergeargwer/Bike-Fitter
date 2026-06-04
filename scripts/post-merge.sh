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

# Verify the GitHub token can access the target repository before touching git.
# Uses the repo endpoint so scope issues (e.g. missing 'repo' write access) are
# caught as 403/404 rather than discovered only at push time.
# Exits immediately with a clear message on 401/403/404 — these are not transient.
check_github_token() {
  local HTTP_CODE
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    https://api.github.com/repos/ergeargwer/Bike-Fitter)
  if [ "$HTTP_CODE" = "401" ]; then
    echo "ERROR: GitHub token is invalid or expired (HTTP 401)."
    echo "       Regenerate GITHUB_TOKEN and update the secret."
    notify_failure "Bike Fitter post-merge: GitHub token is invalid or expired (HTTP 401) — regenerate GITHUB_TOKEN."
    exit 1
  fi
  if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "ERROR: GitHub token lacks access to the repository (HTTP $HTTP_CODE)."
    echo "       Ensure GITHUB_TOKEN has 'repo' scope for ergeargwer/Bike-Fitter."
    notify_failure "Bike Fitter post-merge: GitHub token lacks repo access (HTTP $HTTP_CODE) — check token scope."
    exit 1
  fi
}

# Push to GitHub with fine-grained error classification.
# Auth errors (non-retryable) exit 1 immediately with a clear regenerate-token
# message. Transient network/server errors exit 1 with a retry hint. Unknown
# errors exit 1 with a log-inspection hint.
#
# Uses '|| PUSH_EXIT=$?' to capture the exit code safely under set -e before
# any further processing (a plain assignment would abort the script on failure).
#
# Usage: git_push_checked [<context-label>]
git_push_checked() {
  local LABEL="${1:-}"
  local PUSH_OUTPUT PUSH_EXIT
  PUSH_EXIT=0
  PUSH_OUTPUT=$(git push github main 2>&1) || PUSH_EXIT=$?

  if [ "$PUSH_EXIT" -eq 0 ]; then
    return 0
  fi

  echo "$PUSH_OUTPUT"
  local SUFFIX=""
  [ -n "$LABEL" ] && SUFFIX=" ($LABEL)"

  # Authentication / authorisation failures — non-retryable, fail fast.
  if echo "$PUSH_OUTPUT" | grep -qiE \
      "(Authentication failed|403|401|invalid credentials|permission denied|access denied|repository not found|could not read Username)"; then
    echo "ERROR: GitHub push rejected — authentication or authorisation failure${SUFFIX}."
    echo "       Regenerate GITHUB_TOKEN with 'repo' scope and update the secret."
    notify_failure "Bike Fitter post-merge: GitHub push failed — token auth error${SUFFIX}. Regenerate GITHUB_TOKEN."
    exit 1
  fi

  # Transient network / server errors — worth retrying manually.
  if echo "$PUSH_OUTPUT" | grep -qiE \
      "(timed out|timeout|connection reset|connection refused|could not connect|unable to connect|network is unreachable|temporarily unavailable|service unavailable|HTTP 5[0-9][0-9])"; then
    echo "ERROR: GitHub push failed — transient network or server error${SUFFIX}. Re-run the sync to retry."
    notify_failure "Bike Fitter post-merge: GitHub push failed — transient error${SUFFIX}. Re-run the sync to retry."
    exit 1
  fi

  # Unknown push failure — log output already printed above for diagnosis.
  echo "ERROR: GitHub push failed — unexpected error${SUFFIX}. Check the sync log for details."
  notify_failure "Bike Fitter post-merge: GitHub push failed — unexpected error${SUFFIX}. Check the sync log."
  exit 1
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
  # Validate token against the repo endpoint before any git operations.
  # This catches expired tokens and missing 'repo' scope upfront.
  check_github_token

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
      git_push_checked "after rebase"
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
    git_push_checked
  fi
else
  echo "GITHUB_TOKEN is not set — skipping GitHub sync"
fi
