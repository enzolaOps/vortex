/**
 * Roda uma tarefa assíncrona por item, com no máximo `concorrencia` ao mesmo
 * tempo.
 *
 * ⚠ **Existe por "marcar tudo como lido"**, e o número importa. O protocolo só
 * tem `ack` POR CANAL; dezenas de `PUT` disparados no mesmo tique batem no
 * limitador de taxa do servidor, e os que voltam 429 viram falha que ninguém
 * pediu. Em fila, a carga é constante e o servidor responde a todos.
 *
 * Uma falha não para a fila: marcar lido é idempotente, e desistir no terceiro
 * canal deixaria os outros quarenta não lidos por causa de um. Quem chama
 * recebe as falhas separadas e decide o que dizer.
 *
 * A ordem de CONCLUSÃO não é garantida; a de início é a da lista.
 */
export async function emFila<T>(
  itens: readonly T[],
  tarefa: (item: T) => Promise<void>,
  concorrencia: number,
  aoConcluir?: (feitos: number) => void,
): Promise<{ readonly ok: readonly T[]; readonly falhas: readonly T[] }> {
  const ok: T[] = [];
  const falhas: T[] = [];
  let proximo = 0;
  let feitos = 0;

  const trabalhador = async (): Promise<void> => {
    while (proximo < itens.length) {
      const item = itens[proximo]!;
      proximo += 1;
      try {
        await tarefa(item);
        ok.push(item);
      } catch {
        falhas.push(item);
      }
      feitos += 1;
      aoConcluir?.(feitos);
    }
  };

  const vagas = Math.max(1, Math.min(concorrencia, itens.length));
  await Promise.all(Array.from({ length: vagas }, trabalhador));
  return { ok, falhas };
}
