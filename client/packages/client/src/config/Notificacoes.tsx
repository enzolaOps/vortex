import {
  Check,
  ICONE,
  MusicNotes,
  UploadSimple,
} from "../components/ui/icones";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Interruptor } from "../components/ui/Interruptor";
import {
  assinarPush,
  desligarPush,
  ligarPush,
  lerPush,
  type EstadoDoPush,
} from "../notificacao/push";
import { definirPresenca } from "../sdk/perfil";
import { assinarMeuStatus, lerMeuStatus } from "../store/meuStatus";
import {
  alternarDia,
  alternarNaMatriz,
  assinarNotificacoes,
  CANAIS_DE_ENTREGA,
  chaveDaMatriz,
  definirNotificacoes,
  EVENTOS_DE_NOTIFICACAO,
  lerNotificacoes,
  type CanalDeEntrega,
} from "../store/notificacoes";
import {
  CabecalhoDeSecao,
  CartaoDeAjustes,
  classes as pg,
  GrupoDeAjustes,
  LinhaDeAjuste,
  PaginaDeAjustes,
} from "./Pagina";
import css from "./Notificacoes.module.css";

/**
 * Cada canal de entrega tem COR e GLIFO próprios.
 *
 * ⚠ É o que faz a matriz de 24 células ser legível: com caixas idênticas,
 * saber em qual coluna se está exige seguir o cabeçalho com o dedo. Acento no
 * toast, verde no som, âmbar no push — as três cores que o app já usa para
 * "ativo", "funcionando" e "atenção".
 */
const CANAL: Record<CanalDeEntrega, { rotulo: string; Glifo: typeof Check }> = {
  toast: { rotulo: "Toast", Glifo: Check },
  som: { rotulo: "Som", Glifo: MusicNotes },
  push: { rotulo: "Push", Glifo: UploadSimple },
};

/** Domingo por último: o calendário começa nele, a semana de trabalho não. */
const DIAS = [
  { n: 1, letra: "S", nome: "segunda" },
  { n: 2, letra: "T", nome: "terça" },
  { n: 3, letra: "Q", nome: "quarta" },
  { n: 4, letra: "Q", nome: "quinta" },
  { n: 5, letra: "S", nome: "sexta" },
  { n: 6, letra: "S", nome: "sábado" },
  { n: 0, letra: "D", nome: "domingo" },
] as const;

/**
 * O que a linha de push diz, por estado. O texto do design é o de "ligado" e
 * "desligado"; os outros dizem por que o interruptor não responde.
 */
const DETALHE_DO_PUSH: Record<EstadoDoPush, string> = {
  desligado: "Enviadas quando você está inativo há mais de 2 minutos",
  ligado: "Enviadas quando você está inativo há mais de 2 minutos",
  ligando: "Inscrevendo este navegador…",
  bloqueado:
    "O navegador bloqueou as notificações — libere nas configurações do site",
  erro: "A instância não aceitou a inscrição. Tente de novo mais tarde",
  indisponivel:
    "Indisponível aqui — abra o Vortex num navegador com suporte a push",
};

/**
 * Notificações.
 *
 * As preferências são lidas por `notificacao/notificador.ts` (toast, som,
 * notificação do sistema e contador) e o push por `notificacao/push.ts`, que
 * inscreve o service worker na instância.
 */
export function Notificacoes() {
  const p = useSyncExternalStore(assinarNotificacoes, lerNotificacoes);
  /*
    ⚠ **O "não perturbe" NÃO é uma preferência desta tela** — ele é a presença
    escolhida no painel de usuário, e a referência o trata assim: aqui só o
    aviso, sem interruptor. Um segundo dono do mesmo estado daria esta tela
    dizendo "ligado" com o pontinho verde no rodapé da coluna.
  */
  const naoPerturbe =
    useSyncExternalStore(assinarMeuStatus, lerMeuStatus).presenca === "dnd";
  const push = useSyncExternalStore(assinarPush, lerPush);

  return (
    <PaginaDeAjustes>
      {/*
        O aviso vem ANTES de tudo: com o não perturbe ligado, cada ajuste
        abaixo é uma escolha sobre algo que não vai acontecer. Dizê-lo depois
        das quatro linhas seria deixar a pessoa configurar no vazio.
      */}
      {naoPerturbe ? (
        <Banner
          tom="perigo"
          titulo="Não perturbe está ativo"
          className={pg.faixa}
          acoes={
            /*
              "Desativar" do design (D-NOTIF-02), e ele NÃO é um segundo
              dono do estado: escreve a mesma presença que o menu do rodapé
              escreve, pelo mesmo `definirPresenca`. O que o comentário acima
              recusa é um INTERRUPTOR aqui — que diria "desligado" com a
              pessoa em Ausente, porque não perturbe não é booleano. Um botão
              que só existe enquanto o DND vale não tem esse problema.

              Volta para `online` e não para "o que era antes": o protocolo
              não guarda a presença anterior, e inventar uma memória local
              para isso daria um terceiro lugar onde ela mora.
            */
            <Botao
              variante="perigoSutil"
              tamanho="pequeno"
              onClick={() => void definirPresenca("online")}
            >
              Desativar
            </Botao>
          }
        >
          Nada notifica — nem chamadas nem menções diretas. As regras abaixo
          voltam a valer quando você desativar.
        </Banner>
      ) : null}

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Notificações no desktop"
          detalhe="Toasts do sistema quando a janela está em segundo plano"
        >
          <Interruptor
            ligado={p.desktop}
            rotulo="Notificações no desktop"
            aoAlternar={(v) => definirNotificacoes({ desktop: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Notificações push no celular"
          detalhe={DETALHE_DO_PUSH[push]}
        >
          {/*
            ⚠ **O interruptor desenha o estado REAL da inscrição**, e não a
            preferência guardada. Aceso com a permissão negada, ele afirmaria
            uma entrega que não acontece — ver `notificacao/push.ts`.
          */}
          <Interruptor
            ligado={push === "ligado" || push === "ligando"}
            rotulo="Notificações push no celular"
            disabled={push === "indisponivel" || push === "bloqueado" || push === "ligando"}
            aoAlternar={(v) => void (v ? ligarPush() : desligarPush())}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Prévia do conteúdo no toast"
          detalhe={
            "Desligue para mostrar só “nova mensagem” em telas compartilhadas"
          }
        >
          <Interruptor
            ligado={p.previa}
            rotulo="Prévia do conteúdo no toast"
            aoAlternar={(v) => definirNotificacoes({ previa: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Badge de não lido no ícone do app"
          detalhe="Contador só de menções, nunca de mensagens comuns"
        >
          <Interruptor
            ligado={p.badge}
            rotulo="Badge de não lido no ícone do app"
            aoAlternar={(v) => definirNotificacoes({ badge: v })}
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Eventos · som e notificação por tipo" />

      {/*
        Grade e não `<table>`: `1.6fr 90px 90px 90px` mantém as três colunas de
        controle na mesma posição em qualquer largura. Com tabela o navegador
        redistribui conforme o conteúdo, e a matriz deixa de ler na vertical —
        que é a única leitura que ela serve.
      */}
      <div className={css.matriz} role="group" aria-label="Eventos por canal">
        <div className={css.matrizCabecalho}>
          <span>Evento</span>
          {CANAIS_DE_ENTREGA.map((c) => (
            <span key={c} className={css.aoCentro}>
              {CANAL[c].rotulo}
            </span>
          ))}
        </div>

        {EVENTOS_DE_NOTIFICACAO.map((e) => (
          <div key={e.id} className={css.matrizLinha}>
            <div className={pg.texto}>
              <div className={css.eventoNome}>{e.rotulo}</div>
              <div className={css.eventoDetalhe}>{e.detalhe}</div>
            </div>

            {CANAIS_DE_ENTREGA.map((c) => {
              const { rotulo, Glifo } = CANAL[c];
              return (
                <div key={c} className={css.celula}>
                  <button
                    type="button"
                    /*
                      `switch` e não `checkbox`: a célula liga e desliga uma
                      entrega, e o leitor de tela anuncia "ativado/desativado"
                      em vez de "marcado", que é o que ela faz.
                    */
                    role="switch"
                    aria-checked={p.matriz.has(chaveDaMatriz(e.id, c))}
                    /* As DUAS coordenadas no nome: sozinho, "Toast" se
                       repetiria oito vezes sem dizer de qual linha é. */
                    aria-label={`${rotulo} · ${e.rotulo}`}
                    data-canal={c}
                    className={css.chave}
                    onClick={() => alternarNaMatriz(e.id, c)}
                  >
                    <Glifo size={ICONE.selo} weight="bold" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <CabecalhoDeSecao titulo="Horário de silêncio" />

      <CartaoDeAjustes>
        <div className={css.cartaoTopo}>
          <div className={pg.texto}>
            <div className={pg.titulo}>Silenciar automaticamente à noite</div>
            <p className={pg.detalhe}>Suprime tudo menos chamadas de amigos</p>
          </div>
          <Interruptor
            ligado={p.silencioNoturno}
            rotulo="Horário de silêncio"
            aoAlternar={(v) => definirNotificacoes({ silencioNoturno: v })}
          />
        </div>

        {/*
          As horas só aparecem com o silêncio ligado, e separadas por uma
          régua: elas são consequência do interruptor acima, e a régua diz isso
          sem uma frase. Campos desabilitados ocupariam a mesma altura dizendo
          "isto existe e não vale".
        */}
        {p.silencioNoturno ? (
          <div className={css.janela}>
            <label>
              <span className={css.rotuloDaHora}>Das</span>
              <input
                type="time"
                className={css.campoDeHora}
                value={p.silencioDas}
                onChange={(ev) =>
                  definirNotificacoes({ silencioDas: ev.target.value })
                }
              />
            </label>

            <label>
              <span className={css.rotuloDaHora}>Até</span>
              <input
                type="time"
                className={css.campoDeHora}
                value={p.silencioAte}
                onChange={(ev) =>
                  definirNotificacoes({ silencioAte: ev.target.value })
                }
              />
            </label>

            <div className={css.dias}>
              <span className={css.rotuloDaHora}>Dias</span>
              <div
                className={css.diasLinha}
                role="group"
                aria-label="Dias da semana"
              >
                {DIAS.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    className={css.dia}
                    aria-pressed={p.silencioDias.includes(d.n)}
                    /* A letra não diz o dia — três das sete são "S" e duas
                       são "Q". O nome inteiro vai no rótulo. */
                    aria-label={d.nome}
                    onClick={() => alternarDia(d.n)}
                  >
                    {d.letra}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </CartaoDeAjustes>

      <CabecalhoDeSecao titulo="Permissão do sistema" />

      <PermissaoDoSistema />

      <p className={pg.recado}>
        Ordem de resolução: não perturbe → horário de silêncio → servidor
        silenciado → canal silenciado → padrão do servidor → exceção do canal.
        Só o toast de chamada ignora tudo menos não perturbe.
      </p>
    </PaginaDeAjustes>
  );
}

type Permissao = NotificationPermission | "indisponivel";

function lerPermissao(): Permissao {
  return typeof Notification === "undefined" ? "indisponivel" : Notification.permission;
}

/**
 * A permissão de notificação do navegador ou do sistema, de verdade.
 *
 * ⚠ **Só aparece quando há algo a fazer.** Com a permissão concedida (o
 * normal no app de desktop) um aviso de "bloqueado" seria mentira. `default`
 * pede; `denied` não pode ser pedido de novo por página nenhuma — o navegador
 * só o desfaz nas configurações do site, e o texto diz isso em vez de oferecer
 * um botão que não faria nada.
 *
 * ⚠ **Divergência deliberada do "Abrir ajustes" do design (D-NOTIF-10).** No
 * navegador nenhuma página abre as configurações do site — `chrome://` e
 * `about:` são recusados por `window.open`. Na casca o botão PODERIA abrir os
 * ajustes do sistema, mas o estado que o justifica não chega: o Electron
 * reporta `granted` mesmo com o Windows ou o macOS calando o app, então o
 * aviso de bloqueio nunca apareceria lá. Um botão alcançável só onde não
 * funciona e funcional só onde é inalcançável é o pior dos dois.
 */
function PermissaoDoSistema() {
  const [permissao, setPermissao] = useState<Permissao>(lerPermissao);

  /* Liberar nas configurações do navegador e voltar à aba: relê no foco. */
  useEffect(() => {
    const reler = () => setPermissao(lerPermissao());
    window.addEventListener("focus", reler);
    return () => window.removeEventListener("focus", reler);
  }, []);

  if (permissao === "granted") {
    return (
      <p className={pg.recado}>
        Notificações do sistema liberadas para o Vortex.
      </p>
    );
  }

  if (permissao === "indisponivel") {
    return (
      <p className={pg.recado}>
        Este navegador não oferece notificações do sistema; toasts e sons dentro
        do app continuam funcionando.
      </p>
    );
  }

  return (
    <Banner
      tom="aviso"
      titulo={
        permissao === "denied"
          ? "O navegador está bloqueando notificações do Vortex"
          : "O Vortex ainda não pode mostrar notificações do sistema"
      }
      className={pg.faixa}
      acoes={
        permissao === "default" ? (
          <Botao
            variante="avisoSutil"
            tamanho="pequeno"
            onClick={() => {
              void Notification.requestPermission().then(setPermissao);
            }}
          >
            Permitir notificações
          </Botao>
        ) : undefined
      }
    >
      {permissao === "denied"
        ? "Libere nas configurações do site (o cadeado ao lado do endereço) e volte para esta aba."
        : "Sem a permissão, menções e mensagens diretas só avisam com o app aberto na tela."}
    </Banner>
  );
}
