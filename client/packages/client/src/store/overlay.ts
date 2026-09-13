import { POSICAO_PADRAO, ehPosicao, type Posicao } from "../overlay/modelo";

/**
 * A configuração do overlay do jogo: ligado e posição padrão.
 *
 * ⚠ **No cliente, e não nas preferências da casca.** A casca só aceita as
 * chaves que o main conhece, e as da tela Desktop hoje não chegam lá — o
 * overlay não pode depender disso para lembrar a escolha entre sessões.
 */
export type ConfigDoOverlay = { readonly ativo: boolean; readonly posicao: Posicao };

const CHAVE = "vortex:overlay";
const PADRAO: ConfigDoOverlay = { ativo: false, posicao: POSICAO_PADRAO };

function ler(): ConfigDoOverlay {
  try {
    const o = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Record<string, unknown> | null;
    if (!o) return PADRAO;
    return {
      ativo: o.ativo === true,
      posicao: ehPosicao(o.posicao) ? o.posicao : PADRAO.posicao,
    };
  } catch {
    return PADRAO;
  }
}

let config = ler();
const ouvintes = new Set<() => void>();

export function assinarOverlay(o: () => void): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

export function lerOverlay(): ConfigDoOverlay {
  return config;
}

export function definirOverlay(mudanca: Partial<ConfigDoOverlay>): void {
  const proximo = { ...config, ...mudanca };
  if (proximo.ativo === config.ativo && proximo.posicao === config.posicao) return;
  config = proximo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(config));
  } catch {
    /* vale nesta aba */
  }
  for (const o of ouvintes) o();
}
