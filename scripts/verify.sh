#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/usr/local/lib/node_modules/corepack/shims:$HOME/.local/share/pnpm:$PATH"
LOG="output.log"

run_step() {
	local label="$1"
	shift
	if "$@" >> "$LOG" 2>&1; then
		return 0
	else
		echo "FAIL at $label (exit $?)"
		echo "Last 20 lines of $LOG:"
		tail -20 "$LOG"
		exit 1
	fi
}

> "$LOG"

run_step "prettier" pnpm exec prettier --write .
run_step "lint" pnpm run lint
run_step "check" pnpm run check
run_step "build" pnpm run build

echo "PASS"
