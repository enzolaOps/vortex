import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Escolha } from "../components/ui/Escolha";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { toast } from "../components/ui/toastStore";
import {
  AO_FECHAR,
  ponte,
  versaoInstalada,
  type AoFechar,
} from "../sdk/desktop";
import { POSICOES, textoDoAtalho, type Posicao } from "../overlay/modelo";
import {
  acoesEmConflito,
  assinarAtalhosDeVoz,
  lerAtalhosDeVoz,
  teclasDaCombinacao,
} from "../store/atalhosDeVoz";
import { assinarOverlay, definirOverlay, lerOverlay } from "../store/overlay";
import { assinarDesktop, definirDesktop, lerDesktop } from "../store/desktop";
import {
  CabecalhoDeSecao,
  CartaoDeAjustes,
  classes as pg,
  GrupoDeAjustes,
  LinhaDeAjuste,
  PaginaDeAjustes,
} from "./Pagina";
import css from "./Desktop.module.css";

const ROTULO_AO_FECHAR: Record<AoFechar, string> = {
  bandeja: "Minimizar para a bandeja",
  encerrar: "Encerrar o app",
  perguntar: "Perguntar sempre",
};


/** 1,8 GB vira "1,8 GB" — base 1000, como o rodapé do anexo já faz. */
function tamanho(bytes: number): string {
  const un = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < un.length - 1) {
    v /= 1000;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${un[i] ?? "B"}`;
}

/**
 * Desktop — as opções que só existem no app instalado.
 *
 * ⚠ **A seção só aparece na CASCA**, e é `store/config.ts` quem decide: uma
 * página de opções que não controlam nada é o defeito que o registro de
 * pendências existe para evitar, e aqui ele seria a página inteira. No
 * navegador o item nem entra no menu.
 *
 * ⚠ **A fonte da verdade é o processo MAIN.** Estas preferências governam
 * coisas que acontecem antes de a janela existir — abrir com o sistema,
 * aceleração de hardware —, e o store daqui é o espelho. Ver
 * `store/desktop.ts`.
 */
export function Desktop() {
  const d = useSyncExternalStore(assinarDesktop, lerDesktop);
  const { versao, electron } = versaoInstalada();
  const [cache, setCache] = useState<number | undefined>(undefined);

  /*
    O tamanho do cache é PERGUNTADO, não assinado: ele muda quando alguém rola
    um canal com imagens, e um store que o seguisse acordaria esta tela a cada
    anexo baixado. Uma leitura por abertura responde a pergunta que a pessoa
    veio fazer.
  */
  useEffect(() => {
    let vivo = true;
    void ponte()
      ?.tamanhoDoCache()
      .then((n) => {
        if (vivo) setCache(n);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <PaginaDeAjustes>
      <CabecalhoDeSecao titulo="Inicialização e janela" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Iniciar com o sistema"
          detalhe="Abre minimizado no login"
        >
          <Interruptor
            ligado={d.iniciarComSistema}
            rotulo="Iniciar com o sistema"
            aoAlternar={(v) => definirDesktop({ iniciarComSistema: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Minimizar para a bandeja ao fechar"
          detalhe="Fechar a janela não encerra o app"
        >
          <Interruptor
            ligado={d.minimizarParaBandeja}
            rotulo="Minimizar para a bandeja ao fechar"
            aoAlternar={(v) => definirDesktop({ minimizarParaBandeja: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Lembrar tamanho e posição por monitor"
          detalhe="Restaura o layout em ultrawide"
        >
          <Interruptor
            ligado={d.lembrarJanela}
            rotulo="Lembrar tamanho e posição por monitor"
            aoAlternar={(v) => definirDesktop({ lembrarJanela: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Sempre no topo em chamada"
          detalhe="Só quando a janela está em picture-in-picture"
        >
          <Interruptor
            ligado={d.sempreNoTopoEmChamada}
            rotulo="Sempre no topo em chamada"
            aoAlternar={(v) => definirDesktop({ sempreNoTopoEmChamada: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Barra de título do sistema"
          detalhe="Troca a barra custom pela nativa"
        >
          <Interruptor
            ligado={d.barraNativa}
            rotulo="Barra de título do sistema"
            aoAlternar={(v) => definirDesktop({ barraNativa: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Ao fechar a janela"
          detalhe="O app segue rodando na bandeja"
        >
          <Escolha
            rotulo="Ao fechar a janela"
            rotuloOculto
            className={css.seletor}
            valor={ROTULO_AO_FECHAR[d.aoFechar]}
            opcoes={AO_FECHAR.map((a) => ROTULO_AO_FECHAR[a])}
            aoEscolher={(v) => {
              const id = AO_FECHAR.find((a) => ROTULO_AO_FECHAR[a] === v);
              if (id) definirDesktop({ aoFechar: id });
            }}
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Desempenho" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Aceleração de hardware"
          detalhe="Usa a GPU para renderizar a interface"
        >
          {/*
            ⚠ **O selo "reinício" não é enfeite.** O Electron escolhe o backend
            de render ANTES de a primeira janela existir; trocar isto em runtime
            não faz nada. Um interruptor que parece funcionar e não funciona é
            pior que um desabilitado — o selo é o que impede a pessoa de achar
            que já valeu.
          */}
          <div className={css.comSelo}>
            <Selo forma="etiqueta" tom="aviso">
              Reinício
            </Selo>
            <Interruptor
              ligado={d.aceleracaoDeHardware}
              rotulo="Aceleração de hardware"
              aoAlternar={(v) => definirDesktop({ aceleracaoDeHardware: v })}
            />
          </div>
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Reduzir uso em segundo plano"
          detalhe="Pausa animações e prévias com a janela oculta"
        >
          <Interruptor
            ligado={d.reduzirEmSegundoPlano}
            rotulo="Reduzir uso em segundo plano"
            aoAlternar={(v) => definirDesktop({ reduzirEmSegundoPlano: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Pré-carregar anexos"
          detalhe="Baixa imagens antes de você abrir o canal"
        >
          <Interruptor
            ligado={d.preCarregarAnexos}
            rotulo="Pré-carregar anexos"
            aoAlternar={(v) => definirDesktop({ preCarregarAnexos: v })}
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Overlay no jogo" />

      <SecaoDoOverlay />

      <CabecalhoDeSecao titulo="Manutenção" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Cache local"
          /*
            ⚠ Enquanto não chegou, o detalhe diz "medindo" e não um número
            zerado: "0 B de imagens" é uma afirmação, e ela seria falsa em toda
            abertura. A mesma disciplina do medidor de entrada em Voz e vídeo.
          */
          detalhe={
            cache === undefined
              ? "medindo…"
              : `${tamanho(cache)} de imagens e anexos`
          }
        >
          <Botao
            tamanho="pequeno"
            disabled={cache === undefined}
            onClick={() => {
              void ponte()
                ?.limparCache()
                .then(() => {
                  setCache(0);
                  toast({ tipo: "info", titulo: "Cache limpo." });
                });
            }}
          >
            Limpar cache
          </Botao>
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Logs do aplicativo"
          detalhe="Para anexar em um relato de problema"
        >
          <Botao
            tamanho="pequeno"
            onClick={() => void ponte()?.abrirPastaDeLogs()}
          >
            Abrir pasta
          </Botao>
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Versão instalada"
          /* Electron só aparece quando a casca o informa — no navegador o
             campo some em vez de inventar um número. */
          detalhe={
            electron === undefined
              ? `${versao} · canal estável`
              : `${versao} · canal estável · Electron ${electron}`
          }
        >
          <Botao
            tamanho="pequeno"
            onClick={() => void ponte()?.verificarAtualizacao()}
          >
            Verificar
          </Botao>
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <p className={pg.recado}>
        Estas opções governam o processo do aplicativo, não a aba: elas são
        lidas antes de a janela existir, e é por isso que a aceleração de
        hardware só vale no próximo início.
      </p>
    </PaginaDeAjustes>
  );
}

const NOME_DA_POSICAO: Record<Posicao, string> = {
  0: "Cima · início",
  1: "Cima · centro",
  2: "Cima · fim",
  3: "Meio · início",
  4: "Centro",
  5: "Meio · fim",
  6: "Baixo · início",
  7: "Baixo · centro",
  8: "Baixo · fim",
};

/**
 * "Overlay no jogo", 1:1 com o design: um cartão com o interruptor, e — com
 * ele ligado — o atalho e a grade 3×3 da posição padrão.
 *
 * ⚠ **O atalho mostrado é o GRAVADO**, da tabela de Voz e vídeo, e não a
 * combinação fixa escrita no design. Mostrar uma combinação fixa mentiria no
 * dia em que alguém a trocasse.
 */
function SecaoDoOverlay() {
  const config = useSyncExternalStore(assinarOverlay, lerOverlay);
  const atalhos = useSyncExternalStore(assinarAtalhosDeVoz, lerAtalhosDeVoz);
  const combinacao = atalhos.overlay;
  const conflito = acoesEmConflito(atalhos).has("overlay");

  return (
    <CartaoDeAjustes className={css.cartaoDoOverlay}>
      <div className={css.overlayTopo}>
        <div>
          <div className={css.overlayTitulo}>Ativar overlay</div>
          <div className={css.overlayDetalhe}>
            Chat e voz dentro de jogos em tela cheia
          </div>
        </div>
        <Interruptor
          ligado={config.ativo}
          rotulo="Ativar overlay"
          aoAlternar={(ativo) => definirOverlay({ ativo })}
        />
      </div>

      {config.ativo ? (
        <div className={css.overlayCorpo}>
          <div className={css.overlayAtalho}>
            <span>Atalho para abrir</span>
            {combinacao && !conflito ? (
              <span className={css.overlayTecla}>
                {textoDoAtalho(
                  teclasDaCombinacao(combinacao),
                  typeof navigator !== "undefined" && /mac/i.test(navigator.platform),
                )}
              </span>
            ) : (
              <span className={css.overlaySemAtalho}>
                {conflito ? "em conflito — ajuste em Voz e vídeo" : "sem atalho"}
              </span>
            )}
          </div>

          <div className={css.overlaySobrancelha}>Posição padrão</div>
          <div
            role="radiogroup"
            aria-label="Posição do overlay"
            className={css.overlayGrade}
          >
            {POSICOES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={config.posicao === p}
                aria-label={NOME_DA_POSICAO[p]}
                className={css.overlayCelula}
                onClick={() => definirOverlay({ posicao: p })}
              />
            ))}
          </div>

          {/*
            ⚠ O design diz que "o app avisa uma vez por jogo" quando o
            anti-cheat bloqueia. O overlay daqui não injeta nada no jogo — é
            uma janela por cima —, então anti-cheat não o bloqueia; o que o
            impede é tela cheia EXCLUSIVA. O texto diz o limite real.
          */}
          <p className={css.overlayNota}>
            Funciona em jogos em janela ou em tela cheia sem bordas. Em tela
            cheia exclusiva o jogo desenha por cima de qualquer janela, e o
            overlay não aparece.
          </p>
        </div>
      ) : null}
    </CartaoDeAjustes>
  );
}
