/**
 * O ouvinte dos eventos crus de figurinhas e efeitos sonoros.
 *
 * Arquivo próprio para `expressoes.ts` e `efeitosSonoros.ts` continuarem
 * testáveis sem instalar ouvinte nenhum no `client` compartilhado.
 */
import { client } from "./client";
import { aoTocarNaSala } from "./efeitosSonoros";
import {
  aplicarEventoDeExpressao,
  buscarFigurinha,
  figurinhas,
  carregarFigurinhas,
  carregarSons,
  figurinhasDoServidor,
  sonsDoServidor,
} from "./expressoes";

let instalado = false;

export function instalarExpressoes(): void {
  if (instalado) return;
  instalado = true;

  client.events.on("event", (evento: unknown) => {
    const tratar = (e: unknown): void => {
      const x = e as { type?: string; v?: unknown } | null;
      if (x?.type === "Bulk" && Array.isArray(x.v)) {
        for (const item of x.v) tratar(item);
        return;
      }
      if (x?.type === "VoiceSoundboardPlay") {
        aoTocarNaSala(x);
        return;
      }
      aplicarEventoDeExpressao(x);
    };
    tratar(evento);
  });

  /*
    Quem abriu a página ANTES da conexão viu "carregando" e ficaria nele: a
    busca da primeira assinatura desistiu sem socket. No `ready`, rebusca o que
    tem gente olhando — e só isso.
  */
  client.on("ready", () => {
    for (const id of figurinhasDoServidor.assinados()) void carregarFigurinhas(id);
    for (const id of sonsDoServidor.assinados()) void carregarSons(id);
    for (const id of figurinhas.assinados()) {
      if (figurinhas.peek(id) === undefined) void buscarFigurinha(id);
    }
  });
}
