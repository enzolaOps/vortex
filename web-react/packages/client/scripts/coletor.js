/*
  O coletor que roda DENTRO da página, nos dois lados do confronto.

  ⚠ **Ele vive num arquivo próprio por uma razão medida: eu quebrei o script
  três vezes escrevendo-o dentro de um template literal.** Uma crase num
  comentário fecha a string; `\d` numa regex precisa virar `\\d`; `color\(`
  precisa virar `color\\(`. Nenhum desses erros é interessante, todos custaram
  uma rodada, e o segundo passou despercebido — a conversão de oklab ficou
  inerte e o relatório seguiu acusando diferença onde o pixel era o mesmo.

  Lido com `readFileSync` e injetado como texto, o arquivo é JS normal: regex
  com uma barra, crase à vontade, e o editor conferindo a sintaxe.

  Ele NÃO é importado por ninguém — é código para o `Runtime.evaluate`. Por
  isso define `olhar` no escopo global em vez de exportar.
*/

/** Cor em notação qualquer → `#rrggbb` ou `#rrggbb@NN`. `-` quando invisível. */
function corParaHex(c) {
  const ok = deOklab(c) ?? deSrgb(c) ?? deRgb(c);
  if (!ok) return c;
  if (ok.a === 0) return "-";
  const h =
    "#" + [ok.r, ok.g, ok.b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return ok.a === 1 ? h : h + "@" + Math.round(ok.a * 100);
}

function deRgb(c) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/*
  `color-mix(in srgb, …)` computa para `color(srgb r g b / a)`.

  Notação diferente, pixel igual — sem converter, o relatório acusa diferença
  onde não há.
*/
function deSrgb(c) {
  const m =
    /color\(srgb\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+))?\)/.exec(
      c,
    );
  if (!m) return null;
  const v = (x) => Math.max(0, Math.min(255, Math.round(Number(x) * 255)));
  return {
    r: v(m[1]),
    g: v(m[2]),
    b: v(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/*
  `color-mix(in oklab, …)` computa para `oklab(L a b / α)`.

  ⚠ E aqui a conversão não é só cosmética: interpolar em oklab contra
  `transparent` NÃO dá o mesmo resultado que alfa direto em sRGB. Converter é o
  que deixa a diferença real aparecer em vez de ficar escondida atrás de duas
  notações incomparáveis.
*/
function deOklab(c) {
  const m =
    /oklab\(([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+))?\)/.exec(
      c,
    );
  if (!m) return null;
  const L = Number(m[1]);
  const A = Number(m[2]);
  const B = Number(m[3]);
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const md = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const sd = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  const lin = [
    4.0767416621 * l - 3.3077115913 * md + 0.2309699292 * sd,
    -1.2684380046 * l + 2.6097574011 * md - 0.3413193965 * sd,
    -0.0041960863 * l - 0.7034186147 * md + 1.707614701 * sd,
  ];
  const g = (x) => {
    const v =
      x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  };
  return {
    r: g(lin[0]),
    g: g(lin[1]),
    b: g(lin[2]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/**
 * As bordas LADO A LADO.
 *
 * ⚠ O defeito que motivou o `espelho` foi uma borda a mais em um lado só, e um
 * resumo "1px solid" a esconderia. Borda transparente não conta: o primitivo
 * de botão usa 1px transparente para a caixa não mudar de tamanho entre
 * variantes, e cobrar por ela é cobrar por algo que não se vê.
 */
function bordasDe(s) {
  const out = [];
  for (const lado of ["Top", "Right", "Bottom", "Left"]) {
    const w = Math.round(parseFloat(s["border" + lado + "Width"]));
    const cor = corParaHex(s["border" + lado + "Color"]);
    if (w > 0 && cor !== "-") out.push(lado[0].toLowerCase() + w + " " + cor);
  }
  return out.length ? out.join(" ") : "-";
}

/** Tira a fração dos px: 0.8px e 1px são a mesma hairline. */
function semFracao(v) {
  return v === "normal" ? "-" : String(v).replace(/\.\d+/g, "");
}

/**
 * Uma caixa e o que ela decide, com a herança já resolvida pelo navegador.
 */
function olhar(e, nivel, max) {
  const s = getComputedStyle(e);
  const r = e.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return null;

  const texto = [...e.childNodes]
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent.trim())
    .join(" ")
    .slice(0, 22);

  const raio =
    s.borderRadius === "0px"
      ? "-"
      : parseFloat(s.borderRadius) >= 500
        ? "pill"
        : semFracao(s.borderRadius);

  return {
    tag: e.tagName.toLowerCase(),
    texto,
    /* Texto da subárvore, só para o filtro de omissões do roteiro casar. */
    todo: (e.textContent || "").trim().slice(0, 120),
    alt: Math.round(r.height),
    bg: corParaHex(s.backgroundColor),
    borda: bordasDe(s),
    raio,
    pad: s.padding === "0px" ? "-" : semFracao(s.padding),
    gap: s.gap === "normal" ? "-" : semFracao(s.gap),
    tipo: semFracao(s.fontSize) + "/" + s.fontWeight,
    entrelinha: semFracao(s.lineHeight),
    /*
      "Instrument Sans" e "Instrument Sans Variable" são a MESMA família — o
      design declara a estática e nós a variável. Normalizar impede o relatório
      de gritar em toda caixa; uma troca de verdade (mono contra sans) continua
      aparecendo.
    */
    fonte: (s.fontFamily.split(",")[0] || "").replace(/["']/g, "").replace(/ Variable$/, ""),
    cor: corParaHex(s.color),
    /*
      Cor vinda de `style` inline é DADO, não decisão de design: cor de cargo,
      gradiente derivado de ID, matiz de avatar. O design tem valores fictícios
      e o arnês tem os dele — comparar os dois acusa diferença em toda linha e
      ensina a ignorar o relatório.
    */
    dado: /(^|;)\s*(color|background)/.test(e.getAttribute("style") || ""),
    filhos:
      nivel >= max
        ? []
        : [...e.children].map((c) => olhar(c, nivel + 1, max)).filter(Boolean),
  };
}

/* O `Runtime.evaluate` avalia uma expressão: a última linha é o valor. */
olhar;
