import type { AnexoSnapshot } from "nucleo/sdk/domain";
import { page, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";

import { chat } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ALTURA_DO_AUDIO } from "./caixaDoAnexo";
import { PlayerDeAudio, tempoTexto } from "./PlayerDeAudio";

/** WAV mudo de `segundos` s (8 kHz, 8 bits, mono): duração real, sem servidor. */
function wavMudo(segundos: number): string {
  const taxa = 8000;
  const n = taxa * segundos;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  txt(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  txt(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  txt(36, "data");
  v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

function anexo(url: string, patch: Partial<AnexoSnapshot> = {}): AnexoSnapshot {
  return {
    id: "a",
    nome: "voz.wav",
    url,
    tipo: "audio",
    largura: undefined,
    altura: undefined,
    tamanhoTexto: "24 KB",
    ...patch,
  };
}

afterEach(desmontar);

describe("PlayerDeAudio", () => {
  it("tempoTexto: m:ss, h:mm:ss e duração desconhecida", () => {
    expect(tempoTexto(0)).toBe("0:00");
    expect(tempoTexto(65.9)).toBe("1:05");
    expect(tempoTexto(3725)).toBe("1:02:05");
    expect(tempoTexto(Number.NaN)).toBe("0:00");
    expect(tempoTexto(Number.POSITIVE_INFINITY)).toBe("0:00");
  });

  it("mostra nome, peso e tempo tabular; altura fixa; <audio> sem controls", async () => {
    montar(<PlayerDeAudio a={anexo(wavMudo(3))} />);
    const slider = page.getByRole("slider");
    await expect.element(slider).toBeVisible();
    await expect.poll(() => slider.element().getAttribute("aria-valuemax")).toBe("3");
    const raiz = pegar("audio")!.parentElement!;
    expect(raiz.textContent).toContain("voz.wav");
    expect(raiz.textContent).toContain("24 KB");
    expect(raiz.textContent).toContain("0:00 / 0:03");
    expect(raiz.getBoundingClientRect().height).toBe(ALTURA_DO_AUDIO);
    expect(pegar("audio")!.hasAttribute("controls")).toBe(false);
    const tempo = [...raiz.querySelectorAll("span")].find((s) => s.textContent?.includes(" / "))!;
    expect(getComputedStyle(tempo).fontVariantNumeric).toContain("tabular-nums");
  });

  it("a barra move por teclado (setas, Home, End) e anuncia o valor", async () => {
    montar(<PlayerDeAudio a={anexo(wavMudo(30))} />);
    const slider = page.getByRole("slider");
    await expect.poll(() => slider.element().getAttribute("aria-valuemax")).toBe("30");
    slider.element().focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => slider.element().getAttribute("aria-valuenow")).toBe("5");
    expect(slider.element().getAttribute("aria-valuetext")).toBe(chat.player.valorDaPosicao("0:05", "0:30"));
    await userEvent.keyboard("{End}");
    await expect.poll(() => slider.element().getAttribute("aria-valuenow")).toBe("30");
    await userEvent.keyboard("{Home}");
    await expect.poll(() => slider.element().getAttribute("aria-valuenow")).toBe("0");
    expect(pegar<HTMLAudioElement>("audio")!.currentTime).toBe(0);
  });

  it("clicar na barra salta para a posição", async () => {
    montar(<PlayerDeAudio a={anexo(wavMudo(20))} />);
    const slider = page.getByRole("slider");
    await expect.poll(() => slider.element().getAttribute("aria-valuemax")).toBe("20");
    const r = slider.element().getBoundingClientRect();
    slider.element().dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }),
    );
    await expect.poll(() => Number(slider.element().getAttribute("aria-valuenow"))).toBe(10);
  });

  it("play/pausa alterna o rótulo e toca de verdade", async () => {
    montar(<PlayerDeAudio a={anexo(wavMudo(5))} />);
    const botao = page.getByRole("button", { name: chat.player.reproduzir });
    await botao.click();
    await expect.element(page.getByRole("button", { name: chat.player.pausar })).toBeVisible();
    await page.getByRole("button", { name: chat.player.pausar }).click();
    await expect.element(page.getByRole("button", { name: chat.player.reproduzir })).toBeVisible();
  });

  it("áudio que não carrega mostra o erro, com o contêiner na mesma altura", async () => {
    montar(<PlayerDeAudio a={anexo("data:audio/wav;base64,AAAA")} />);
    await expect.element(page.getByText(chat.player.falhou)).toBeVisible();
    expect(pegar("audio")!.parentElement!.getBoundingClientRect().height).toBe(ALTURA_DO_AUDIO);
  });
});
