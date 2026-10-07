import { count } from "nucleo/arnes/stats";
import { chaveDeMembro } from "nucleo/sdk/domain";
import { pode } from "nucleo/sdk/permissoes";
import { useMessage, useNomeDoMembro } from "nucleo/store/hooks";
import { responderA } from "nucleo/store/resposta";
import { memo } from "react";

import { chat } from "../../textos";
import { Mensagem } from "../../ui/ds";
import { AvatarDoAutor } from "./AvatarDoAutor";
import { AnexosDaMensagem } from "./AnexosDaMensagem";
import { CitacaoDeResposta } from "./CitacaoDeResposta";
import { CorpoDaMensagem } from "./CorpoDaMensagem";
import { EditorInline } from "./EditorInline";
import { useEditandoEsta } from "./hooks";
import linha from "./Linha.module.css";
import css from "./ListaDeMensagens.module.css";
import { abrirMenuDaMensagem } from "./MenuDaLista";
import { RodapeDaMensagem, temRodape } from "./RodapeDaMensagem";

export interface LinhaDeMensagemProps {
  id: string;
  servidorId: string;
}

/**
 * A linha da lista: assina SÓ a própria mensagem (e o próprio autor) pelo ID e
 * entrega o snapshot ao `Mensagem` do DS, que é puro. Editar uma mensagem
 * acorda uma linha, não a lista (lei nº 1). Nenhum dado de entidade passa por
 * Context e nenhuma prop é montada fora do que o snapshot já cacheia.
 *
 * O menu de contexto NÃO mora aqui: a lista tem um só, e a linha apenas diz
 * quem é (`data-menu-mensagem`). Um menu do Radix por linha montaria quatro
 * componentes por mensagem na velocidade do scroll.
 *
 * Mensagem não resolvida devolve um placeholder COM altura: linha medindo 0px
 * realimenta o virtualizador e trava a aba.
 */
function LinhaBase({ id, servidorId }: LinhaDeMensagemProps) {
  count("rowRenders");
  const m = useMessage(id);
  const nomeDoAutor = useNomeDoMembro(chaveDeMembro(servidorId, m?.authorId ?? ""));
  const editando = useEditandoEsta(id);

  if (!m) return <div className={css.placeholder} aria-hidden="true" />;

  const enviada = m.sendState === "sent";
  const podeReagir = pode(m.channelId, "reagir");
  const podeResponder = enviada && pode(m.channelId, "responder");

  return (
    <div data-menu-mensagem={m.sistema ? undefined : id}>
      {m.dia !== undefined && (
        <div className={css.divisor} role="separator">
          <span>{m.dia}</span>
        </div>
      )}
      {m.primeiraNaoLida && (
        <div className={linha.novas} role="separator" data-novas>
          <span>{chat.novas}</span>
        </div>
      )}
      {m.sistema ? (
        <p className={css.sistema}>{chat.eventoDoCanal}</p>
      ) : (
        <>
          {m.respostas[0] !== undefined && (
            <CitacaoDeResposta alvoId={m.respostas[0]} canalId={m.channelId} servidorId={servidorId} />
          )}
          <Mensagem
            autor={{ nome: nomeDoAutor ?? chat.autorDesconhecido, id: m.authorId }}
            avatar={<AvatarDoAutor servidorId={servidorId} autorId={m.authorId} nome={nomeDoAutor ?? chat.autorDesconhecido} />}
            hora={m.createdAtText}
            continuacao={!m.iniciaGrupo}
            destacada={m.mencionaVoce}
            esmaecida={!enviada}
            acoes={enviada && !editando}
            onReagir={podeReagir ? (e) => abrirMenuDaMensagem(e.currentTarget) : undefined}
            onResponder={
              podeResponder
                ? () => {
                    responderA(m.channelId, id);
                  }
                : undefined
            }
            onMaisAcoes={(e) => abrirMenuDaMensagem(e.currentTarget)}
            rodape={
              <>
                {m.anexos.length > 0 && <AnexosDaMensagem anexos={m.anexos} />}
                {temRodape(m) && <RodapeDaMensagem m={m} podeReagir={podeReagir} />}
              </>
            }
          >
            {editando ? (
              <EditorInline id={id} textoInicial={m.content} />
            ) : (
              <CorpoDaMensagem blocos={m.blocos} servidorId={servidorId} />
            )}
          </Mensagem>
        </>
      )}
    </div>
  );
}

export const LinhaDeMensagem = memo(LinhaBase);
