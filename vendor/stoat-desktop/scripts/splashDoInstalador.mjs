/**
 * A animação que o `Vortex-Setup.exe` mostra enquanto instala — os BYTES.
 *
 *   pnpm assets:splash        (a partir de vendor/stoat-desktop/)
 *
 * ⚠ **Este módulo não escreve arquivo nenhum, e a separação é mecanismo.**
 * Quem escreve é `gerar-splash.mjs`. A primeira versão tinha os dois aqui, com
 * um `process.argv[1] === import.meta.url` decidindo se escrevia — e o teste
 * que importa `gerarSplash` é BUNDLADO por esbuild, então os dois módulos
 * viram um só arquivo, a igualdade passa a ser verdadeira e `pnpm test`
 * tentava escrever o `.gif` dentro da pasta temporária do build.
 *
 * ⚠ **Sem isto, o instalador usa a animação de FÁBRICA do
 * `electron-winstaller`** — `resources/install-spinner.gif`, 268×167, cuja
 * paleta é verde (`#75c7b0`, `#a7ecb2`, `#8ce1bd`…). É o retângulo verde que
 * aparecia por cima da janela do app durante a instalação: a cor é dela, e a
 * permanência era do app não tratar `--squirrel-install`.
 *
 * ⚠ **Gerado por código, não commitado como binário de origem desconhecida.**
 * O `.gif` entra no repositório (o maker precisa dele no build, e o CI não roda
 * geração de asset), mas `atalhosDoSquirrelModelo.test.ts` reconstrói os bytes
 * e compara com o arquivo — binário que ninguém consegue reproduzir é binário
 * que ninguém consegue auditar.
 *
 * ⚠ **Sem dependência de imagem.** `sharp` não está na árvore da casca, e o que
 * se desenha aqui é geometria (um V e a barra de acento de 3px da identidade)
 * sobre uma rampa de 64 cores. O codificador GIF/LZW abaixo tem ~70 linhas;
 * uma dependência nova para isso não se paga.
 *
 * Cores: `--vx-surface-0` (#08090b) e `--vx-accent` (#35c2cc), de
 * `client/packages/client/src/styles/tokens.css`.
 */
/* Mesmas medidas da animação de fábrica: a janela do `Setup.exe` é do tamanho
   do GIF, então mudá-las mudaria o tamanho do instalador na tela. */
const LARGURA = 268;
const ALTURA = 167;

const FUNDO = "#08090b"; // --vx-surface-0
const ACENTO = "#35c2cc"; // --vx-accent

const TONS = 64; // 2^6 — o menor tamanho de paleta que dá degradê liso
const QUADROS = 24;
const ATRASO_CS = 4; // centissegundos por quadro → ciclo de ~1s

// --- Cor ---------------------------------------------------------------------

const deHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/*
  Interpolar em sRGB direto escurece o meio da rampa; linearizar antes é o que
  mantém o degradê com o peso que a cor aparenta ter.

  ⚠ **Gama 2,0 e não a curva sRGB, e a razão é REPRODUTIBILIDADE.** A curva
  real usa expoente 2,4, e `**`/`Math.pow` são "implementation-approximated"
  no ECMAScript — podem diferir no último bit entre plataformas, e o teste
  aqui compara o arquivo BYTE A BYTE contra o que o runner Linux gera.
  `Math.sqrt` é exatamente especificado pelo IEEE 754. Num degradê de 64 tons
  a diferença entre 2,0 e 2,4 não é visível; um teste que falha só no CI é.
*/
const paraLinear = (c) => {
  const v = c / 255;
  return v * v;
};
const deLinear = (v) => {
  const c = Math.sqrt(Math.max(0, v));
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};

function rampa(hexDe, hexAte, passos) {
  const de = deHex(hexDe).map(paraLinear);
  const ate = deHex(hexAte).map(paraLinear);
  const saida = [];
  for (let i = 0; i < passos; i++) {
    const t = i / (passos - 1);
    saida.push(de.map((d, c) => deLinear(d + (ate[c] - d) * t)));
  }
  return saida;
}

// --- Desenho -----------------------------------------------------------------

/**
 * Distância de um ponto ao segmento AB.
 *
 * ⚠ `Math.sqrt` e não `Math.hypot`, pela mesma razão da rampa: `hypot` é
 * "implementation-approximated" e `sqrt` é exato. O serrilhado do V sai do
 * limiar `distância <= raio`, então um bit de diferença muda um pixel — e
 * muda o arquivo que o teste compara.
 */
function distanciaAoSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const ex = px - (ax + dx * t);
  const ey = py - (ay + dy * t);
  return Math.sqrt(ex * ex + ey * ey);
}

/* O V da marca — é o glifo que o design usa no ladrilho da identidade. */
const V_CX = LARGURA / 2;
const V_CY = 66;
const V_MEIA_L = 27;
const V_MEIA_A = 23;
const V_RAIO = 5;

/* A barra de acento de 3px: a assinatura da identidade, a mesma do item ativo
   no rail e na lista de canais. */
const BARRA_Y = 116;
const BARRA_ALTURA = 3;
const BARRA_X0 = 54;
const BARRA_X1 = 214;
const BARRA_REPOUSO = 0.2;
const REALCE_MEIA_L = 28;

const AMOSTRAS = 3; // 3×3 por pixel: o serrilhado do V some sem filtro nenhum

/** Intensidade 0..1 de cada pixel do quadro `t` ∈ [0,1). */
function quadro(t) {
  const mapa = new Float32Array(LARGURA * ALTURA);
  /* O realce entra pela esquerda e sai pela direita; fora da barra ele não
     existe, então t=0 e t=1 são o mesmo desenho e o laço não dá solavanco. */
  const realceX = BARRA_X0 - REALCE_MEIA_L + t * (BARRA_X1 - BARRA_X0 + 2 * REALCE_MEIA_L);

  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      let cobertura = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const px = x + (sx + 0.5) / AMOSTRAS;
          const py = y + (sy + 0.5) / AMOSTRAS;
          const dEsquerda = distanciaAoSegmento(
            px, py,
            V_CX - V_MEIA_L, V_CY - V_MEIA_A,
            V_CX, V_CY + V_MEIA_A,
          );
          const dDireita = distanciaAoSegmento(
            px, py,
            V_CX, V_CY + V_MEIA_A,
            V_CX + V_MEIA_L, V_CY - V_MEIA_A,
          );
          if (Math.min(dEsquerda, dDireita) <= V_RAIO) cobertura++;
        }
      }
      let intensidade = cobertura / (AMOSTRAS * AMOSTRAS);

      if (y >= BARRA_Y && y < BARRA_Y + BARRA_ALTURA && x >= BARRA_X0 && x < BARRA_X1) {
        const d = Math.abs(x + 0.5 - realceX) / REALCE_MEIA_L;
        /* `x * x` e não `x ** 2`: ver a nota sobre `Math.pow` na rampa. */
        const queda = d >= 1 ? 0 : 1 - d * d;
        const realce = queda * queda;
        intensidade = Math.max(intensidade, BARRA_REPOUSO + (1 - BARRA_REPOUSO) * realce);
      }

      mapa[y * LARGURA + x] = intensidade;
    }
  }

  const indices = new Uint8Array(LARGURA * ALTURA);
  for (let i = 0; i < indices.length; i++) {
    indices[i] = Math.round(Math.max(0, Math.min(1, mapa[i])) * (TONS - 1));
  }
  return indices;
}

// --- GIF ---------------------------------------------------------------------

/**
 * LZW do GIF, na forma do `omggif`: a tabela cresce até 4096 e é limpa ali, e o
 * tamanho do código sobe ANTES de a entrada ser gravada.
 */
function comprimirLzw(bitsMinimos, indices) {
  const saida = [];
  const bloco = [];
  let acumulador = 0;
  let bitsNoAcumulador = 0;

  const fecharBloco = () => {
    if (bloco.length === 0) return;
    saida.push(bloco.length, ...bloco);
    bloco.length = 0;
  };
  const emitir = (codigo, bits) => {
    acumulador |= codigo << bitsNoAcumulador;
    bitsNoAcumulador += bits;
    while (bitsNoAcumulador >= 8) {
      bloco.push(acumulador & 0xff);
      acumulador >>= 8;
      bitsNoAcumulador -= 8;
      if (bloco.length === 255) fecharBloco();
    }
  };

  const limpar = 1 << bitsMinimos;
  const fim = limpar + 1;
  let bits = bitsMinimos + 1;
  let tabela = new Map();
  let proximo = limpar + 2;

  emitir(limpar, bits);
  let chave = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const composta = (chave << 8) | k;
    const conhecida = tabela.get(composta);
    if (conhecida !== undefined) {
      chave = conhecida;
      continue;
    }
    emitir(chave, bits);
    if (proximo === 4096) {
      emitir(limpar, bits);
      tabela = new Map();
      proximo = limpar + 2;
      bits = bitsMinimos + 1;
    } else {
      if (proximo >= 1 << bits) bits++;
      tabela.set(composta, proximo++);
    }
    chave = k;
  }
  emitir(chave, bits);
  emitir(fim, bits);
  if (bitsNoAcumulador > 0) {
    bloco.push(acumulador & 0xff);
    if (bloco.length === 255) fecharBloco();
  }
  fecharBloco();
  saida.push(0); // terminador de sub-blocos
  return saida;
}

const dois = (n) => [n & 0xff, (n >> 8) & 0xff];

/** Os bytes exatos do `.gif`. Determinístico: mesma entrada, mesmos bytes. */
export function gerarSplash() {
  const paleta = rampa(FUNDO, ACENTO, TONS);
  const bits = Math.log2(TONS); // 6
  const bytes = [];

  bytes.push(...[...("GIF89a")].map((c) => c.charCodeAt(0)));
  bytes.push(...dois(LARGURA), ...dois(ALTURA));
  /* Tabela global presente | resolução de cor | sem ordenação | tamanho. */
  bytes.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);
  for (const [r, g, b] of paleta) bytes.push(r, g, b);

  /* Extensão da Netscape: repetir para sempre. Sem ela o GIF roda uma vez e
     congela, e a instalação dura mais que um segundo. */
  bytes.push(0x21, 0xff, 0x0b);
  bytes.push(...[...("NETSCAPE2.0")].map((c) => c.charCodeAt(0)));
  bytes.push(0x03, 0x01, 0, 0, 0);

  for (let i = 0; i < QUADROS; i++) {
    /* Descarte 1 ("não descartar"): os quadros são opacos e de tela cheia. */
    bytes.push(0x21, 0xf9, 0x04, 0x04, ...dois(ATRASO_CS), 0, 0);
    bytes.push(0x2c, ...dois(0), ...dois(0), ...dois(LARGURA), ...dois(ALTURA), 0);
    bytes.push(bits);
    bytes.push(...comprimirLzw(bits, quadro(i / QUADROS)));
  }

  bytes.push(0x3b); // fim do arquivo
  return Buffer.from(bytes);
}

export const MEDIDAS = { LARGURA, ALTURA, QUADROS, FUNDO, ACENTO, TONS };
