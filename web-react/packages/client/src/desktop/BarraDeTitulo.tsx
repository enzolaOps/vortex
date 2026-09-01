import { Minus, Square, X } from "../components/ui/icones";
import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "../lib/cn";
import { ponte } from "../sdk/desktop";
import { assinarDesktop, lerDesktop } from "../store/desktop";
import { assinarNavegacao, lerLocal } from "../store/navegacao";
import { useChannel, useServer } from "../store/hooks";
import css from "./BarraDeTitulo.module.css";

/**
 * A barra de título custom — 34px, do design.
 *
 * ⚠ **Todo interativo dentro da região de arraste precisa de `no-drag`
 * explícito**, e é a armadilha que o briefing nomeia: sem ele o botão para de
 * responder sem erro nenhum, porque o sistema operacional captura o
 * `pointerdown` para mover a janela. Aqui a faixa central é a única
 * arrastável, e os três controles saem dela por CSS.
 *
 * ⚠ **34px nos DOIS sistemas; só a ORDEM muda.** É o que o design escreve, e a
 * razão é boa: a altura entra na conta do grid do shell, e uma barra que muda
 * de altura por plataforma faria a lista virtualizada ter dois tetos
 * diferentes — o tipo de divergência que "casca fina, não segunda aplicação"
 * existe para impedir. No macOS os controles são do sistema e ficam no
 * início; no Windows são nossos e ficam no fim.
 *
 * ⚠ **Não renderiza no navegador.** `naDesktop()` é a única condicional de
 * plataforma do app, e ela mora aqui — não em `MessageRow.desktop.tsx`.
 */
export function BarraDeTitulo() {
  const { naCasca, barraNativa } = useSyncExternalStore(
    assinarDesktop,
    lerDesktop,
  );
  const [janela, setJanela] = useState({ maximizada: false, comFoco: true });

  /*
    O foco da janela vem da casca e não de `document.hasFocus()`: aquele é do
    DOCUMENTO, e uma janela sem foco com um DevTools aberto por cima ainda
    responde `true`. Quem sabe é o main.
  */
  useEffect(() => ponte()?.assinarJanela(setJanela), []);

  /*
    ⚠ **A altura vira token no `<html>`, e é o que mantém as telas cheias
    abaixo dela.** `position: fixed; inset: 0` cobriria a barra — e no Electron
    isso é uma janela que não pode ser arrastada nem fechada enquanto as
    configurações estiverem abertas. Medido no arnês: os três controles ficavam
    inalcançáveis, sem erro nenhum.

    Um token e não um `padding-top` no `#root`: as superfícies em questão são
    `fixed`, então padding do ancestral não as move.
  */
  /* ⚠ `naCasca` do SNAPSHOT e não `naDesktop()`: aquele é global mutável sem
     subscrição, e o componente nunca voltava a rodar. Ver `store/desktop.ts`. */
  const visivel = naCasca && !barraNativa;
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty("--vx-barra-h", visivel ? "34px" : "0px");
    return () => {
      raiz.style.removeProperty("--vx-barra-h");
    };
  }, [visivel]);

  /*
    Barra NATIVA escolhida: não desenhamos nada. O `frame: true` do main é
    quem faz o trabalho, e uma barra nossa por baixo daria duas.
  */
  if (!visivel) return null;

  const p = ponte();
  const noMac = p?.plataforma === "darwin";

  const controles = (
    <div className={css.controles}>
      <button
        type="button"
        className={css.controle}
        aria-label="Minimizar"
        onClick={() => void p?.janela("minimizar")}
      >
        <Minus size={14} aria-hidden />
      </button>
      <button
        type="button"
        className={css.controle}
        aria-label={janela.maximizada ? "Restaurar" : "Maximizar"}
        onClick={() => void p?.janela(janela.maximizada ? "restaurar" : "maximizar")}
      >
        <Square size={12} aria-hidden />
      </button>
      <button
        type="button"
        className={cn(css.controle, css.fechar)}
        aria-label="Fechar"
        onClick={() => void p?.janela("fechar")}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );

  return (
    <header className={css.barra} data-sem-foco={!janela.comFoco || undefined}>
      {/*
        ⚠ No macOS os três semáforos são do SISTEMA e ocupam a esquerda — o que
        reservamos é o ESPAÇO deles, com `trafficLightPosition` do lado do
        main. Desenhar os nossos ali daria seis botões.
      */}
      {noMac ? <div className={css.semaforos} aria-hidden /> : null}

      {/* A faixa central é a região de arraste. Nada interativo aqui dentro
          além do que carregue `no-drag`. */}
      <div className={css.arraste}>
        <Titulo />
      </div>

      {noMac ? null : controles}
    </header>
  );
}

/**
 * O título — "# produto — Vortex Core".
 *
 * ⚠ Assina a navegação e o canal, e NÃO recebe por prop: a barra é montada uma
 * vez na raiz, fora da árvore do shell. Passar o canal por prop obrigaria o
 * `Cliente` a conhecê-la, e aí a casca começaria a ditar a forma do produto.
 */
function Titulo() {
  const local = useSyncExternalStore(assinarNavegacao, lerLocal);
  const canalId = local.tipo === "servidor" ? (local.channelId ?? "") : "";
  const canal = useChannel(canalId);
  const servidor = useServer(local.tipo === "servidor" ? local.serverId : "");

  if (!canal) return <span className={css.titulo}>Vortex</span>;

  return (
    <span className={css.titulo}>
      <span className={css.canal}>#&nbsp;{canal.name}</span>
      {servidor ? (
        <>
          <span className={css.travessao} aria-hidden>
            —
          </span>
          {servidor.name}
        </>
      ) : null}
    </span>
  );
}
