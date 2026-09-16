/**
 * Tela cheia exclusiva: a DECISÃO, sem Windows nem Electron.
 *
 * O overlay é uma janela por cima de tudo, e em tela cheia EXCLUSIVA o jogo
 * toma a saída de vídeo — janela nenhuma aparece. O design pede: "o app avisa
 * uma vez por jogo e não tenta de novo". Esta é a regra; `telaCheia.ts`
 * pergunta ao sistema e `overlay.ts` age.
 */

/**
 * `QUERY_USER_NOTIFICATION_STATE` do shell32.
 *
 * ⚠ **Só o 3 é tela cheia exclusiva** (`QUNS_RUNNING_D3D_FULL_SCREEN`). O 2
 * (`QUNS_BUSY`) também diz "tela cheia", mas é o que jogos em tela cheia SEM
 * BORDAS e apresentações reportam — exatamente onde o overlay FUNCIONA. Tratar
 * o 2 como exclusivo avisaria sobre o caso que dá certo.
 */
export const QUNS_D3D_TELA_CHEIA = 3;

export type Leitura = {
  /** O que `SHQueryUserNotificationState` devolveu. */
  readonly estado: number;
  /** Caminho do executável da janela em primeiro plano, quando deu para ler. */
  readonly executavel: string | undefined;
};

/**
 * O jogo como chave: o nome do executável, sem pasta e em minúsculas.
 *
 * ⚠ **Nome, e não caminho.** O mesmo jogo muda de pasta quando a loja o move
 * de disco ou atualiza, e o aviso voltaria. E o caminho inteiro guardado em
 * disco seria o nome de usuário do Windows num arquivo de preferências.
 */
export function chaveDoJogo(executavel: string | undefined): string | undefined {
  if (!executavel) return undefined;
  const nome = executavel.split(/[\\/]/).pop()?.trim().toLowerCase();
  return nome ? nome : undefined;
}

/** "EldenRing.exe" → "EldenRing", para o texto do aviso. */
export function nomeParaMostrar(executavel: string): string {
  const nome = executavel.split(/[\\/]/).pop() ?? executavel;
  return nome.replace(/\.exe$/i, "");
}

export type Decisao = {
  /** O overlay deve ficar escondido — mostrar não adianta. */
  readonly esconder: boolean;
  /** Avisar sobre este jogo agora (e guardá-lo). */
  readonly avisar: string | undefined;
};

/**
 * Dado o que o sistema disse e os jogos já avisados, o que fazer.
 *
 * ⚠ **Esconde mesmo sem saber o executável**: a tela cheia exclusiva é o fato
 * que importa, e uma janela `alwaysOnTop` por cima dela pode forçar o jogo a
 * sair do modo — o pior dos dois mundos. Só o AVISO precisa do nome, porque é
 * "uma vez por jogo".
 */
export function decidir(leitura: Leitura | undefined, avisados: readonly string[]): Decisao {
  if (!leitura || leitura.estado !== QUNS_D3D_TELA_CHEIA) {
    return { esconder: false, avisar: undefined };
  }
  const chave = chaveDoJogo(leitura.executavel);
  return {
    esconder: true,
    avisar: chave && !avisados.includes(chave) ? chave : undefined,
  };
}

/** Teto da lista guardada: jogos de uma vida inteira cabem, e ela não cresce sem fim. */
const TETO = 200;

export function registrarAvisado(avisados: readonly string[], chave: string): string[] {
  if (avisados.includes(chave)) return [...avisados];
  return [...avisados, chave].slice(-TETO);
}
