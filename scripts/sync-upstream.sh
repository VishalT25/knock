#!/usr/bin/env bash
# Brings the latest Knock code into this repository.
#
# The Deploy button gives you a copy of Knock with no shared git history, so `git pull` can't update it.
# This script instead makes your code files match the latest Knock release exactly, on the current branch,
# and commits the result. Your settings are not in the code (they live in Vercel's environment variables and
# in your database), so they are untouched. The `.github` folder is left alone.
#
# Usage, from the root of your repository:   bash scripts/sync-upstream.sh
set -euo pipefail

UPSTREAM="${KNOCK_UPSTREAM:-https://github.com/VishalT25/knock.git}"
BRANCH="${KNOCK_BRANCH:-main}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Run this from inside your Knock repository." >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "You have uncommitted changes. Commit or stash them first." >&2; exit 1; }

git remote get-url upstream >/dev/null 2>&1 && git remote set-url upstream "$UPSTREAM" || git remote add upstream "$UPSTREAM"
git fetch --quiet upstream "$BRANCH"
REF="upstream/$BRANCH"
SHA="$(git rev-parse --short "$REF")"

# 1. Remove files the new version no longer has (never touching .github).
git ls-files -z | while IFS= read -r -d '' f; do
  case "$f" in .github/*) continue ;; esac
  git cat-file -e "$REF:$f" 2>/dev/null || git rm -q -f -- "$f"
done

# 2. Take every other file from the new version.
git ls-tree -r -z --name-only "$REF" | while IFS= read -r -d '' f; do
  case "$f" in .github/*) continue ;; esac
  git checkout "$REF" -- "$f"
done

if git diff --cached --quiet; then
  echo "Already up to date (Knock $SHA)."
  exit 0
fi

git commit -q -m "Update Knock to $SHA"
echo "Updated to Knock $SHA. Changed files:"
git show --stat --format= HEAD | sed 's/^/  /'
