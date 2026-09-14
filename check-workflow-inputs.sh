#!/bin/sh
# Checks the inputs passed to withastro/action in the Pages deploy.
#
# actionlint validates `with:` keys only for actions in its built-in
# popular-actions database. actions/setup-node is in it; withastro/action is
# not, so actionlint accepts any key at all there - measured, it returns 0 on
# the exact file that broke the deploy. GitHub then ignores an unknown input
# rather than rejecting it, so a typo or a wrong-action input does not fail
# anything: it silently drops the setting and the action falls back to its
# default. That is how 60e02c2 lost its node pin, fell back to Node 20 and
# failed the build, with both forge jobs green.
#
# This is the rule actionlint applies to actions it knows, hand-rolled for the
# one action in this repo that it does not.
set -eu

f=.github/workflows/deploy.yml
[ -f "$f" ] || { echo "$f is missing"; exit 1; }

# The action declares exactly these three inputs (action.yml at withastro/action
# v3). Anything else is silently ignored at run time, so it is an error here.
valid="node-version package-manager path"

# The `with:` block belonging to the withastro/action step: everything from the
# `with:` after that `uses:` up to the next line at the same indent or less.
block=$(awk '
  /uses:[[:space:]]*withastro\/action/ { found=1; next }
  found && /^[[:space:]]*with:[[:space:]]*$/ { inwith=1; indent=match($0,/[^ ]/); next }
  inwith {
    if ($0 ~ /^[[:space:]]*($|#)/) next
    if (match($0,/[^ ]/) <= indent) exit
    print
  }
' "$f")

[ -n "$block" ] || { echo "no with: block on the withastro/action step in $f"; exit 1; }

keys=$(printf '%s\n' "$block" | sed -n 's/^[[:space:]]*\([a-zA-Z0-9_-]*\):.*/\1/p')
[ -n "$keys" ] || { echo "the withastro/action step in $f passes no inputs"; exit 1; }

status=0
for k in $keys; do
  case " $valid " in
    *" $k "*) ;;
    *)
      echo "$f: withastro/action has no input \"$k\""
      echo "  it declares only: $valid"
      echo "  GitHub ignores unknown inputs, so this would be dropped silently"
      status=1
      ;;
  esac
done

echo "$keys" | grep -qw node-version || {
  echo "$f: the withastro/action step does not pass node-version"
  echo "  without it the action defaults to Node 20, which astro refuses"
  status=1
}

[ "$status" -eq 0 ] && echo "withastro/action inputs are valid: $(echo $keys)"
exit "$status"
