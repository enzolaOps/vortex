import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Escolha } from "../components/ui/Escolha";
import { Interruptor } from "../components/ui/Interruptor";
import { Segmentado } from "../components/ui/Segmentado";
import { Selo } from "../components/ui/Selo";
import { Combinacao } from "../components/ui/Tecla";
import { toast } from "../components/ui/toastStore";
import {
  AO_FECHAR,
  CANTOS,
  ponte,
  versaoInstalada,
  type AoFechar,
  type Canto,
} from "../sdk/desktop";
import { assinarDesktop, definirDesktop, lerDesktop } from "../store/desktop";
import {
  CabecalhoDeSecao,
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

const ROTULO_DO_CANTO: Record<Canto, string> = {
  "cima-inicio": "Cima · início",
  "cima-fim": "Cima · fim",
  "baixo-inicio": "Baixo · início",
  "baixo-fim": "Baixo · fim",
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

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Ativar overlay"
          detalhe="Chat e voz dentro de jogos em tela cheia"
        >
          <Interruptor
            ligado={d.overlay}
            rotulo="Ativar overlay"
            aoAlternar={(v) => definirDesktop({ overlay: v })}
          />
        </LinhaDeAjuste>

        {d.overlay ? (
          <>
            <LinhaDeAjuste titulo="Atalho para abrir">
              <Combinacao teclas={["shift", "`"]} />
            </LinhaDeAjuste>

            <LinhaDeAjuste titulo="Posição padrão">
              <Segmentado
                rotulo="Posição do overlay"
                valor={d.cantoDoOverlay}
                opcoes={CANTOS.map((c) => ({
                  id: c,
                  rotulo: ROTULO_DO_CANTO[c],
                }))}
                aoEscolher={(cantoDoOverlay) =>
                  definirDesktop({ cantoDoOverlay })
                }
              />
            </LinhaDeAjuste>
          </>
        ) : null}
      </GrupoDeAjustes>

      <p className={css.avisoDoOverlay}>
        Jogos com anti-cheat podem bloquear o overlay. Nesse caso o app avisa
        uma vez por jogo e não tenta de novo.
      </p>

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
