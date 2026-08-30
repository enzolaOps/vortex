import { Info } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Interruptor } from "../components/ui/Interruptor";
import { MarcaDeOpcao } from "../components/ui/Marcador";
import { toast } from "../components/ui/toastStore";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useServer } from "../store/hooks";
import {
  ALCANCES_DE_DM,
  aplicarATodos,
  assinarPrivacidadeDoServidor,
  definirPrivacidadeDoServidor,
  FILTROS_DE_CONTEUDO,
  lerPrivacidadeDoServidor,
  type AlcanceDeDm,
  type FiltroDeConteudo,
} from "../store/privacidadeDoServidor";
import css from "./PrivacidadeDoServidor.module.css";

const DM: Record<AlcanceDeDm, { titulo: string; detalhe: string }> = {
  todos: {
    titulo: "Qualquer membro pode me mandar DM",
    detalhe: "Inclusive quem você não conhece",
  },
  cargoComum: {
    titulo: "Só quem compartilha um cargo comigo",
    detalhe: "Quem estiver em algum cargo seu neste servidor",
  },
  ninguem: {
    titulo: "Ninguém deste servidor",
    /* ⚠ Dizer o que NÃO acontece é metade do valor: sem esta linha, "ninguém"
       lê como "vou perder contato com meus amigos daqui". */
    detalhe: "Amigos continuam podendo falar com você",
  },
};

const FILTRO: Record<FiltroDeConteudo, { titulo: string; detalhe: string }> = {
  nao: {
    titulo: "Não filtrar",
    detalhe: "Confio nos membros deste servidor",
  },
  deNaoAmigos: {
    titulo: "Filtrar de quem não é meu amigo",
    detalhe: "Recomendado",
  },
  tudo: {
    titulo: "Filtrar tudo",
    detalhe: "Mídia sensível entra sempre borrada",
  },
};

/**
 * Um cartão de escolha única.
 *
 * ⚠ O CARTÃO inteiro é o alvo — 412px contra os 16 do ponto —, e por isso a
 * marca é `MarcaDeOpcao` e não `Opcao`: aquele é um `<button>`, e botão dentro
 * de botão é HTML inválido. Mesmo arranjo do modo de entrada em Voz e vídeo.
 */
function Cartao({
  marcado,
  titulo,
  detalhe,
  aoEscolher,
}: {
  marcado: boolean;
  titulo: string;
  detalhe: string;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      className={css.cartao}
      onClick={aoEscolher}
    >
      <MarcaDeOpcao className={css.marca} />
      <span className={css.textos}>
        <span className={css.titulo}>{titulo}</span>
        <span className={css.detalhe}>{detalhe}</span>
      </span>
    </button>
  );
}

/**
 * Privacidade neste servidor.
 *
 * ⚠ **Modal do menu de contexto do servidor, e NÃO uma página de
 * configurações** — é o que a referência manda, com a razão: a decisão é
 * sempre tomada no contexto daquele servidor. Quem quer fechar as DMs de um
 * servidor está olhando para ele.
 *
 * ⚠ **Nenhuma destas preferências existe no protocolo.** Ver
 * `store/privacidadeDoServidor.ts`: o Revolt não tem privacidade por servidor
 * em lugar nenhum do schema, então elas valem nesta máquina até haver um
 * serviço `api` que as guarde. A tela diz isso no rodapé.
 */
export function PrivacidadeDoServidor({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const serverId = alvo?.tipo === "privacidadeDoServidor" ? alvo.serverId : "";
  const servidor = useServer(serverId);

  const p = useSyncExternalStore(assinarPrivacidadeDoServidor, () =>
    lerPrivacidadeDoServidor(serverId),
  );

  if (serverId === "") return null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Privacidade neste servidor"
        descricao={`${servidor?.name ?? "Servidor"} · vale só aqui, não é global`}
        className={css.painel}
        rodape={
          <>
            <span className={css.recadoDoRodape}>
              Para mudar em todos os servidores de uma vez, use Privacidade nas
              configurações do usuário.
            </span>
            <Botao
              variante="primario"
              onClick={() => {
                const quantos = aplicarATodos(serverId);
                /*
                  O toast diz QUANTOS, e não só "pronto": "aplicar a todos" é
                  a ação desta tela com o maior alcance, e um retorno sem
                  número deixa a pessoa sem saber se ela pegou dois servidores
                  ou vinte.
                */
                toast({
                  tipo: "info",
                  titulo:
                    quantos === 1
                      ? "Aplicado a 1 servidor."
                      : `Aplicado a ${String(quantos)} servidores.`,
                  descricao: "Servidores novos também nascem com esta escolha.",
                });
              }}
            >
              Aplicar a todos os servidores
            </Botao>
          </>
        }
      >
        <div className={css.sobrancelha}>Mensagens diretas</div>
        <div
          className={css.grupo}
          role="radiogroup"
          aria-label="Quem pode me mandar DM neste servidor"
        >
          {ALCANCES_DE_DM.map((id) => (
            <Cartao
              key={id}
              marcado={p.dm === id}
              titulo={DM[id].titulo}
              detalhe={DM[id].detalhe}
              aoEscolher={() =>
                definirPrivacidadeDoServidor(serverId, { dm: id })
              }
            />
          ))}
        </div>

        <div className={css.sobrancelha}>Filtro de conteúdo explícito</div>
        <div
          className={css.grupo}
          role="radiogroup"
          aria-label="Filtro de conteúdo explícito"
        >
          {FILTROS_DE_CONTEUDO.map((id) => (
            <Cartao
              key={id}
              marcado={p.filtro === id}
              titulo={FILTRO[id].titulo}
              detalhe={FILTRO[id].detalhe}
              aoEscolher={() =>
                definirPrivacidadeDoServidor(serverId, { filtro: id })
              }
            />
          ))}
        </div>

        <div className={css.sobrancelha}>Visibilidade e atividade</div>
        <div className={css.cartaoDeLinhas}>
          <div className={css.linha}>
            <div className={css.textos}>
              <div className={css.titulo}>Mostrar minha presença aqui</div>
              <p className={css.detalhe}>
                Desligado, você aparece como offline neste servidor
              </p>
            </div>
            <Interruptor
              ligado={p.mostrarPresenca}
              rotulo="Mostrar minha presença aqui"
              aoAlternar={(v) =>
                definirPrivacidadeDoServidor(serverId, { mostrarPresenca: v })
              }
            />
          </div>

          <div className={css.linha}>
            <div className={css.textos}>
              <div className={css.titulo}>Mostrar atividade em jogo</div>
              <p className={css.detalhe}>
                O que você está jogando fica visível para os membros
              </p>
            </div>
            <Interruptor
              ligado={p.mostrarAtividade}
              rotulo="Mostrar atividade em jogo"
              aoAlternar={(v) =>
                definirPrivacidadeDoServidor(serverId, { mostrarAtividade: v })
              }
            />
          </div>

          <div className={css.linha}>
            <div className={css.textos}>
              <div className={css.titulo}>
                Permitir que me adicionem como amigo
              </div>
              <p className={css.detalhe}>
                A partir do perfil dentro deste servidor
              </p>
            </div>
            <Interruptor
              ligado={p.permitirAmizade}
              rotulo="Permitir que me adicionem como amigo"
              aoAlternar={(v) =>
                definirPrivacidadeDoServidor(serverId, { permitirAmizade: v })
              }
            />
          </div>
        </div>

        <div className={css.sobrancelha}>Efeito na experiência</div>
        {/*
          ⚠ **Isto é um DIAGRAMA, não um controle** — mesma disciplina da
          ilustração de menu em Avançado: nenhum `button` aqui dentro, e o
          bloco sai da árvore de acessibilidade. Ele mostra o que a escolha
          acima produz, e alvos de verdade receberiam foco sem fazer nada.

          Existe porque as três escolhas do topo têm consequência que só
          aparece dias depois, num lugar diferente da tela. Ver o resultado
          agora é o que separa "escolhi" de "entendi o que escolhi".
        */}
        <div className={css.efeito} aria-hidden>
          <div className={css.aviso}>
            <Info size={16} weight="fill" className={css.glifo} />
            <div>
              <div className={css.titulo}>
                {p.dm === "todos"
                  ? "DM liberada para todo o servidor"
                  : "DM bloqueada por privacidade"}
              </div>
              <div className={css.frase}>
                {p.dm === "todos"
                  ? "Qualquer membro daqui consegue abrir uma conversa com você."
                  : p.dm === "ninguem"
                    ? "Ninguém deste servidor consegue abrir uma conversa nova — só quem já é seu amigo."
                    : "Quem não compartilha nenhum cargo com você não consegue abrir uma conversa."}
              </div>
            </div>
          </div>

          <div className={css.midia}>
            <div className={css.xadrez} />
            {p.filtro === "nao" ? null : (
              <div className={css.veu}>
                <span className={css.rotuloDaMidia}>Conteúdo sensível</span>
                <span className={css.dicaDaMidia}>clique para revelar</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
