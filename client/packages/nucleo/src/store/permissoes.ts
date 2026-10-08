/**
 * "As permissões mudaram": um sinal, não um dado.
 *
 * Quem decide o que a pessoa pode fazer é a tabela de cargos do SDK (`pode()`), e ela
 * muda por evento (cargo editado, cargo apagado, membro com cargo novo). Os componentes
 * que leem `pode()` só no render não acordam sozinhos quando isso acontece: a cápsula de
 * voz continuaria oferecendo "compartilhar tela" a quem acabou de perder o cargo.
 *
 * Este store é só o aviso. Não guarda permissão nenhuma (a resposta continua vindo de
 * `pode()`, sempre fresca) e por isso não há o que ficar velho nem o que cachear. Quem
 * assina via `usePode` recebe um booleano, comparado por valor: a mudança de cargo que
 * não altera ESTA resposta não re-renderiza ninguém.
 *
 * Sem Context: é um store de módulo, como o resto do núcleo.
 */
type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

export function assinarPermissoes(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Chamado pelo adapter quando cargo ou membro muda. Também é o gancho dos testes. */
export function notificarMudancaDePermissoes(): void {
  for (const ouvinte of [...ouvintes]) ouvinte();
}
