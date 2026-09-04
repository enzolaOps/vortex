import { memo } from "react";

import { cargosDoServidor } from "../sdk/cargos";
import { useCorDeCargo } from "../store/hooks";
import css from "./PilulasDeCargo.module.css";

/**
 * Uma pílula. Componente próprio por causa do HOOK de cor.
 *
 * `useCorDeCargo` faz o clamp de luminosidade — a cor vem de quem administra o
 * servidor e pode ser qualquer coisa, inclusive amarelo puro sobre fundo
 * claro. Hook não roda em laço, então cada pílula precisa ser um componente.
 * É a mesma razão de `NomeDoAutor` existir.
 */
const Pilula = memo(function Pilula({
  nome,
  cor,
  denso,
}: {
  nome: string;
  cor: string | undefined;
  denso: boolean;
}) {
  const legivel = useCorDeCargo(cor);

  return (
    <span
      className={denso ? css.densa : css.pilula}
      /*
        ⚠ **A cor é DADO e por isso vai em `style`** — é a mesma exceção da cor
        de cargo no nome do autor, e a única classe de cor literal que este
        projeto aceita. O fundo é a mesma cor a 15%; sem `legivel`, o cargo é
        neutro e a pílula não inventa cor nenhuma.
      */
      style={
        legivel
          ? {
              color: legivel,
              backgroundColor: `color-mix(in oklab, ${legivel} 15%, transparent)`,
            }
          : undefined
      }
    >
      {/* Sem o ponto no modo denso: há uma pílula por linha numa tabela de
          mil, e o ponto repetido mil vezes vira textura, não informação. */}
      {denso ? null : <span className={css.ponto} aria-hidden />}
      {nome}
    </span>
  );
});

/**
 * As pílulas de cargo de uma pessoa num servidor.
 *
 * ⚠ **Bloqueada por três fases, e o que faltava era DADO e não tela.** O
 * `MemberSnapshot` carregava `cor` e `cargo` — os do cargo HASTEADO — e nunca
 * "quais são os cargos dela". `cargosIds` entrou na fase 6 e destravou isto
 * junto com o submenu de cargos e a hierarquia.
 *
 * ⚠ **Os nomes vêm do SERVIDOR, não do snapshot do membro.** Copiá-los para
 * dentro de cada membro faria uma renomeação de cargo republicar a member list
 * inteira; aqui a lista de cargos é lida uma vez por abertura de cartão, que é
 * quando alguém está olhando.
 */
export function PilulasDeCargo({
  serverId,
  cargosIds,
  denso = false,
}: {
  serverId: string;
  cargosIds: readonly string[];
  /**
   * A variante de TABELA — 11px e sem o ponto.
   *
   * O design usa a mesma peça em duas densidades: com ponto no cartão de
   * perfil, onde ela aparece uma vez e o ponto ajuda a ler a cor; sem ponto na
   * tabela de membros, onde há uma por linha.
   */
  denso?: boolean;
}) {
  if (cargosIds.length === 0) return null;

  const doServidor = cargosDoServidor(serverId);
  /*
    A ordem é a do MEMBRO (do mais alto ao mais baixo), e o `find` resolve o
    nome. Cargo que sumiu do servidor entre a leitura do membro e esta some da
    lista em vez de virar "cargo desconhecido" — um nome inventado seria pior
    que a ausência numa superfície que existe para dizer quem a pessoa é.
  */
  const cargos = cargosIds
    .map((id) => doServidor.find((c) => c.id === id))
    .filter((c) => c !== undefined);

  if (cargos.length === 0) return null;

  return (
    <div className={css.pilulas}>
      {cargos.map((c) => (
        <Pilula key={c.id} nome={c.nome} cor={c.cor} denso={denso} />
      ))}
    </div>
  );
}
