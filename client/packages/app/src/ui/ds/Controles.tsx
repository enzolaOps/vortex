import { voz } from "../../textos";
import {
  Camera,
  CameraDesligada,
  CantoInferiorDireito,
  CantoInferiorEsquerdo,
  CantoSuperiorDireito,
  CantoSuperiorEsquerdo,
  CompartilharTela,
  EncerrarChamada,
  Fone,
  FoneDesligado,
  Microfone,
  MicrofoneDesligado,
} from "../icones";
import { juntar } from "../juntar";
import { Botao } from "./Botao";
import css from "./Controles.module.css";

export type CantoVoz = "tl" | "tr" | "bl" | "br";

export interface ControlesDeVozProps {
  /** Microfone fechado. Surdo implica mudo. */
  mudo?: boolean;
  /** Áudio recebido desligado; implica microfone mudo. */
  surdo?: boolean;
  camera?: boolean;
  tela?: boolean;
  /** Cada controle só existe se o tratador existe (controle sem ação não aparece). */
  onMudo?: () => void;
  onSurdo?: () => void;
  onCamera?: () => void;
  onTela?: () => void;
  onSair?: () => void;
}

/**
 * Microfone, áudio, câmera e tela são toggles de rótulo FIXO com `aria-pressed`
 * (pressionado = ligado); o estado muda o ícone (riscado quando desligado), não
 * o nome. "Sair" é ação, não toggle, e usa `perigo` (`live` é só transmissão).
 */
export function ControlesDeVoz({
  mudo = false,
  surdo = false,
  camera = false,
  tela = false,
  onMudo,
  onSurdo,
  onCamera,
  onTela,
  onSair,
}: ControlesDeVozProps) {
  const microfoneLigado = !mudo && !surdo;
  const toggle = (ligado: boolean) => juntar(ligado ? css.ligado : css.desligado);

  return (
    <div role="group" aria-label={voz.controles} className={css.controles}>
      {onMudo && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          aria-label={voz.microfone}
          aria-pressed={microfoneLigado}
          icone={microfoneLigado ? <Microfone /> : <MicrofoneDesligado />}
          className={toggle(microfoneLigado)}
          onClick={onMudo}
        />
      )}
      {onSurdo && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          aria-label={voz.audioRecebido}
          aria-pressed={!surdo}
          icone={surdo ? <FoneDesligado /> : <Fone />}
          className={toggle(!surdo)}
          onClick={onSurdo}
        />
      )}
      {onCamera && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          aria-label={voz.camera}
          aria-pressed={camera}
          icone={camera ? <Camera /> : <CameraDesligada />}
          className={toggle(camera)}
          onClick={onCamera}
        />
      )}
      {onTela && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          aria-label={voz.compartilharTela}
          aria-pressed={tela}
          icone={<CompartilharTela />}
          className={toggle(tela)}
          onClick={onTela}
        />
      )}
      {onSair && (
        <Botao
          variante="perigo"
          tamanho="sm"
          aria-label={voz.sairDaChamada}
          icone={<EncerrarChamada />}
          onClick={onSair}
        />
      )}
    </div>
  );
}

const ICONE_DO_CANTO = {
  tl: <CantoSuperiorEsquerdo />,
  tr: <CantoSuperiorDireito />,
  bl: <CantoInferiorEsquerdo />,
  br: <CantoInferiorDireito />,
} as const;

/** Quatro botões de canto; o atual fica `aria-pressed`. */
export function CantosDeFixacao({
  canto,
  onCanto,
}: {
  canto: CantoVoz;
  onCanto: (canto: CantoVoz) => void;
}) {
  return (
    <div className={css.cantos}>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <Botao
          key={c}
          variante="fantasma"
          tamanho="sm"
          icone={ICONE_DO_CANTO[c]}
          aria-label={voz.fixarNoCanto[c]}
          aria-pressed={canto === c}
          className={canto === c ? css.atual : undefined}
          onClick={() => {
            onCanto(c);
          }}
        />
      ))}
    </div>
  );
}

/** A bolinha de fala. Dita em texto para quem não vê: "Falando" ou "Ninguém está falando". */
export function IndicadorDeFala({ falando }: { falando: boolean }) {
  return (
    <span
      role="img"
      aria-label={falando ? voz.estado.falando : voz.ninguemFalando}
      className={juntar(css.fala, falando && css.falando)}
    />
  );
}

/**
 * "Fulano está falando", sem cortar o que importa.
 *
 * A bolinha nunca encolhe nem é cortada (o contêiner não corta, só o nome), e o
 * NOME é o que cede espaço com reticências; "está falando" fica inteiro. Sem
 * `nome`, só a bolinha em repouso.
 */
export function QuemFala({ nome, className }: { nome?: string; className?: string }) {
  return (
    <span className={juntar(css.quemFala, className)}>
      <IndicadorDeFala falando={Boolean(nome)} />
      {nome ? (
        <>
          <span className={css.quemFalaNome}>{nome}</span>{" "}
          <span className={css.quemFalaSufixo}>{voz.estaFalando}</span>
        </>
      ) : null}
    </span>
  );
}
