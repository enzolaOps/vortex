import css from "./ListaDeDiff.module.css";

/**
 * O diff em par, o mesmo nas duas telas que o mostram: o registro de
 * auditoria (D-CSERV-34) e o banner de dessincronização do canal
 * (D-CCANAL-10, "abre o mesmo diff da auditoria").
 *
 * `<dl>` e não tabela: cada linha é um termo (o campo) com a sua definição (o
 * par), que é exatamente o que a lista de definição anuncia a um leitor de
 * tela — "campo, antes, depois", sem cabeçalho de coluna a repetir.
 */
export function ListaDeDiff({
  linhas,
  rotulo,
}: {
  linhas: readonly { readonly campo: string; readonly antes: string; readonly depois: string }[];
  /** Nome acessível da lista, quando ela não está dentro de algo que já a nomeia. */
  rotulo?: string;
}) {
  return (
    <dl className={css.lista} aria-label={rotulo}>
      {linhas.map((m) => (
        <div key={m.campo} className={css.linha}>
          <dt className={css.campo}>{m.campo}</dt>
          <dd className={css.valores}>
            <span className={css.antes}>− {m.antes}</span>
            <span className={css.depois}>+ {m.depois}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
