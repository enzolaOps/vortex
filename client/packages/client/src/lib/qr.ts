/**
 * Codificador de QR — modo byte, correção M, versões 1 a 10.
 *
 * ⚠ **Escrito à mão, e não uma dependência.** O único consumidor é a tela de
 * entrada por QR, e o que ela codifica é um endereço curto
 * (`https://dominio/qr/<32 caracteres>`, ~70 bytes → versão 5). O pacote
 * `qrcode` resolve todos os modos, todas as versões e três formatos de saída,
 * e traz isso para o carregamento inicial de uma tela que todo mundo abre.
 * Aqui são ~200 linhas de um algoritmo fixo desde 2000 (ISO/IEC 18004), com
 * vetores conhecidos em `qr.test.ts`.
 *
 * O que ficou de fora de propósito: modos numérico, alfanumérico e kanji (o
 * endereço é byte de qualquer jeito), versões acima de 10 (346 codewords
 * cabem 213 bytes — três vezes o endereço) e os níveis L, Q e H. M segura 15%
 * de dano, que é o que uma tela fotografada por um celular precisa.
 *
 * A estrutura segue a implementação de referência de Nayuki (MIT), que é a
 * forma mais curta e mais auditada do algoritmo.
 */

/** `[total de codewords, codewords de correção por bloco, blocos]` na correção M. */
const TABELA_M: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [26, 10, 1],
  [44, 16, 1],
  [70, 26, 1],
  [100, 18, 2],
  [134, 24, 2],
  [172, 16, 4],
  [196, 18, 4],
  [242, 22, 4],
  [292, 22, 5],
  [346, 26, 5],
];

const ALINHAMENTO: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

export const VERSAO_MAXIMA = 10;

/** A matriz: `true` é módulo escuro. Linha, depois coluna. */
export type MatrizQr = readonly (readonly boolean[])[];

/* ----------------------------------------------------------------- GF(256) */

export function multiplicarGf(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function divisorRs(grau: number): number[] {
  const r = new Array<number>(grau).fill(0);
  r[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = multiplicarGf(r[j]!, raiz);
      if (j + 1 < r.length) r[j] = r[j]! ^ r[j + 1]!;
    }
    raiz = multiplicarGf(raiz, 0x02);
  }
  return r;
}

/** Os codewords de correção Reed-Solomon de um bloco. */
export function restoRs(dados: readonly number[], grau: number): number[] {
  const divisor = divisorRs(grau);
  const r = new Array<number>(grau).fill(0);
  for (const b of dados) {
    const fator = b ^ r.shift()!;
    r.push(0);
    for (let i = 0; i < divisor.length; i++) {
      r[i] = r[i]! ^ multiplicarGf(divisor[i]!, fator);
    }
  }
  return r;
}

/* ------------------------------------------------------------ informação */

/** Os 15 bits de formato (correção M = 00) com a máscara. */
export function bitsDeFormato(mascara: number): number {
  const dados = (0 << 3) | mascara;
  let resto = dados;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  return ((dados << 10) | resto) ^ 0x5412;
}

/** Os 18 bits de versão, só de 7 em diante. */
export function bitsDeVersao(versao: number): number {
  let resto = versao;
  for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
  return (versao << 12) | resto;
}

function bit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

/* ---------------------------------------------------------------- dados */

function capacidadeEmBytes(versao: number): number {
  const [total, ec, blocos] = TABELA_M[versao]!;
  const bitsDeContagem = versao < 10 ? 8 : 16;
  return Math.floor(((total - ec * blocos) * 8 - 4 - bitsDeContagem) / 8);
}

/** A menor versão onde o texto cabe, ou `undefined`. */
export function versaoPara(bytes: number): number | undefined {
  for (let v = 1; v <= VERSAO_MAXIMA; v++) {
    if (bytes <= capacidadeEmBytes(v)) return v;
  }
  return undefined;
}

function codewordsDeDados(bytes: Uint8Array, versao: number): number[] {
  const [total, ec, blocos] = TABELA_M[versao]!;
  const capacidade = (total - ec * blocos) * 8;
  const bits: number[] = [];
  const empurrar = (valor: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };

  empurrar(0b0100, 4);
  empurrar(bytes.length, versao < 10 ? 8 : 16);
  for (const b of bytes) empurrar(b, 8);
  empurrar(0, Math.min(4, capacidade - bits.length));
  empurrar(0, (8 - (bits.length % 8)) % 8);

  const saida: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]!;
    saida.push(b);
  }
  for (let pad = 0xec; saida.length < capacidade / 8; pad ^= 0xec ^ 0x11) {
    saida.push(pad);
  }
  return saida;
}

/** Divide em blocos, calcula a correção de cada um e intercala. */
export function intercalar(dados: readonly number[], versao: number): number[] {
  const [total, ec, numBlocos] = TABELA_M[versao]!;
  const curtos = numBlocos - (total % numBlocos);
  const tamanhoCurto = Math.floor(total / numBlocos);

  const blocos: number[][] = [];
  let k = 0;
  for (let i = 0; i < numBlocos; i++) {
    const n = tamanhoCurto - ec + (i < curtos ? 0 : 1);
    const bloco = dados.slice(k, k + n);
    k += n;
    // O bloco curto ganha um byte de enchimento para alinhar as colunas; ele
    // é pulado na intercalação e nunca chega à matriz.
    const enchimento = i < curtos ? [0] : [];
    blocos.push([...bloco, ...enchimento, ...restoRs(bloco, ec)]);
  }

  const saida: number[] = [];
  for (let i = 0; i < blocos[0]!.length; i++) {
    blocos.forEach((b, j) => {
      if (i !== tamanhoCurto - ec || j >= curtos) saida.push(b[i]!);
    });
  }
  return saida;
}

/* --------------------------------------------------------------- matriz */

function mascarar(m: number, x: number, y: number): boolean {
  switch (m) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

class Construcao {
  readonly lado: number;
  readonly modulos: boolean[][];
  readonly funcao: boolean[][];

  constructor(readonly versao: number) {
    this.lado = versao * 4 + 17;
    this.modulos = Array.from({ length: this.lado }, () =>
      new Array<boolean>(this.lado).fill(false),
    );
    this.funcao = Array.from({ length: this.lado }, () =>
      new Array<boolean>(this.lado).fill(false),
    );
  }

  fixo(x: number, y: number, escuro: boolean): void {
    this.modulos[y]![x] = escuro;
    this.funcao[y]![x] = true;
  }

  padroes(): void {
    for (let i = 0; i < this.lado; i++) {
      this.fixo(6, i, i % 2 === 0);
      this.fixo(i, 6, i % 2 === 0);
    }
    this.localizador(3, 3);
    this.localizador(this.lado - 4, 3);
    this.localizador(3, this.lado - 4);

    const pos = ALINHAMENTO[this.versao]!;
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) {
          continue;
        }
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.fixo(pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    this.formato(0);
    if (this.versao >= 7) {
      const bits = bitsDeVersao(this.versao);
      for (let i = 0; i < 18; i++) {
        const a = this.lado - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.fixo(a, b, bit(bits, i));
        this.fixo(b, a, bit(bits, i));
      }
    }
  }

  localizador(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.lado && yy >= 0 && yy < this.lado) {
          this.fixo(xx, yy, d !== 2 && d !== 4);
        }
      }
    }
  }

  formato(mascara: number): void {
    const bits = bitsDeFormato(mascara);
    for (let i = 0; i <= 5; i++) this.fixo(8, i, bit(bits, i));
    this.fixo(8, 7, bit(bits, 6));
    this.fixo(8, 8, bit(bits, 7));
    this.fixo(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.fixo(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.fixo(this.lado - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.fixo(8, this.lado - 15 + i, bit(bits, i));
    this.fixo(8, this.lado - 8, true);
  }

  codewords(dados: readonly number[]): void {
    let i = 0;
    for (let direita = this.lado - 1; direita >= 1; direita -= 2) {
      if (direita === 6) direita = 5;
      for (let vert = 0; vert < this.lado; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = direita - j;
          const subindo = ((direita + 1) & 2) === 0;
          const y = subindo ? this.lado - 1 - vert : vert;
          if (!this.funcao[y]![x] && i < dados.length * 8) {
            this.modulos[y]![x] = bit(dados[i >>> 3]!, 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  aplicarMascara(m: number): void {
    for (let y = 0; y < this.lado; y++) {
      for (let x = 0; x < this.lado; x++) {
        if (!this.funcao[y]![x] && mascarar(m, x, y)) {
          this.modulos[y]![x] = !this.modulos[y]![x];
        }
      }
    }
  }

  /**
   * Penalidade simplificada (regras 1, 2 e 4 da norma).
   *
   * A regra 3 — procurar o padrão 1:1:3:1:1 fora dos localizadores — fica de
   * fora: qualquer máscara é um QR VÁLIDO, e a penalidade só escolhe a mais
   * fácil de ler. As três regras restantes já afastam as máscaras que
   * produzem faixas e blocos, que são as que atrapalham a câmera.
   */
  penalidade(): number {
    let p = 0;
    const l = this.lado;
    for (let eixo = 0; eixo < 2; eixo++) {
      for (let a = 0; a < l; a++) {
        let corrida = 1;
        for (let b = 1; b < l; b++) {
          const atual = eixo === 0 ? this.modulos[a]![b] : this.modulos[b]![a];
          const antes = eixo === 0 ? this.modulos[a]![b - 1] : this.modulos[b - 1]![a];
          if (atual === antes) {
            corrida++;
          } else {
            if (corrida >= 5) p += corrida - 2;
            corrida = 1;
          }
        }
        if (corrida >= 5) p += corrida - 2;
      }
    }
    let escuros = 0;
    for (let y = 0; y < l; y++) {
      for (let x = 0; x < l; x++) {
        const c = this.modulos[y]![x];
        if (c) escuros++;
        if (
          x < l - 1 &&
          y < l - 1 &&
          c === this.modulos[y]![x + 1] &&
          c === this.modulos[y + 1]![x] &&
          c === this.modulos[y + 1]![x + 1]
        ) {
          p += 3;
        }
      }
    }
    const k = Math.ceil(Math.abs(escuros * 20 - l * l * 10) / (l * l)) - 1;
    return p + Math.max(0, k) * 10;
  }
}

/** Quais módulos são padrão fixo — exposto para o teste decodificar. */
export function mapaDeFuncao(versao: number): MatrizQr {
  const c = new Construcao(versao);
  c.padroes();
  return c.funcao;
}

/** `[total, correção por bloco, blocos]` — exposto para o teste. */
export function blocosDaVersao(versao: number): readonly [number, number, number] {
  return TABELA_M[versao]!;
}

/**
 * Codifica o texto em UTF-8 e devolve a matriz, sem zona de silêncio.
 *
 * Lança se não couber na versão 10 — quem chama sabe o que codifica, e um QR
 * truncado seria um endereço errado apontado por uma câmera.
 */
export function gerarQr(texto: string, mascaraFixa?: number): MatrizQr {
  const bytes = new TextEncoder().encode(texto);
  const versao = versaoPara(bytes.length);
  if (versao === undefined) throw new Error("texto longo demais para o QR");

  const final = intercalar(codewordsDeDados(bytes, versao), versao);

  let melhor: Construcao | undefined;
  let menor = Infinity;
  const mascaras = mascaraFixa === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [mascaraFixa];
  for (const m of mascaras) {
    const c = new Construcao(versao);
    c.padroes();
    c.codewords(final);
    c.aplicarMascara(m);
    c.formato(m);
    const p = c.penalidade();
    if (p < menor) {
      menor = p;
      melhor = c;
    }
  }
  return melhor!.modulos;
}
