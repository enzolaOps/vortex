import {
  useId,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { comum, config } from "../../textos";
import { Botao } from "../../ui/ds";
import { SetaParaBaixo } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import {
  ConteudoDoMenu,
  GatilhoDoMenu,
  GrupoDeEscolha,
  ItemDeEscolha,
  MenuSuspenso,
  RotuloDeMenu,
  SeparadorDeMenu,
} from "../../ui/primitivos/Menus";
import css from "./controles.module.css";

/** Uma página de configuração: coluna de blocos na medida de leitura. */
export function Pagina({ children }: { children: ReactNode }) {
  return <div className={css.pagina}>{children}</div>;
}

export function Bloco({ children }: { children: ReactNode }) {
  return <section className={css.bloco}>{children}</section>;
}

export function Divisor() {
  return <hr className={css.divisor} />;
}

export const estilosDeConfig = css;

/* ------------------------------------------------------------- opções */

export interface GrupoDeOpcoesProps {
  rotulo: string;
  children: ReactNode;
  emColuna?: boolean;
}

/**
 * Escolha de UMA opção (rádio). Setas movem o foco e escolhem, como o
 * `radiogroup` do navegador; sem isso o grupo só seria alcançável por Tab em
 * cada botão.
 */
export function GrupoDeOpcoes({ rotulo, children, emColuna = false }: GrupoDeOpcoesProps) {
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const avanca = e.key === "ArrowRight" || e.key === "ArrowDown";
    const recua = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!avanca && !recua) return;
    const opcoes = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'),
    );
    const atual = opcoes.findIndex((o) => o === document.activeElement);
    if (atual < 0) return;
    e.preventDefault();
    const proxima = opcoes[(atual + (avanca ? 1 : -1) + opcoes.length) % opcoes.length];
    proxima?.focus();
    proxima?.click();
  };
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className={juntar(css.opcoes, emColuna && css.opcoesEmColuna)}
      onKeyDown={aoTeclar}
    >
      {children}
    </div>
  );
}

export interface OpcaoProps {
  marcada: boolean;
  aoEscolher: () => void;
  children: ReactNode;
  descricao?: string;
  disabled?: boolean;
  /** Rótulo acessível quando o conteúdo é só um desenho. */
  "aria-label"?: string;
}

export function Opcao({ marcada, aoEscolher, children, descricao, disabled, ...resto }: OpcaoProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      aria-label={resto["aria-label"]}
      tabIndex={marcada ? 0 : -1}
      disabled={disabled}
      className={css.opcao}
      onClick={aoEscolher}
    >
      <span className={css.opcaoTextos}>
        <span>{children}</span>
        {descricao !== undefined && <span className={css.opcaoDescricao}>{descricao}</span>}
      </span>
    </button>
  );
}

/* --------------------------------------------------------- interruptor */

export interface InterruptorProps {
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
  rotulo: string;
  disabled?: boolean;
}

export function Interruptor({ ligado, aoMudar, rotulo, disabled }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      className={css.interruptor}
      onClick={() => {
        aoMudar(!ligado);
      }}
    />
  );
}

export interface LinhaDeAjusteProps {
  nome: string;
  descricao?: string;
  children: ReactNode;
}

export function LinhaDeAjuste({ nome, descricao, children }: LinhaDeAjusteProps) {
  return (
    <div className={css.linhaDeAjuste}>
      <div className={css.linhaDeAjusteTextos}>
        <span className={css.linhaDeAjusteNome}>{nome}</span>
        {descricao !== undefined && <span className={css.dica}>{descricao}</span>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ seletor */

export interface SeletorProps {
  rotulo: string;
  valor: string;
  opcoes: readonly { readonly valor: string; readonly rotulo: string }[];
  aoMudar: (valor: string) => void;
  disabled?: boolean;
  /** Aviso no fim da lista quando não há o que escolher além do padrão ("Nenhum microfone encontrado"). */
  semOpcoes?: string;
}

/**
 * Lista de escolha única no menu do app: o fechado parece campo, o aberto é o
 * mesmo menu das outras telas, com a opção atual marcada. A lista nativa saía
 * do tema (seta e cores do sistema) e não dá para estilizá-la por dentro.
 */
export function Seletor({ rotulo, valor, opcoes, aoMudar, disabled, semOpcoes }: SeletorProps) {
  const id = useId();
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0];
  return (
    <div className={css.campoComRotulo}>
      <span id={id} className={css.rotulo}>
        {rotulo}
      </span>
      <MenuSuspenso>
        <GatilhoDoMenu asChild>
          <button type="button" className={css.seletor} disabled={disabled} aria-labelledby={id}>
            <span className={css.seletorValor}>{atual?.rotulo ?? ""}</span>
            <SetaParaBaixo aria-hidden />
          </button>
        </GatilhoDoMenu>
        <ConteudoDoMenu align="start" className={css.seletorMenu}>
          <GrupoDeEscolha value={atual?.valor ?? ""} onValueChange={aoMudar} aria-label={rotulo}>
            {opcoes.map((o) => (
              <ItemDeEscolha key={o.valor} value={o.valor}>
                {o.rotulo}
              </ItemDeEscolha>
            ))}
          </GrupoDeEscolha>
          {semOpcoes !== undefined && (
            <>
              <SeparadorDeMenu />
              <RotuloDeMenu>{semOpcoes}</RotuloDeMenu>
            </>
          )}
        </ConteudoDoMenu>
      </MenuSuspenso>
    </div>
  );
}

/* ------------------------------------------------- carregando e falha */

/** O esqueleto de uma página que ainda não tem dados: dois blocos de campo. */
export function PaginaCarregando({ rotulo = config.carregando }: { rotulo?: string }) {
  return (
    <Pagina>
      <div className={css.esqueleto} role="status" aria-label={rotulo}>
        <span className={css.esqueletoTitulo} />
        <span className={css.esqueletoCampo} />
        <span className={css.esqueletoCampo} />
        <span className={css.esqueletoTitulo} />
        <span className={css.esqueletoCampo} />
      </div>
    </Pagina>
  );
}

/** A página que não conseguiu os dados: diz o erro e deixa tentar de novo. */
export function PaginaComFalha({ aoTentarDeNovo }: { aoTentarDeNovo: () => void }) {
  return (
    <Pagina>
      <p className={css.erro} role="alert">
        {config.naoDeuParaCarregar}
      </p>
      <div className={css.acoes}>
        <Botao variante="secundario" onClick={aoTentarDeNovo}>
          {comum.tentarDeNovo}
        </Botao>
      </div>
    </Pagina>
  );
}

/* --------------------------------------------------------- deslizante */

export interface DeslizanteProps {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  /** O texto ao lado do rótulo ("85%", "−42 dB"). */
  texto: string;
  aoMudar: (valor: number) => void;
  disabled?: boolean;
}

export function Deslizante({ rotulo, valor, min, max, passo = 1, texto, aoMudar, disabled }: DeslizanteProps) {
  const id = useId();
  return (
    <div className={css.campoComRotulo}>
      <div className={css.linhaDoValor}>
        <label htmlFor={id} className={css.rotulo}>
          {rotulo}
        </label>
        <span className={css.valor}>{texto}</span>
      </div>
      <input
        id={id}
        type="range"
        className={css.deslizante}
        min={min}
        max={max}
        step={passo}
        value={valor}
        disabled={disabled}
        aria-valuetext={texto}
        onChange={(e) => {
          aoMudar(Number(e.target.value));
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------- área de texto */

export interface AreaDeTextoProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className" | "children"> {
  rotulo: string;
  /** Mostra "12 de 190" ao lado do rótulo. */
  contador?: { usados: number; maximo: number };
}

export function AreaDeTexto({ rotulo, contador, ...resto }: AreaDeTextoProps) {
  const id = useId();
  return (
    <div className={css.campoComRotulo}>
      <div className={css.cabecalhoDoCampo}>
        <label htmlFor={id} className={css.rotulo}>
          {rotulo}
        </label>
        {contador && (
          <span className={css.contador}>{config.perfilTela.contador(contador.usados, contador.maximo)}</span>
        )}
      </div>
      <textarea {...resto} id={id} className={css.areaDeTexto} />
    </div>
  );
}

/* ------------------------------------------------------ barra de salvar */

export interface BarraDeSalvarProps {
  salvando: boolean;
  aoDescartar: () => void;
  aoSalvar: () => void;
}

/** "Você tem alterações não salvas": só existe enquanto houver alteração. */
export function BarraDeSalvar({ salvando, aoDescartar, aoSalvar }: BarraDeSalvarProps) {
  return (
    <div className={css.barraDeSalvar} role="region" aria-label={config.barraDeSalvar.recado}>
      <span>{config.barraDeSalvar.recado}</span>
      <div className={css.acoes}>
        <Botao variante="fantasma" tamanho="sm" disabled={salvando} onClick={aoDescartar}>
          {config.descartarAlteracoes}
        </Botao>
        <Botao tamanho="sm" carregando={salvando} onClick={aoSalvar}>
          {salvando ? config.salvando : config.salvar}
        </Botao>
      </div>
    </div>
  );
}
