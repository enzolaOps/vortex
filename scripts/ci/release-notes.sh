#!/bin/sh
# Build GitHub Release notes from conventional commits since the previous v* tag.
# --print writes stdout. Default: gh release edit "$tag".
#
# TAG PREV COMMITS  overridable for tests.
set -eu

print=0
tag=${TAG:-${GITHUB_REF_NAME:-}}
if [ "${1:-}" = --print ]; then
	print=1
	shift
	[ -n "${1:-}" ] && tag=$1
elif [ -n "${1:-}" ]; then
	tag=$1
fi

[ -n "$tag" ] || {
	echo "tag required" >&2
	exit 1
}

if [ -z "${PREV+x}" ]; then
	prev=$(git tag -l 'v[0-9]*' --sort=-version:refname | while IFS= read -r t; do
		[ "$t" = "$tag" ] && continue
		printf '%s\n' "$t"
		break
	done)
else
	prev=$PREV
fi

if [ -n "${COMMITS+x}" ]; then
	log=$COMMITS
elif [ -z "$prev" ]; then
	log=
else
	log=$(git log --no-merges --format=%s "$prev".."$tag")
fi

breaking=
features=
fixes=
perf=
deps=
internal=

classify() {
	line=$1
	case $line in
	*:*) ;;
	*)
		internal="$internal- $line$nl"
		return
		;;
	esac
	prefix=${line%%:*}
	subject=${line#*: }
	bang=
	case $prefix in
	*!)
		bang=1
		prefix=${prefix%!}
		;;
	esac
	scope=
	case $prefix in
	*'('*)
		scope=${prefix#*(}
		scope=${scope%)}
		prefix=${prefix%%(*}
		;;
	esac
	item="- $subject$nl"
	if [ -n "$bang" ]; then
		breaking="$breaking$item"
		return
	fi
	case $prefix in
	feat) features="$features$item" ;;
	fix) fixes="$fixes$item" ;;
	perf) perf="$perf$item" ;;
	chore)
		case $scope in
		deps | deps-dev) deps="$deps$item" ;;
		*) internal="$internal$item" ;;
		esac
		;;
	*) internal="$internal$item" ;;
	esac
}

nl='
'

if [ -n "$log" ]; then
	while IFS= read -r line; do
		[ -n "$line" ] || continue
		classify "$line"
	done <<EOF
$log
EOF
fi

{
	printf '## Vortex %s\n' "$tag"
	if [ -z "$prev" ]; then
		printf '\nInitial release.\n'
	else
		printf '\nChanges since `%s`.\n' "$prev"
	fi
	if [ -n "$breaking" ]; then
		printf '\n### Breaking\n\n%s' "$breaking"
	fi
	if [ -n "$features" ]; then
		printf '\n### Features\n\n%s' "$features"
	fi
	if [ -n "$fixes" ]; then
		printf '\n### Fixes\n\n%s' "$fixes"
	fi
	if [ -n "$perf" ]; then
		printf '\n### Performance\n\n%s' "$perf"
	fi
	if [ -n "$deps" ]; then
		n=$(printf '%s' "$deps" | grep -c '^')
		printf '\n<details><summary>Dependencies (%s)</summary>\n\n%s</details>\n' "$n" "$deps"
	fi
	if [ -n "$internal" ]; then
		n=$(printf '%s' "$internal" | grep -c '^')
		printf '\n<details><summary>Internal (%s)</summary>\n\n%s</details>\n' "$n" "$internal"
	fi
} >"${TMPDIR:-/tmp}/vortex-notes.$$"

if [ "$print" = 1 ]; then
	cat "${TMPDIR:-/tmp}/vortex-notes.$$"
	rm -f "${TMPDIR:-/tmp}/vortex-notes.$$"
	exit 0
fi

gh release edit "$tag" --notes-file "${TMPDIR:-/tmp}/vortex-notes.$$"
rm -f "${TMPDIR:-/tmp}/vortex-notes.$$"
