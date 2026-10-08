import { caminhoDaEntrada, interpretarEntrada } from "nucleo/rota/rota";
import {
  assinarEntrada,
  definirEntrada,
  voltarParaEntrar,
  lerEntrada,
  type TelaDeEntrada,
} from "nucleo/store/entrada";
import { lerSessao } from "nucleo/store/sessao";

import { guardarConvite, guardarPedidoDeQr } from "./destinoPendente";

/**
 * A URL das telas de fora, nos dois sentidos.
 *
 * Só as telas de fora: o app ainda não tem rota própria, e ligar a projeção inteira
 * do núcleo (`ligarRota`) reescreveria o endereço a cada passo do shell. Aqui a URL
 * serve a quatro coisas que só existem por link: o e-mail de confirmação
 * (`/verificar/:token`), o de redefinição (`/redefinir/:token`), o convite
 * (`/convite/:codigo`) e a autorização por QR (`/qr/:id`).
 *
 * O e-mail NUNCA entra na URL (ver `caminhoDaEntrada`): endereço de e-mail na barra
 * fica em histórico, em log de proxy e em print de tela.
 */

let ligada = false;

function caminhoAtual(): string {
  return window.location.pathname;
}

/** Telas cujo endereço carrega um segredo de uso único: ao sair, elas SOBRESCREVEM a entrada do histórico. */
function carregaSegredo(tela: TelaDeEntrada): boolean {
  return tela.tipo === "verificar" || tela.tipo === "redefinir";
}

/**
 * O endereço que a tela pede. Dentro do app a tela de "entrar" é só o estado neutro
 * da loja, e o endereço volta a `/`: mostrar `/entrar` num app aberto seria mentir.
 */
function caminhoDa(tela: TelaDeEntrada): string {
  if (lerSessao().estado === "dentro" && tela.tipo === "entrar") return "/";
  return caminhoDaEntrada(tela);
}

function lembrarDestino(tela: TelaDeEntrada): void {
  if (tela.tipo === "convite") guardarConvite(tela.codigo);
  if (tela.tipo === "autorizarQr") guardarPedidoDeQr(tela.id);
}

/** Lê o endereço da abertura e passa a espelhar a tela de fora. Idempotente. */
export function ligarRotaDeEntrada(): void {
  if (ligada || typeof window === "undefined") return;
  ligada = true;

  const inicial = interpretarEntrada(caminhoAtual());
  if (inicial) {
    lembrarDestino(inicial);
    definirEntrada(inicial);
    // A entrada de histórico da abertura é a própria abertura: não empilha.
    window.history.replaceState(null, "", caminhoDaEntrada(inicial));
  }

  let anterior = lerEntrada();
  assinarEntrada(() => {
    const tela = lerEntrada();
    const caminho = caminhoDa(tela);
    const saiuDeSegredo = carregaSegredo(anterior);
    anterior = tela;
    if (caminho === caminhoAtual()) return;
    if (saiuDeSegredo) window.history.replaceState(null, "", caminho);
    else window.history.pushState(null, "", caminho);
  });

  window.addEventListener("popstate", () => {
    const tela = interpretarEntrada(caminhoAtual()) ?? { tipo: "entrar" as const };
    lembrarDestino(tela);
    anterior = tela;
    definirEntrada(tela);
  });
}

/** Só para teste: permite ligar de novo. */
export function desligarRotaDeEntrada(): void {
  ligada = false;
}

/**
 * Sai das telas de fora quando a sessão vale: volta a tela neutra e tira o endereço de
 * fora da barra. `replace` e não `push` no segundo passo, porque o "voltar" depois de
 * entrar não deve reabrir o formulário de senha.
 */
export function irParaOApp(): void {
  voltarParaEntrar();
  if (typeof window !== "undefined" && interpretarEntrada(caminhoAtual())) {
    window.history.replaceState(null, "", "/");
  }
}
