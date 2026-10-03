#!/bin/bash
# merge every cloud-s18-* branch ahead of HEAD; union record conflicts; stop on any other conflict
# SKIP=<regex> holds matching branches (e.g. SKIP=c2-town while a red-by-design push waits for its test fix)
cd "$(git rev-parse --show-toplevel)"
REC='DECISIONS.md|OPEN_QUESTIONS.md|BLOCKERS.md|PROGRESS.md|ASSET_LEDGER.md|research/OPEN_QUESTIONS.md'
finish() {
  u=$(git diff --name-only --diff-filter=U)
  [ -z "$u" ] && return 0
  other=$(echo "$u" | grep -vE "^($REC)$")
  if [ -n "$other" ]; then echo "HAND-MERGE NEEDED: $other"; return 1; fi
  python3 tools/dev/union_records.py $u && git add $u && git commit --no-edit -q 2>&1 | tail -3
  [ -z "$(git diff --name-only --diff-filter=U)" ] && git log -1 --format='merged %h' && return 0 || return 1
}
if git diff --name-only --diff-filter=U | grep -q .; then finish || exit 1; fi
for b in $(git branch -r | grep 'origin/cloud-s18-' | sed 's/^ *//'); do
  [ -n "$SKIP" ] && echo "$b" | grep -qE "$SKIP" && { echo "skip $b"; continue; }
  [ "$(git rev-list --count HEAD..$b)" -gt 0 ] || continue
  echo "== $b"
  if git merge --no-edit -q $b >/dev/null 2>&1; then git log -1 --format='merged %h'; else finish || exit 1; fi
done
echo DONE
