/**
 * Peças puras da entrada e da saída de sala, separadas do `motorDeVoz` para
 * serem testáveis sem LiveKit. O motor as injeta com o que é do LiveKit.
 */

/**
 * Entrar na sala E pedir o microfone ao mesmo tempo.
 *
 * ⚠ `getUserMedia` (prompt de permissão, abrir o dispositivo) e a rede
 * (`joinCall` + `connect`) não dependem uma da outra. Em série, a entrada
 * pagava as duas somadas. Aqui a captura começa antes e é publicada quando a
 * conexão fecha.
 *
 * - Sem `querMicrofone` (mudo / sem permissão de falar) o microfone NÃO é
 *   pedido — entrar mudo não é consentir em abrir o dispositivo.
 * - Se a conexão falha, a faixa já capturada é solta (o indicador do sistema
 *   não pode ficar aceso).
 * - Se a captura falha, o erro sobe como subia antes, só que depois de
 *   conectar; quem chama desconecta no `catch`.
 */
export async function conectarComMicrofone<R, T>(a: {
  querMicrofone: boolean;
  capturar: () => Promise<T>;
  entrar: () => Promise<R>;
  /** Decide DEPOIS de conectar: o usuário pode ter mudado o mudo no meio. */
  aindaQuerMicrofone: () => boolean;
  publicar: (sala: R, faixa: T) => Promise<void>;
  /** Mudo no começo e desmudo no meio: abre o microfone pelo caminho normal. */
  publicarAgora: (sala: R) => Promise<void>;
  soltar: (faixa: T) => void;
  vigente: () => boolean;
}): Promise<R> {
  const captura = a.querMicrofone ? a.capturar() : undefined;
  // Sem isto, falha da captura enquanto a rede ainda corre vira "unhandled".
  captura?.catch(() => undefined);

  let sala: R;
  try {
    sala = await a.entrar();
  } catch (e) {
    void captura?.then(a.soltar, () => undefined);
    throw e;
  }

  if (captura === undefined) {
    if (a.vigente() && a.aindaQuerMicrofone()) await a.publicarAgora(sala);
    return sala;
  }
  const faixa = await captura;
  if (!a.vigente() || !a.aindaQuerMicrofone()) {
    a.soltar(faixa);
    return sala;
  }
  await a.publicar(sala, faixa);
  return sala;
}

/**
 * Sai da sala: o aviso ao servidor (`leave_call`) e o `disconnect` local rodam
 * JUNTOS. `esperarAviso: false` (trocar de sala) devolve assim que o
 * `disconnect` termina — o aviso nunca lança e não segura a entrada na nova.
 */
export async function encerrarSala(a: {
  avisar: () => Promise<void>;
  desconectar: () => Promise<void>;
  esperarAviso: boolean;
}): Promise<void> {
  const aviso = a.avisar().catch(() => undefined);
  const desconexao = a.desconectar();
  if (a.esperarAviso) await Promise.all([aviso, desconexao]);
  else await desconexao;
}

/**
 * Embrulha um handler de evento da sala para só valer enquanto ela é a sala
 * atual. Evento tardio da sala antiga (queda, `Disconnected`, `Connected`
 * atrasado) não pode sobrescrever o estado da nova.
 */
export function soSeVigente<A extends unknown[]>(
  vigente: () => boolean,
  fn: (...args: A) => void,
): (...args: A) => void {
  return (...args) => {
    if (vigente()) fn(...args);
  };
}
