/**
 * Quanto tempo durou, em português curto.
 *
 * Existe por causa da linha de chamada na timeline: o protocolo entrega
 * `startedAt` e `finishedAt` em `CallStartedSystemMessage`, e "durou 12 min" é
 * a diferença entre uma linha que registra um evento e uma que conta o que
 * aconteceu.
 *
 * ⚠ **Sem `Intl`, e a ausência é deliberada.** `Intl.RelativeTimeFormat` e
 * `Intl.DurationFormat` resolvem plural e gênero de graça — e nenhum dos dois
 * é problema aqui, porque "s", "min" e "h" são símbolos invariáveis. O que
 * eles cobrariam é uma instância por sessão para três `if`, e o suporte de
 * `DurationFormat` ainda não é universal. Ver a nota de `HORA` em `map.ts`:
 * formatter é caro de criar e barato de usar, então só se paga quando resolve
 * algo.
 *
 * Chamado na ESCRITA da tradução, nunca no render — mesma regra de
 * `createdAtText` e `tamanhoTexto`.
 */
export function duracaoCurta(ms: number): string {
  /*
    Relógio de servidor pode voltar atrás, e `finishedAt - startedAt` negativo
    produziria "-3 s" numa linha que ninguém conseguiria explicar. Zero é a
    resposta honesta: durou o que o relógio consegue afirmar.
  */
  const seguros = Number.isFinite(ms) && ms > 0 ? ms : 0;

  const segundos = Math.round(seguros / 1000);
  if (segundos < 60) return `${String(segundos)} s`;

  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${String(minutos)} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  /*
    "2 h" e não "2 h 0 min": o zero não acrescenta e ainda sugere precisão que
    o arredondamento acima não tem.
  */
  return resto === 0
    ? `${String(horas)} h`
    : `${String(horas)} h ${String(resto)} min`;
}
