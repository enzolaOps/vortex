import { client } from "./client";
import type { ConfiguracaoDoGifbox, ProvedorDeGif } from "./gifs";

/**
 * DE ONDE vêm os GIFs desta instância — só a configuração, sem provedor.
 *
 * ⚠ **Separado de `gifs.ts` por causa do BUNDLE.** Este arquivo fica no
 * carregamento inicial porque lê o `client` e guarda o dublê do arnês; o
 * provedor, a tradução da resposta e o seletor vão num chunk que só baixa
 * quando alguém abre o seletor de GIF. Medido: com tudo junto no chunk, o
 * bundler extraía `client` e o runtime do JSX em dois arquivos a mais no
 * carregamento inicial.
 *
 * ⚠ **O cliente nunca vê chave.** A chave do provedor mora no `gifbox`
 * (`api.security.tenor_key`); daqui só sai o ENDEREÇO dele. O `GET /` da API
 * não o anuncia (a `RevoltFeatures` do `delta` não tem o campo), então ele
 * vem de `VITE_GIFBOX_URL` no build — e, se um dia a instância o anunciar em
 * `features.gifbox.url`, é lido sem rebuild.
 */
export type FonteDeGifs =
  | { readonly tipo: "gifbox"; readonly configuracao: ConfiguracaoDoGifbox }
  | { readonly tipo: "dublado"; readonly provedor: ProvedorDeGif };

type Features = {
  features?: { gifbox?: { url?: unknown }; january?: { url?: unknown } };
};

/** O primeiro valor não vazio — `??` deixaria passar a string vazia do Docker. */
function naoVazio(...valores: unknown[]): string | undefined {
  for (const v of valores) {
    if (typeof v === "string" && v.trim() !== "") return v.trim().replace(/\/+$/, "");
  }
  return undefined;
}

let dublado: ProvedorDeGif | undefined;

/**
 * Troca o provedor por um dublê — só o arnês `/dev` chama, pelo mesmo arranjo
 * de `configurarSimulacaoDeEnvio`. `undefined` desfaz.
 */
export function dublarProvedorDeGif(p: ProvedorDeGif | undefined): void {
  dublado = p;
}

/**
 * A fonte desta instância, ou `undefined` quando ela não configurou GIFs.
 *
 * Lida na hora e não no `import`: `client.configuration` só chega depois do
 * `GET /` do arranque, e congelar o valor no carregamento do módulo daria
 * "não configurado" para sempre numa instância que o anuncia.
 */
export function fonteDeGifs(): FonteDeGifs | undefined {
  if (dublado) return { tipo: "dublado", provedor: dublado };
  const conf = client.configuration as Features | undefined;
  const base = naoVazio(
    import.meta.env.VITE_GIFBOX_URL as string | undefined,
    conf?.features?.gifbox?.url,
  );
  if (base === undefined) return undefined;
  return {
    tipo: "gifbox",
    configuracao: {
      base,
      proxy: naoVazio(conf?.features?.january?.url),
      cabecalho: () => {
        const [nome, valor] = client.authenticationHeader;
        return valor ? [nome, valor] : undefined;
      },
    },
  };
}
