#!/bin/sh
#
# commit-msg hook: Git passes the path to the commit message file as $1.
# Skips read-only checks when the title is "w" or "wip" (see is-wip.sh).
#
set -eu

dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if "$dir/is-wip.sh" "$1"; then
  exit 0
fi

before=$(git status --porcelain)
if ! npm run -s check; then
  exit 1
fi
after=$(git status --porcelain)
if [ "$before" != "$after" ]; then
  echo >&2
  echo >&2 'ERROR: Files have been changed by the checks.'
  echo >&2 '       Inspect `git status` and fix the check script or tooling.'
  exit 1
fi
