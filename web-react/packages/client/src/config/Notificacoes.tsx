import { Check, MusicNotes, UploadSimple } from "@phosphor-icons/react";
import { useSyncExternalStore, type ReactNode } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Interruptor } from "../components/ui/Interruptor";
import { aindaNao } from "../pendente/pendencias";
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
 * Sobrancelha com régua até a ponta da linha.
 *
 * Ela amarra o título ao que vem ABAIXO, enquanto um `<hr>` separaria do que
 * veio acima — é a mesma informação com o vínculo invertido.
 */
function CabecalhoDeSecao({ titulo }: { titulo: string }) {
  return (
    <div className={css.cabecalhoDeSecao}>
      <h2 className={css.tituloDeSecao}>{titulo}</h2>
      <span aria-hidden className={css.reguaDaSecao} />
    </div>
  );
}

function Linha({
  titulo,
  detalhe,
  controle,
}: {
  titulo: string;
  detalhe: string;
  controle: ReactNode;
}) {
  return (
    <div className={css.linha}>
      <div className={css.texto}>
        <div className={css.tituloDaLinha}>{titulo}</div>
        <p className={css.detalhe}>{detalhe}</p>
      </div>
      <div className={css.controle}>{controle}</div>
    </div>
  );
}

/**
 * Notificações.
 *
 * ⚠ **As preferências são REAIS e ficam guardadas; o que falta é quem as
 * CONSOME.** Som precisa de áudio, push de service worker, badge de casca
 * Electron — nenhum dos três existe hoje. Construir a tela mesmo assim é a
 * regra deste projeto, e a forma não muda quando o notificador chegar, porque
 * ele lê deste store.
 *
 * O único PENDENTE de verdade é pedir permissão ao sistema: é chamada ao
 * navegador que só faz sentido com o notificador atrás, e não teria o que
 * guardar.
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

  return (
    <div className={css.pagina}>
      {/*
        O aviso vem ANTES de tudo: com o não perturbe ligado, cada ajuste
        abaixo é uma escolha sobre algo que não vai acontecer. Dizê-lo depois
        das quatro linhas seria deixar a pessoa configurar no vazio.
      */}
      {naoPerturbe ? (
        <Banner
          tom="perigo"
          titulo="Não perturbe está ligado"
          className={css.faixa}
        >
          Nada notifica enquanto ele estiver ativo — nem as chamadas. Troque a
          presença no rodapé da coluna para voltar a receber.
        </Banner>
      ) : null}

      <div className={css.grupo}>
        <Linha
          titulo="Notificações no desktop"
          detalhe="Toasts do sistema quando a janela está em segundo plano"
          controle={
            <Interruptor
              ligado={p.desktop}
              rotulo="Notificações no desktop"
              aoAlternar={(v) => definirNotificacoes({ desktop: v })}
            />
          }
        />
        <Linha
          titulo="Notificações push no celular"
          detalhe="Enviadas quando você está inativo há mais de 2 minutos"
          controle={
            <Interruptor
              ligado={p.push}
              rotulo="Notificações push no celular"
              aoAlternar={(v) => definirNotificacoes({ push: v })}
            />
          }
        />
        <Linha
          titulo="Prévia do conteúdo no toast"
          detalhe={
            "Desligue para mostrar só “nova mensagem” em telas compartilhadas"
          }
          controle={
            <Interruptor
              ligado={p.previa}
              rotulo="Prévia do conteúdo no toast"
              aoAlternar={(v) => definirNotificacoes({ previa: v })}
            />
          }
        />
        <Linha
          titulo="Badge de não lido no ícone do app"
          detalhe="Contador só de menções, nunca de mensagens comuns"
          controle={
            <Interruptor
              ligado={p.badge}
              rotulo="Badge de não lido no ícone do app"
              aoAlternar={(v) => definirNotificacoes({ badge: v })}
            />
          }
        />
      </div>

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
            <div className={css.texto}>
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
                    <Glifo size={12} weight="bold" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <CabecalhoDeSecao titulo="Horário de silêncio" />

      <div className={css.cartao}>
        <div className={css.cartaoTopo}>
          <div className={css.texto}>
            <div className={css.tituloDaLinha}>
              Silenciar automaticamente à noite
            </div>
            <p className={css.detalhe}>Suprime tudo menos chamadas de amigos</p>
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
      </div>

      <CabecalhoDeSecao titulo="Permissão do sistema" />

      {/*
        ⚠ A ação é IRMÃ do texto, não filha — o `Banner` ganhou o slot `acoes`
        por causa desta tela, e a comparação com a referência foi o que pegou:
        eu a tinha empilhado embaixo da frase. Ela é também o primeiro
        consumidor do `avisoSutil`, registrado como variante sem uso no passe
        de primitivos.
      */}
      <Banner
        tom="aviso"
        titulo="O sistema está bloqueando notificações do Vortex"
        className={css.faixa}
        acoes={
          <Botao
            variante="avisoSutil"
            tamanho="pequeno"
            onClick={aindaNao("permissaoDeNotificacao")}
          >
            Abrir ajustes
          </Botao>
        }
      >
        Suas escolhas aqui não têm efeito até liberar nas preferências do
        sistema.
      </Banner>

      <p className={css.recado}>
        Ordem de resolução: não perturbe → horário de silêncio → servidor
        silenciado → canal silenciado → padrão do servidor → exceção do canal.
        Só o toast de chamada ignora tudo menos não perturbe.
      </p>
    </div>
  );
}
