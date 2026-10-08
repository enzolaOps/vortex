#!/bin/sh
# Regras que a prosa já perdeu uma vez. Falhar aqui é o mecanismo.
# vendor/ é referência e nunca é build. A casca é produto e mora em desktop/.
set -eu
cd "$(dirname "$0")/../.."

fail=0
say() {
	echo "fronteiras: $1" >&2
	fail=1
}

if [ -e vendor/stoat-desktop ]; then
	say "vendor/stoat-desktop existe. A casca é desktop/, não referência."
fi

for extra in vendor/*; do
	[ -e "$extra" ] || continue
	base=$(basename "$extra")
	case $base in
	stoat-web | README.md) ;;
	*) say "vendor/$base não é referência permitida." ;;
	esac
done

if ! grep -q 'working-directory: desktop' .github/workflows/vortex-desktop.yml; then
	say "vortex-desktop.yml não empacota desktop/."
fi

if grep -nE 'working-directory:[[:space:]]*vendor|vendor/stoat-desktop' .github/workflows/*.yml; then
	say "um workflow trata vendor/ como build."
fi

if grep -n 'subtree pull --prefix=desktop' VORTEX.md vendor/README.md README.md; then
	say "subtree pull sobre desktop/ apagaria a casca."
fi

exit "$fail"
