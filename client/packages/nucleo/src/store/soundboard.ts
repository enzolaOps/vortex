/**
 * O painel de sons do lado de QUEM OUVE: o volume do painel e o que está
 * tocando agora.
 *
 * ⚠ **Dois volumes, e este é o segundo.** O de ORIGEM mora no efeito sonoro,
 * no servidor, e é o que todo mundo ouve; este multiplica em cima, só nesta
 * máquina — é a nota do rodapé da página de efeitos sonoros dita em código.
 * Guardado em `localStorage` porque é conveniência de quem usa, como a
 * densidade, e não algo que outra pessoa precise ver.
 *
 * "Tocando" é estado EFÊMERO — muda a cada clique e some quando o áudio acaba.
 * Mora aqui e não no store das listas de sons: uma lista que republicasse a
 * cada toque acordaria a página de configurações inteira.
 */
type Ouvinte = () => void;

const CHAVE = "vx:soundboard:volume";

function lerVolumeGuardado(): number {
  try {
    const v = Number(localStorage.getItem(CHAVE));
    return Number.isFinite(v) && v >= 0 && v <= 100 && localStorage.getItem(CHAVE) !== null
      ? v
      : 70;
  } catch {
    return 70;
  }
}

let volume = lerVolumeGuardado();
/** Os IDs de som tocando agora. Array novo a cada mudança — é o snapshot. */
let tocando: readonly string[] = [];
const ouvintes = new Set<Ouvinte>();

function avisar(): void {
  for (const o of ouvintes) o();
}

export function assinarSoundboard(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function lerVolumeDoPainel(): number {
  return volume;
}

export function definirVolumeDoPainel(v: number): void {
  const novo = Math.min(100, Math.max(0, Math.round(v)));
  if (novo === volume) return;
  volume = novo;
  try {
    localStorage.setItem(CHAVE, String(novo));
  } catch {
    /* Armazenamento bloqueado: vale para esta sessão. */
  }
  avisar();
}

export function lerTocando(): readonly string[] {
  return tocando;
}

export function marcarTocando(somId: string, ligado: boolean): void {
  const tem = tocando.includes(somId);
  if (ligado === tem) return;
  tocando = ligado ? [...tocando, somId] : tocando.filter((id) => id !== somId);
  avisar();
}
