#!/bin/sh
#
# Usage: is-wip.sh <path-to-commit-message-file>
# Exit 0 if the first line is exactly "w" or "wip" (case-insensitive, trimmed).
# Exit 1 otherwise.
#
set -eu

msg_file=${1:?missing commit message file path}

first=$(
  head -n 1 "$msg_file" |
    tr -d '\r' |
    tr '[:upper:]' '[:lower:]' |
    sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
)

case $first in
w | wip) exit 0 ;;
esac

exit 1
