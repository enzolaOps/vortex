#!/bin/sh
set -eu
cd "$(dirname "$0")"
fail=0
check() {
	got=$1
	want=$2
	msg=$3
	if [ "$got" != "$want" ]; then
		echo "FAIL $msg (got $got want $want)" >&2
		fail=1
	fi
}

FILES='client/foo.tsx' ./changed.sh client && r=0 || r=$?
check "$r" 0 "client tsx"
FILES='client/README.md' ./changed.sh client && r=0 || r=$?
check "$r" 1 "client markdown"
FILES='brand/mark.svg' ./changed.sh client && r=0 || r=$?
check "$r" 0 "client brand"
FILES='server/Cargo.lock' ./changed.sh client && r=0 || r=$?
check "$r" 1 "client ignores server"
FILES='server/Cargo.lock' ./changed.sh server && r=0 || r=$?
check "$r" 0 "server lockfile"
FILES='server/Dockerfile.runtime' ./changed.sh server && r=0 || r=$?
check "$r" 0 "server runtime dockerfile"
FILES='server/docs/x.md' ./changed.sh server && r=0 || r=$?
check "$r" 1 "server docs"
FILES='vendor/stoat-web/x.ts' ./changed.sh client && r=0 || r=$?
check "$r" 1 "vendor is not product"
PREV= TAG=v0.1.0 ./changed.sh client && r=0 || r=$?
check "$r" 0 "first tag builds client"
FORCE=1 FILES='README.md' ./changed.sh server && r=0 || r=$?
check "$r" 0 "FORCE"
TAG=not-a-version ./changed.sh client && r=0 || r=$?
check "$r" 1 "non-v tag skips"

notes=$(
	TAG=v1.2.3 PREV=v1.2.2 COMMITS='feat: one
feat(web)!: two
fix: three
chore(deps): bump left-pad
ci: workflow' ./release-notes.sh --print
)
printf '%s\n' "$notes" | grep -q '### Features' || {
	echo "FAIL missing Features" >&2
	fail=1
}
printf '%s\n' "$notes" | grep -q -- '- one' || {
	echo "FAIL missing feat subject" >&2
	fail=1
}
printf '%s\n' "$notes" | grep -q '### Breaking' || {
	echo "FAIL missing Breaking" >&2
	fail=1
}
printf '%s\n' "$notes" | grep -q 'Dependencies (1)' || {
	echo "FAIL deps summary" >&2
	fail=1
}
printf '%s\n' "$notes" | grep -q 'Internal (1)' || {
	echo "FAIL internal summary" >&2
	fail=1
}

if [ "$fail" -ne 0 ]; then
	exit 1
fi
echo "ci scripts: OK"
