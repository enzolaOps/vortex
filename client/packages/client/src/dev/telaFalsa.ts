import type { FonteDeTela, PonteDeTela } from "../sdk/seletorDeTela";

/**
 * A ponte do seletor de tela, dublada — arnês, nunca produto.
 *
 * ⚠ **Sem isto o painel seria construído e inalcançável.** Ele exige duas
 * coisas que o navegador não tem: uma sala LiveKit de verdade (o motor recusa
 * sem participante local) e o `desktopCapturer` da casca. É a mesma situação da
 * casca falsa, e o mesmo defeito que o painel de fixadas teve por meses —
 * existir sem caminho até ele.
 *
 * ⚠ **Duas telas e quinze janelas.** Com uma só, a aba de janelas
 * mostraria um cartão e a grade nunca exercitaria o refluxo — que é onde um
 * nome longo trunca ou estoura. Uma amostra que não varia não prova layout.
 */
const PNG = (rotulo: string, cor: string): string =>
  `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
      `<rect width="320" height="180" fill="${cor}"/>` +
      `<text x="18" y="100" fill="#dbe4f0" font-family="sans-serif" font-size="20">${rotulo}</text>` +
      `</svg>`,
  )}`;

const ICONE = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
    '<rect width="64" height="64" rx="14" fill="#35c2cc"/></svg>',
)}`;

const FONTES: readonly FonteDeTela[] = [
  {
    id: "screen:0",
    nome: "Tela 1",
    tipo: "tela",
    meta: "3440×1440 · ultrawide principal",
    miniatura: PNG("monitor 1", "#26344a"),
    icone: undefined,
  },
  {
    id: "screen:1",
    nome: "Tela 2",
    tipo: "tela",
    meta: "2560×1440",
    miniatura: PNG("monitor 2", "#2b2a44"),
    icone: undefined,
  },
  {
    id: "window:1",
    nome: "Figma — Vortex DS",
    tipo: "janela",
    /* Sem meta, como a casca entrega: `desktopCapturer` não dá o tamanho de
       uma janela. É o caso que o cartão precisa aguentar. */
    meta: undefined,
    miniatura: PNG("figma", "#1f3a34"),
    icone: ICONE,
  },
  {
    id: "window:2",
    nome: "Visual Studio Code",
    tipo: "janela",
    /* Sem meta, como a casca entrega: `desktopCapturer` não dá o tamanho de
       uma janela. É o caso que o cartão precisa aguentar. */
    meta: undefined,
    miniatura: PNG("code", "#3a2f1f"),
    icone: ICONE,
  },
  {
    /* Nome longo de propósito: é o que prova o truncamento do rótulo. */
    id: "window:3",
    nome: "Um nome de janela absurdamente longo que precisa truncar sem quebrar o cartão",
    tipo: "janela",
    /* Sem meta, como a casca entrega: `desktopCapturer` não dá o tamanho de
       uma janela. É o caso que o cartão precisa aguentar. */
    meta: undefined,
    miniatura: PNG("janela", "#3a1f2f"),
    icone: ICONE,
  },
  /* Doze janelas a mais: com três a grade cabe numa linha e nunca prova o
     que acontece quando o corpo do modal precisa rolar — que é o caso de
     quem tem o dia inteiro de apps abertos. */
  ...Array.from({ length: 12 }, (_, i): FonteDeTela => ({
    id: `window:${String(i + 4)}`,
    nome: `Janela ${String(i + 4)}`,
    tipo: "janela",
    meta: undefined,
    miniatura: PNG(`janela ${String(i + 4)}`, "#24303c"),
    icone: ICONE,
  })),
];

export function dublarPonteDeTela(): void {
  if (window.vortexTela) return;

  const ponte: PonteDeTela = {
    seletorProprio: () => Promise.resolve(true),
    fontes: () => Promise.resolve(FONTES),
    escolher: () => Promise.resolve(true),
    cancelar: () => Promise.resolve(),
    /* `pendente` no arnês: é o estado que só aparece no macOS sem autorização,
       e sem ele o banner seria construído e inalcançável — o mesmo defeito
       que este arquivo inteiro existe para evitar. */
    permissao: () => Promise.resolve("pendente" as const),
    abrirAjustes: () => Promise.resolve(),
  };

  /* `defineProperty` porque a propriedade é `readonly` no tipo — o preload a
     injeta uma vez e ninguém deve reescrevê-la em produção. */
  Object.defineProperty(window, "vortexTela", {
    value: ponte,
    configurable: true,
  });
}
