/**
 * Para onde o botão "Baixar para desktop" leva.
 *
 * ⚠ **Nomes estáveis, sem versão.** O workflow do desktop anexa cada release
 * com `Vortex-Setup.exe`, `Vortex.deb` e `Vortex-linux.zip`, e
 * `releases/latest/download/` redireciona para a última release publicada —
 * o link não precisa mudar a cada versão.
 *
 * Linux: Ubuntu/Debian/Mint recebem o `.deb`; Arch e o resto, o zip (descompacta
 * e roda). Android se anuncia como Linux e não instala nenhum dos dois.
 *
 * macOS e o resto caem na página da release: não há build de macOS (exige
 * assinatura da Apple), e mandar para um arquivo que não existe daria 404.
 */
const RELEASES = "https://github.com/enzolaOps/vortex/releases/latest";

export function linkDeDownload(plataforma: string): string {
  const p = plataforma.toLowerCase();
  if (p.includes("android")) return RELEASES;
  if (p.startsWith("win") || p.includes("windows")) {
    return `${RELEASES}/download/Vortex-Setup.exe`;
  }
  if (p.includes("linux")) {
    if (p.includes("ubuntu") || p.includes("debian") || p.includes("mint")) {
      return `${RELEASES}/download/Vortex.deb`;
    }
    return `${RELEASES}/download/Vortex-linux.zip`;
  }
  return RELEASES;
}

/**
 * A plataforma do navegador.
 *
 * ⚠ **User-Agent, não `userAgentData.platform`.** A API nova devolve só
 * `"Linux"` — Ubuntu e Arch ficam iguais, e o `.deb` iria para os dois.
 * Distro só aparece no UA (`Ubuntu` / `X11; Linux x86_64`).
 */
export function plataformaDoNavegador(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}
