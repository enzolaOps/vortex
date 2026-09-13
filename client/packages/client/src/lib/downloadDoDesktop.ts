/**
 * Para onde o botão "Baixar para desktop" leva.
 *
 * ⚠ **Nomes estáveis, sem versão.** O workflow do desktop anexa cada release
 * com `Vortex-Setup.exe` e `Vortex.flatpak`, e `releases/latest/download/`
 * redireciona para a última release publicada — o link não precisa mudar a
 * cada versão.
 *
 * macOS e o resto caem na página da release: não há build de macOS (exige
 * assinatura da Apple), e mandar para um arquivo que não existe daria 404.
 */
const RELEASES = "https://github.com/enzolaOps/vortex/releases/latest";

export function linkDeDownload(plataforma: string): string {
  const p = plataforma.toLowerCase();
  if (p.startsWith("win")) return `${RELEASES}/download/Vortex-Setup.exe`;
  if (p.includes("linux") && !p.includes("android")) {
    return `${RELEASES}/download/Vortex.flatpak`;
  }
  return RELEASES;
}

/** A plataforma do navegador, pela API nova quando existe. */
export function plataformaDoNavegador(): string {
  if (typeof navigator === "undefined") return "";
  const dados = (navigator as { userAgentData?: { platform?: string } })
    .userAgentData;
  return dados?.platform ?? navigator.userAgent;
}
