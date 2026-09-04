#!/bin/sh
# Exit 0 if this component should build for the current tag.
#
# TAG  current tag (default: $GITHUB_REF_NAME)
# PREV previous v* tag; empty = first release
# FILES newline-separated paths; unset = git diff PREV...HEAD
# FORCE=1 always yes
set -eu

component=${1:?usage: changed.sh <client|server>}

if [ "${FORCE:-}" = 1 ]; then
	exit 0
fi

tag=${TAG:-${GITHUB_REF_NAME:-}}

# Releases that are not vX.Y.Z skip.
if [ -z "${FILES+x}" ]; then
	case $tag in
	v[0-9]*) ;;
	*) exit 1 ;;
	esac
fi

if [ -z "${PREV+x}" ]; then
	prev=$(git tag -l 'v[0-9]*' --sort=-version:refname | while IFS= read -r t; do
		[ "$t" = "$tag" ] && continue
		printf '%s\n' "$t"
		break
	done)
else
	prev=$PREV
fi

# First tag builds both product images.
if [ -z "$prev" ]; then
	exit 0
fi

if [ -n "${FILES+x}" ]; then
	files=$FILES
else
	files=$(git diff --name-only "$prev"...HEAD)
fi

[ -n "$files" ] || exit 1

match() {
	printf '%s\n' "$files" | grep -E "$1" >/dev/null
}

case $component in
client)
	printf '%s\n' "$files" | grep -vE '\.md$' |
		grep -E '^(client/|brand/|\.dockerignore$|\.github/workflows/vortex-client-image\.yml$)' >/dev/null
	;;
server)
	match '^(server/crates/|server/Cargo\.(toml|lock)$|server/scripts/build-image-layer\.sh$|server/Dockerfile$|server/Dockerfile\.runtime$|server/\.dockerignore$|\.github/workflows/vortex-server-image\.yml$)'
	;;
*)
	echo "unknown component: $component" >&2
	exit 2
	;;
esac
