/**
 * A duração de um arquivo de áudio, lida pelo próprio navegador.
 *
 * `loadedmetadata` num `<audio>` sobre um `blob:` — sem baixar nada nem
 * decodificar o arquivo inteiro. `undefined` quando o navegador não sabe
 * (formato que não toca, metadado ausente): aí quem decide é o servidor, pelo
 * teto de bytes, e a checagem de duração é pulada em vez de recusar um arquivo
 * que talvez sirva.
 */
export function duracaoDoAudio(arquivo: File, esperaMs = 3000): Promise<number | undefined> {
  return new Promise((resolver) => {
    let url: string;
    try {
      url = URL.createObjectURL(arquivo);
    } catch {
      resolver(undefined);
      return;
    }
    const audio = new Audio();
    let feito = false;
    const fim = (valor: number | undefined) => {
      if (feito) return;
      feito = true;
      clearTimeout(relogio);
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolver(valor);
    };
    const relogio = setTimeout(() => fim(undefined), esperaMs);
    audio.preload = "metadata";
    audio.addEventListener(
      "loadedmetadata",
      () => fim(Number.isFinite(audio.duration) ? audio.duration : undefined),
      { once: true },
    );
    audio.addEventListener("error", () => fim(undefined), { once: true });
    audio.src = url;
  });
}
