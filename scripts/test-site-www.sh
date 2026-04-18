#!/usr/bin/env bash
#
# Test the site-www worktree with the code-excerpter tool.
#
# Usage:
#   ./scripts/test-site-www.sh [--root <path>] [--write] [target...]
#
# Options:
#   --root <path>  The root path of the site-www worktree.
#   --write        Write changes to the worktree.
#   target...      The targets to test.
#
# Examples:
#   ./scripts/test-site-www.sh --root /path/to/site-www
#   ./scripts/test-site-www.sh --write
#   ./scripts/test-site-www.sh --root /path/to/site-www --write
#   ./scripts/test-site-www.sh --root /path/to/site-www --write src/content/docs/foo.md
#
# cSpell:ignore worktree

set -euo pipefail

default_root="$(pwd)/tmp/site-www"
worktree="$default_root"
write_mode=0
targets=()

usage() {
  cat <<EOF
Usage: $(basename "$0") [--root <path>] [--write] [target ...]

Tests a local site-www worktree with code-excerpter.

Options:
  --root <path>  Root path of the site-www worktree (default: $default_root)
  --write        Write changes to the worktree
  -h, --help     Show this help

Targets:
  Optional markdown files relative to src/content/, or absolute paths.
EOF
}

while (($# > 0)); do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --root)
      if (($# < 2)); then
        echo "missing value for --root" >&2
        exit 1
      fi
      worktree="$2"
      shift 2
      ;;
    --write)
      write_mode=1
      shift
      ;;
    *)
      targets+=("$1")
      shift
      ;;
  esac
done

if [[ ! -d "$worktree" ]]; then
  echo "missing worktree: $worktree" >&2
  exit 1
fi

docs_root="$worktree/src/content"
examples_root="$worktree/examples"

replace_expr='/\/\/!<br>//g; /ellipsis(<\w+>)?(\(\))?;?/.../g; /\/\*(\s*\.\.\.\s*)\*\//$1/g; /[\r\n]+$//g;'

path_args=()
if ((${#targets[@]} == 0)); then
  path_args+=("$docs_root")
else
  for target in "${targets[@]}"; do
    if [[ "$target" = /* ]]; then
      path_args+=("$target")
    else
      path_args+=("$docs_root/$target")
    fi
  done
fi

cli_args=(
  --path-base "$examples_root"
  --replace "$replace_expr"
)

if ((write_mode == 0)); then
  cli_args+=(--dry-run --fail-on-update)
fi

cli_args+=("${path_args[@]}")

node dist/cli.js "${cli_args[@]}"
