import { contagem } from "nucleo/lib/plural";
import type { CSSProperties } from "react";

import { ds } from "../../textos";
import { CompartilharTela } from "../icones";
import { juntar } from "../juntar";
import css from "./Avatar.module.css";
import { iniciais, tomDe } from "./tom";

export type StatusDePresenca = "online" | "idle" | "dnd" | "offline";

export interface AvatarProps {
  /** Nome completo; gera as iniciais e o rótulo acessível. */
  nome: string;
  /** ID da pessoa; escolhe o tom por hash quando `tom` não é dado. */
  id?: string;
  /** 1 a 8, token `avatar-N`. */
  tom?: number;
  /** Em px. Usados: 20, 28, 36, 44, 120. */
  tamanho?: number;
  /** Presença desenhada por FORMA: círculo cheio, meia lua, círculo com barra, círculo vazado. */
  status?: StatusDePresenca;
  /** Contorno de fala. Sinal de quem fala agora, não de quem só está conectado. */
  falando?: boolean;
  /** Selo de tela ao vivo no rodapé. */
  transmitindo?: boolean;
  className?: string;
  style?: CSSProperties;
}

const TONS = [
  css.tom1,
  css.tom2,
  css.tom3,
  css.tom4,
  css.tom5,
  css.tom6,
  css.tom7,
  css.tom8,
] as const;

/** Quatro formas distintas num quadrado de 10: a leitura sobrevive em escala de cinza. */
function FormaDePresenca({ status }: { status: StatusDePresenca }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {status === "online" && <circle cx="5" cy="5" r="5" fill="currentColor" />}
      {status === "idle" && <path d="M5 0a5 5 0 1 0 5 5.6A4 4 0 0 1 5 0Z" fill="currentColor" />}
      {status === "dnd" && (
        <>
          <circle cx="5" cy="5" r="5" fill="currentColor" />
          <rect x="2.2" y="4.2" width="5.6" height="1.6" rx="0.8" fill="var(--vx-surface-solid)" />
        </>
      )}
      {status === "offline" && (
        <circle cx="5" cy="5" r="3.9" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  );
}

export function Avatar({
  nome,
  id,
  tom,
  tamanho = 36,
  status,
  falando = false,
  transmitindo = false,
  className,
  style,
}: AvatarProps) {
  const partes = [nome];
  if (falando) partes.push(ds.avatar.falando);
  if (transmitindo) partes.push(ds.avatar.transmitindo);
  if (status) partes.push(ds.avatar[status]);

  const distintivo = Math.max(8, Math.round(tamanho * 0.28));
  const vars = { "--av": `${tamanho}px`, "--av-badge": `${distintivo}px` } as CSSProperties;

  return (
    <span
      role="img"
      aria-label={partes.join(", ")}
      className={juntar(css.avatar, TONS[tomDe(id, nome, tom) - 1], className)}
      style={{ ...vars, ...style }}
    >
      <span aria-hidden="true">{iniciais(nome)}</span>
      {falando && <span className={css.fala} aria-hidden="true" />}
      {status && (
        <span className={juntar(css.status, css[status])} aria-hidden="true">
          <FormaDePresenca status={status} />
        </span>
      )}
      {transmitindo && (
        <span className={css.transmitindo} aria-hidden="true">
          <CompartilharTela tamanho={14} />
        </span>
      )}
    </span>
  );
}

export interface PilhaDeAvataresProps {
  itens: ReadonlyArray<{ nome: string; id?: string; tom?: number }>;
  /** Máximo visível antes do "+k". Padrão 4. */
  max?: number;
  /** Tamanho de cada avatar em px. Padrão 28. */
  tamanho?: number;
  className?: string;
}

export function PilhaDeAvatares({ itens, max = 4, tamanho = 28, className }: PilhaDeAvataresProps) {
  const visiveis = itens.slice(0, max);
  const resto = itens.length - visiveis.length;
  return (
    <span
      className={juntar(css.pilha, className)}
      style={{ "--av": `${tamanho}px` } as CSSProperties}
    >
      {visiveis.map((p) => (
        <span key={p.id ?? p.nome} className={css.pilhaItem}>
          <Avatar nome={p.nome} id={p.id} tom={p.tom} tamanho={tamanho} />
        </span>
      ))}
      {resto > 0 && (
        <span role="img" aria-label={ds.maisPessoas(resto)} className={css.resto}>
          <span aria-hidden="true">+{contagem(resto)}</span>
        </span>
      )}
    </span>
  );
}
