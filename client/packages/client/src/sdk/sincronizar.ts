/**
 * Sync de preferências via UserSettings do protocolo Stoat.
 *
 * Não é fork: `POST /sync/settings/fetch|set` e `UserSettingsUpdate` já
 * existem. Chaves `vortex:*` o cliente oficial ignora.
 *
 * // ponytail: last-write-wins por chave (timestamp do protocolo).
 */
import { escreverPreset, lerPreset } from "../preset/preset";
import { definirDensidade, lerDensidade } from "../store/densidade";
import { aplicarPreset, lerBruto, lerLayout } from "../store/layout";
import { definirNotificacoes, lerNotificacoes } from "../store/notificacoes";
import {
  definirPreferenciasDeVoz,
  lerPreferenciasDeVoz,
} from "../store/preferenciasDeVoz";
import { definirPrivacidade, lerPrivacidade } from "../store/privacidade";
import {
  exportarPrivacidadeDoServidor,
  hidratarPrivacidadeDoServidor,
} from "../store/privacidadeDoServidor";
import {
  aplicarRemoto,
  avisarSync,
  CHAVES_SYNC,
  decisao,
  ligarEnvio,
  type ChaveSync,
} from "../store/sync";
import { client, conectado } from "./client";

const revisao: Record<string, number> = {};
const fila = new Map<ChaveSync, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let instalado = false;

/** Estado limpo entre testes. */
export function limparSync(): void {
  for (const k of Object.keys(revisao)) delete revisao[k];
  fila.clear();
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function ehChave(k: string): k is ChaveSync {
  return (CHAVES_SYNC as readonly string[]).includes(k);
}

function snapshot(chave: ChaveSync): string {
  switch (chave) {
    case "vortex:preset":
      return escreverPreset(lerLayout(), lerBruto());
    case "vortex:privacidade":
      return JSON.stringify(lerPrivacidade());
    case "vortex:voz":
      return JSON.stringify(lerPreferenciasDeVoz());
    case "vortex:notificacoes": {
      const p = lerNotificacoes();
      return JSON.stringify({ ...p, matriz: [...p.matriz] });
    }
    case "vortex:privacidadeDoServidor":
      return exportarPrivacidadeDoServidor();
    case "vortex:densidade":
      return lerDensidade();
  }
}

function hidratar(chave: ChaveSync, data: string): void {
  aplicarRemoto(() => {
    switch (chave) {
      case "vortex:preset": {
        const lido = lerPreset(data);
        aplicarPreset(lido.preset, lido.bruto);
        break;
      }
      case "vortex:privacidade":
        definirPrivacidade(JSON.parse(data) as Parameters<typeof definirPrivacidade>[0]);
        break;
      case "vortex:voz":
        definirPreferenciasDeVoz(
          JSON.parse(data) as Parameters<typeof definirPreferenciasDeVoz>[0],
        );
        break;
      case "vortex:notificacoes": {
        const o = JSON.parse(data) as Record<string, unknown>;
        definirNotificacoes({
          ...(o as never),
          matriz: Array.isArray(o.matriz)
            ? new Set(o.matriz.filter((c): c is string => typeof c === "string"))
            : undefined,
        });
        break;
      }
      case "vortex:privacidadeDoServidor":
        hidratarPrivacidadeDoServidor(data);
        break;
      case "vortex:densidade":
        if (data === "compacto" || data === "confortavel") definirDensidade(data);
        break;
    }
  });
}

function agendar(chave: ChaveSync, valor: string): void {
  fila.set(chave, valor);
  revisao[chave] = Date.now();
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, 400);
}

async function flush(): Promise<void> {
  if (!conectado() || fila.size === 0) return;
  const enviando = new Map(fila);
  fila.clear();
  const ts = Date.now();
  try {
    await client.account.setSettings(Object.fromEntries(enviando), ts);
  } catch {
    for (const [k, v] of enviando) fila.set(k, v);
  }
}

export function aplicarAtualizacao(
  update: Record<string, [number, string]>,
): void {
  for (const [chave, par] of Object.entries(update)) {
    if (!ehChave(chave)) continue;
    const [ts, data] = par;
    const local = revisao[chave] ?? 0;
    const oQue = decisao(ts, local);
    if (oQue === "enviar") {
      avisarSync(chave, snapshot(chave));
      continue;
    }
    if (oQue === "ignorar") continue;
    revisao[chave] = ts;
    try {
      hidratar(chave, data);
    } catch {
      /* JSON podre: fica o local */
    }
  }
}

export async function puxarConfiguracoes(): Promise<void> {
  if (!conectado()) return;
  let response: Record<string, [number, string]>;
  try {
    response = await client.account.fetchSettings([...CHAVES_SYNC]);
  } catch {
    return;
  }
  aplicarAtualizacao(response);
  for (const chave of CHAVES_SYNC) {
    if (!(chave in response)) agendar(chave, snapshot(chave));
  }
}

export function instalarSync(): void {
  if (instalado) return;
  instalado = true;
  ligarEnvio(agendar);
  client.on("userSettingsUpdate", (_id, update) => aplicarAtualizacao(update));
}
