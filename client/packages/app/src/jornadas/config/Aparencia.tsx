import { useId, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { config } from "../../textos";
import {
  assinarPersonalizacao,
  escolherTema,
  lerPersonalizacao,
  papeisDe,
  papeisDoTema,
  baseDoTema,
  personalizar,
} from "../../tema/personalizado";
import {
  corDoDestaque,
  corDoDestaqueEscolhido,
  DESTAQUES,
  normalizarHex,
  paletaValidada,
  TEMAS,
  type TemaId,
} from "../../tema/personalizar";
import { Botao } from "../../ui/ds";
import { SetaParaDireita } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import css from "./Aparencia.module.css";
import { Bloco, Deslizante, estilosDeConfig as ec, Pagina } from "./controles";
import { estiloDosPapeis, PreviaDoApp } from "./PreviaDoApp";

const t = config.aparenciaTela;

/**
 * Aparência (PRD 4.6): temas prontos e uma personalização por cima deles.
 *
 * Todo tema pronto é uma semente do mesmo derivador da paleta personalizada: a
 * pessoa escolhe matiz, intensidade e destaque, e a luminosidade de cada papel
 * é do app, medida contra os pares de contraste do tema de fábrica antes de
 * valer (`tema/personalizar.ts`). Por enquanto só existe o tema escuro.
 */
export function Aparencia() {
  const p = useSyncExternalStore(assinarPersonalizacao, lerPersonalizacao);
  const [emFoco, setEmFoco] = useState<TemaId | undefined>(undefined);

  const nomeAtual = p.personalizado ? t.previaPersonalizada : t.temas[p.tema];
  const papeisDaPrevia = emFoco !== undefined ? papeisDoTema(emFoco) : papeisDe(p);
  const nomeDaPrevia = emFoco !== undefined ? t.temas[emFoco] : nomeAtual;

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const avanca = e.key === "ArrowRight" || e.key === "ArrowDown";
    const recua = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!avanca && !recua) return;
    const cartoes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const atual = cartoes.findIndex((c) => c === document.activeElement);
    if (atual < 0) return;
    e.preventDefault();
    const proximo = cartoes[(atual + (avanca ? 1 : -1) + cartoes.length) % cartoes.length];
    proximo?.focus();
    proximo?.click();
  };

  return (
    <Pagina>
      <Bloco>
        <h3 className={ec.titulo}>{t.tema}</h3>
        <p className={ec.dica}>{t.temaDica}</p>
        <div className={css.janela}>
        <div className={css.vitrine}>
          <div
            role="radiogroup"
            aria-label={t.tema}
            className={css.cartoes}
            onKeyDown={aoTeclar}
            onMouseLeave={() => {
              setEmFoco(undefined);
            }}
          >
            {TEMAS.map((id) => (
              <CartaoDeTema
                key={id}
                id={id}
                marcado={p.tema === id}
                personalizado={p.personalizado}
                aoApontar={setEmFoco}
              />
            ))}
          </div>
          <div className={css.lateral}>
            <p className={ec.rotuloDaSecao}>{t.previa}</p>
            <PreviaDoApp papeis={papeisDaPrevia} nome={nomeDaPrevia} />
          </div>
        </div>
        </div>
        <p className={ec.dica}>{t.soEscuro}</p>
      </Bloco>

      <Personalizar />
    </Pagina>
  );
}

function CartaoDeTema({
  id,
  marcado,
  personalizado,
  aoApontar,
}: {
  id: TemaId;
  marcado: boolean;
  personalizado: boolean;
  aoApontar: (id: TemaId | undefined) => void;
}) {
  const papeis = papeisDoTema(id);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      tabIndex={marcado ? 0 : -1}
      className={css.cartao}
      data-tema={id}
      onClick={() => {
        escolherTema(id);
      }}
      onMouseEnter={() => {
        aoApontar(id);
      }}
      onFocus={() => {
        aoApontar(id);
      }}
      onBlur={() => {
        aoApontar(undefined);
      }}
    >
      <span className={css.miniatura} style={estiloDosPapeis(papeis)} aria-hidden="true">
        <span className={css.miniCampo} />
        <span className={css.miniPainel}>
          <span className={css.miniLinha} />
          <span className={css.miniLinhaCurta} />
          <span className={css.miniAcao} />
        </span>
      </span>
      <span className={css.cartaoNome}>{t.temas[id]}</span>
      {marcado && <span className={css.cartaoEstado}>{personalizado ? t.personalizado : t.emUso}</span>}
    </button>
  );
}

function Personalizar() {
  const p = useSyncExternalStore(assinarPersonalizacao, lerPersonalizacao);
  const [aberto, setAberto] = useState(false);
  const idDaRegiao = useId();
  const validada = p.ativo ? paletaValidada(baseDoTema(), p) : undefined;
  const livre = p.destaqueLivre;

  return (
    <Bloco>
      <button
        type="button"
        className={css.recolher}
        aria-expanded={aberto}
        aria-controls={idDaRegiao}
        onClick={() => {
          setAberto(!aberto);
        }}
      >
        <SetaParaDireita className={juntar(css.seta, aberto && css.setaAberta)} />
        <span className={css.recolherTitulo}>{t.personalizar}</span>
        {p.personalizado && <span className={css.cartaoEstado}>{t.personalizado}</span>}
      </button>
      <div id={idDaRegiao} role="region" aria-label={t.personalizar} hidden={!aberto} className={css.regiao}>
        <p className={ec.dica}>{t.personalizarDica}</p>
        <Deslizante
          rotulo={t.matiz}
          valor={p.matiz}
          min={0}
          max={360}
          texto={t.valorGraus(p.matiz)}
          aoMudar={(v) => {
            personalizar({ matiz: v });
          }}
        />
        <Deslizante
          rotulo={t.intensidade}
          valor={p.intensidade}
          min={0}
          max={100}
          texto={t.valorPorcento(p.intensidade)}
          aoMudar={(v) => {
            personalizar({ intensidade: v });
          }}
        />
        <p className={ec.rotuloDaSecao}>{t.corDeDestaque}</p>
        <div className={css.amostras} role="radiogroup" aria-label={t.corDeDestaque}>
          {DESTAQUES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={livre === null && p.destaque === d}
              aria-label={t.destaques[d]}
              className={css.amostra}
              style={{ background: corDoDestaque(d) }}
              onClick={() => {
                personalizar({ destaque: d, destaqueLivre: null });
              }}
            />
          ))}
        </div>
        <CorLivre cor={corDoDestaqueEscolhido(p)} livre={livre !== null} />
        {validada?.destaqueAjustado && (
          <div className={css.ajuste} role="status">
            <p className={css.ajusteTexto}>{t.destaqueAjustado}</p>
            <div className={css.antesDepois}>
              <Troca rotulo={t.antes} cor={validada.destaqueAjustado.de} />
              <Troca rotulo={t.depois} cor={validada.destaqueAjustado.para} />
            </div>
          </div>
        )}
        <p className={ec.dica}>{t.ajusteAutomatico}</p>
        {p.ativo && validada === undefined && <p className={ec.erro}>{t.semPaleta}</p>}
        {p.personalizado && (
          <div className={ec.acoes}>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => {
                escolherTema(p.tema);
              }}
            >
              {`${t.voltarAoTema} ${t.temas[p.tema]}`}
            </Botao>
          </div>
        )}
      </div>
    </Bloco>
  );
}

function Troca({ rotulo, cor }: { rotulo: string; cor: string }) {
  return (
    <span className={css.troca} data-testid={`destaque-${rotulo}`}>
      <span className={css.trocaCor} style={{ background: cor }} aria-hidden="true" />
      <span>
        {rotulo} <span className={css.hex}>{cor}</span>
      </span>
    </span>
  );
}

/** Seletor de cor qualquer: a amostra nativa e um campo com o código hexadecimal. */
function CorLivre({ cor, livre }: { cor: string; livre: boolean }) {
  const [rascunho, setRascunho] = useState<string | undefined>(undefined);
  const texto = rascunho ?? cor;
  const invalido = rascunho !== undefined && normalizarHex(rascunho) === undefined;
  const idDoCampo = useId();
  return (
    <div className={css.outraCor}>
      <label className={juntar(css.seletor, livre && css.seletorMarcado)}>
        <input
          type="color"
          className={css.seletorEntrada}
          aria-label={t.seletorDeCor}
          value={normalizarHex(cor) ?? "#a99bff"}
          onChange={(e) => {
            setRascunho(undefined);
            personalizar({ destaqueLivre: normalizarHex(e.target.value) ?? null });
          }}
        />
        <span className={css.seletorCor} style={{ background: cor }} aria-hidden="true" />
      </label>
      <div className={css.campoHex}>
        <label htmlFor={idDoCampo} className={css.rotuloHex}>
          {t.outraCor}
        </label>
        <input
          id={idDoCampo}
          type="text"
          className={css.entradaHex}
          aria-label={t.campoHex}
          aria-invalid={invalido}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          value={texto}
          onChange={(e) => {
            const v = e.target.value;
            setRascunho(v);
            const ok = normalizarHex(v);
            if (ok !== undefined) personalizar({ destaqueLivre: ok });
          }}
          onBlur={() => {
            setRascunho(undefined);
          }}
        />
        {invalido && <span className={ec.erro}>{t.hexInvalido}</span>}
      </div>
    </div>
  );
}
