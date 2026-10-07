/**
 * Regras locais dos formulários de conta: força da senha, nome de usuário e e-mail.
 *
 * Tudo aqui é FORMATO, e a verdade final é do servidor. A força é uma orientação
 * para quem escolhe, não uma promessa de segurança: nenhum degrau libera nada, o
 * botão depende só do mínimo.
 */

export const MINIMO_DA_SENHA = 8;

export type NivelDeForca = "vazia" | "fraca" | "media" | "boa" | "forte";

export interface ForcaDaSenha {
  /** Quantas das quatro barras acendem (0 a 4). */
  barras: 0 | 1 | 2 | 3 | 4;
  nivel: NivelDeForca;
  /** O que falta, para o texto de apoio escolher a frase. */
  falta: number;
}

const NIVEL: readonly NivelDeForca[] = ["vazia", "fraca", "media", "boa", "forte"];

/**
 * Comprimento mais variedade. Abaixo do mínimo, no máximo uma barra: quatro barras
 * acesas numa senha que o botão recusa seria o medidor contradizendo o formulário.
 */
export function forcaDaSenha(senha: string): ForcaDaSenha {
  if (senha.length === 0) return { barras: 0, nivel: "vazia", falta: MINIMO_DA_SENHA };
  if (senha.length < MINIMO_DA_SENHA) {
    return { barras: 1, nivel: "fraca", falta: MINIMO_DA_SENHA - senha.length };
  }
  let pontos = 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 1;
  if (/\d/.test(senha)) pontos += 1;
  if (/[^A-Za-z0-9]/.test(senha) && senha.length >= 10) pontos += 1;
  const barras = Math.min(4, pontos) as 1 | 2 | 3 | 4;
  return { barras, nivel: NIVEL[barras] ?? "fraca", falta: 0 };
}

export type ProblemaDeUsuario = "curto" | "longo" | "invalido";

/**
 * A regra do protocolo (2 a 32, letras, dígitos, `_`, `.` e `-`), não a do desenho:
 * recusar o que o servidor aceita deixaria a dica mentindo sobre o que vai acontecer.
 */
export function problemaDoUsuario(nome: string): ProblemaDeUsuario | undefined {
  if (nome.length === 0) return undefined;
  if (nome.length < 2) return "curto";
  if (nome.length > 32) return "longo";
  if (!/^(\p{L}|[\d_.-])+$/u.test(nome)) return "invalido";
  return undefined;
}

export function emailPlausivel(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
