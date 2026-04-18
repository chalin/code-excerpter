#!/bin/sh
#
# pre-push hook: Git passes the remote name as $1 and URL as $2 (unused here).
# Skips `fix` when HEAD's subject is "w" or "wip" (see is-wip.sh), same idea as
# commit-msg.sh but the message is taken from `git log -1` (not all pushed commits).
#
set -eu

dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

wip_probe=$(mktemp)
trap 'rm -f "$wip_probe"' EXIT INT HUP TERM
if git log -1 --format=%s > "$wip_probe" 2>/dev/null && "$dir/is-wip.sh" "$wip_probe"; then
  exit 0
fi

before=$(git status --porcelain)
if ! npm run -s fix; then
  exit 1
fi
after=$(git status --porcelain)
if [ "$before" != "$after" ]; then
  echo >&2
  echo >&2 'ERROR: `npm run fix` changed the working tree or index.'
  echo >&2 '       Commit or stash the updates, then push again.'
  exit 1
fi
