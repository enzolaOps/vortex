import { memo } from "react";

import { cargosDoServidor } from "../sdk/cargos";
import { IconeDeCargo } from "./IconeDeCargo";
import { usePinturaDeCargo } from "../store/hooks";
import { TINTA_HOLOGRAFICA } from "../tema/cargo";
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
  iconeUrl,
  denso,
}: {
  nome: string;
  cor: string | undefined;
  iconeUrl: string | undefined;
  denso: boolean;
}) {
  const pintura = usePinturaDeCargo(cor);
  const semPonto = pintura !== undefined && pintura.tipo !== "solida";

  return (
    <span
      className={denso ? css.densa : css.pilula}
      data-pintura={semPonto ? pintura.tipo : undefined}
      /*
        ⚠ **A cor é DADO e por isso vai em `style`** — é a mesma exceção da cor
        de cargo no nome do autor, e a única classe de cor literal que este
        projeto aceita. Sólida: texto na cor e fundo a 15%. Gradiente: as
        paradas a 33% no FUNDO e o texto em `text-1` (no CSS), como o design —
        texto em gradiente sobre fundo em gradiente perderia as duas leituras.
        Sem pintura, o cargo é neutro e a pílula não inventa cor nenhuma.
      */
      style={
        pintura === undefined
          ? undefined
          : pintura.tipo === "holografico"
            ? // O preset em opacidade cheia e o texto escuro do design — o par
              // não muda com o tema porque o fundo não muda.
              { backgroundImage: pintura.fundo, color: TINTA_HOLOGRAFICA }
            : pintura.tipo === "gradiente"
              ? { backgroundImage: pintura.fundo }
              : {
                  color: pintura.cor,
                  backgroundColor: `color-mix(in oklab, ${pintura.cor} 15%, transparent)`,
                }
      }
    >
      {/* Sem o ponto no modo denso: há uma pílula por linha numa tabela de
          mil, e o ponto repetido mil vezes vira textura, não informação. E
          sem ele no gradiente: um ponto de UMA cor contradiria o fundo de
          duas, e o design o tira. */}
      {/* Com ícone, a imagem toma o lugar do ponto — as duas marcam o mesmo
          "de que cargo é isto", e ponto e ícone lado a lado seriam dois
          sinais para uma informação. Aparece também no denso e no gradiente:
          o ícone é escolha de quem administra, o ponto é só decoração. */}
      {iconeUrl ? (
        <IconeDeCargo url={iconeUrl} nome={undefined} tamanho={denso ? "pequeno" : "medio"} />
      ) : denso || semPonto ? null : (
        <span className={css.ponto} aria-hidden />
      )}
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
        <Pilula key={c.id} nome={c.nome} cor={c.cor} iconeUrl={c.iconeUrl} denso={denso} />
      ))}
    </div>
  );
}
