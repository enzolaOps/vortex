#!/bin/sh
# Monta um pacote pacman a partir do app já empacotado pelo Forge.
#
# ⚠ **Não é `makepkg`.** O runner é Ubuntu; o que o Arch precisa é o arquivo
# (`pkg.tar.zst`) que o `pacman -U` instala. A árvore é a de um pacote
# oficial: /opt + wrapper em /usr/bin + .desktop. Sem isto o "install" do
# Linux era unzip no cwd.
set -eu

raiz=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$raiz"

app=$(ls -d out/*-linux-x64 2>/dev/null | head -n 1)
if [ -z "$app" ] || [ ! -x "$app/vortex-desktop" ]; then
  echo "empacotar-arch: não achei out/*-linux-x64/vortex-desktop" >&2
  exit 1
fi

versao=$(node -p "require('./package.json').version")
dest=$(mktemp -d)
trap 'rm -rf "$dest"' EXIT
pkg=$dest/pkg

mkdir -p \
  "$pkg/opt/vortex-desktop" \
  "$pkg/usr/bin" \
  "$pkg/usr/share/applications" \
  "$pkg/usr/share/icons/hicolor/256x256/apps"

cp -a "$app"/. "$pkg/opt/vortex-desktop/"
chmod 755 "$pkg/opt/vortex-desktop/vortex-desktop"
if [ -f "$pkg/opt/vortex-desktop/chrome-sandbox" ]; then
  chmod 4755 "$pkg/opt/vortex-desktop/chrome-sandbox"
fi

printf '%s\n' '#!/bin/sh' 'exec /opt/vortex-desktop/vortex-desktop "$@"' \
  > "$pkg/usr/bin/vortex-desktop"
chmod 755 "$pkg/usr/bin/vortex-desktop"

# Sem a linha Flatpak: este pacote não é o runtime do Flathub.
grep -v '^X-Flatpak=' io.github.enzolaOps.Vortex.desktop \
  > "$pkg/usr/share/applications/io.github.enzolaOps.Vortex.desktop"

if [ -f assets/hicolor/256x256.png ]; then
  cp assets/hicolor/256x256.png \
    "$pkg/usr/share/icons/hicolor/256x256/apps/io.github.enzolaOps.Vortex.png"
fi

tamanho=$(du -sb "$pkg" | cut -f1)
{
  echo "pkgname = vortex-desktop"
  echo "pkgbase = vortex-desktop"
  echo "pkgver = ${versao}-1"
  echo "pkgdesc = Desktop shell for the Vortex chat platform"
  echo "url = https://github.com/enzolaOps/vortex"
  echo "builddate = $(date +%s)"
  echo "packager = Vortex CI"
  echo "size = $tamanho"
  echo "arch = x86_64"
  echo "license = AGPL-3.0-or-later"
} > "$pkg/.PKGINFO"

saida=${1:-out/make/Vortex.pkg.tar.zst}
case "$saida" in
  /*) ;;
  *) saida=$raiz/$saida ;;
esac
mkdir -p "$(dirname "$saida")"
# Path absoluto: o bsdtar roda DENTRO de `$pkg`, e `entrega/...` relativo
# apontava para um diretório que não existe — a v1.3.2 Linux abortou aqui
# e nem o .deb foi anexado.
#
# ⚠ **Não arquivar `.`.** `bsdtar -c .` prefixa tudo com `./`, e o pacman
# compara o nome com `.PKGINFO` — `./.PKGINFO` vira "missing package
# metadata" / "invalid or corrupted package". Listar `.PKGINFO` primeiro
# é o que o makepkg faz.
( cd "$pkg" && bsdtar --uid 0 --gid 0 -c --zstd -f "$saida" .PKGINFO opt usr )
primeiro=$(bsdtar -tf "$saida" | head -n 1)
if [ "$primeiro" != ".PKGINFO" ]; then
  echo "empacotar-arch: primeiro arquivo é '$primeiro', tem de ser .PKGINFO" >&2
  exit 1
fi
echo "$saida"
