import { useSyncExternalStore } from "react";

/**
 * Os dispositivos de mídia que o navegador enumera.
 *
 * ⚠ **Store e não `useState` por tela, desde que a doca da chamada ganhou o
 * `▾` de dispositivo (D-TELA-18).** Até ali só Configurações › Voz e vídeo
 * listava dispositivos, com um `useEffect` e o próprio `devicechange`. Com a
 * doca eram dois donos da mesma lista, cada um com o seu listener — e o
 * primeiro a divergir seria o que ninguém abriu naquela semana. Aqui há UM
 * listener, ligado enquanto alguém assina e desligado quando o último sai
 * (listener sem cleanup é o erro nº 5 do briefing).
 *
 * ⚠ **Sem permissão, `enumerateDevices` devolve entradas com `label`
 * VAZIO** — o navegador esconde o nome do hardware até alguém abrir o
 * microfone uma vez. Por isso a primeira opção é sempre "Padrão do sistema",
 * que é verdade e é o que a maioria quer.
 *
 * Fora de `sdk/`: `mediaDevices` é API do navegador, não do protocolo, e não
 * arrasta o LiveKit — que é meio megabyte que Configurações não deve baixar.
 */

export const PADRAO_DO_SISTEMA = "Padrão do sistema";

const VAZIA: readonly MediaDeviceInfo[] = [];

/** Referência cacheada por tipo — armadilha nº 1 do `getSnapshot`. */
let porTipo = new Map<MediaDeviceKind, readonly MediaDeviceInfo[]>();
const ouvintes = new Set<() => void>();

function midia(): MediaDevices | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
}

function ler(): void {
  void midia()
    ?.enumerateDevices()
    .then((ds) => {
      const novo = new Map<MediaDeviceKind, MediaDeviceInfo[]>();
      for (const d of ds) {
        const lista = novo.get(d.kind) ?? [];
        lista.push(d);
        novo.set(d.kind, lista);
      }
      porTipo = novo;
      for (const o of ouvintes) o();
    })
    .catch(() => {
      /* Sem permissão nem hardware. A lista fica só com o padrão. */
    });
}

export function assinarDispositivos(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  if (ouvintes.size === 1) {
    /* Plugar um fone durante a sessão muda a lista; sem isto a tela
       mostraria para sempre o que existia quando ela abriu. */
    midia()?.addEventListener("devicechange", ler);
    ler();
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size === 0) midia()?.removeEventListener("devicechange", ler);
  };
}

export function lerDispositivos(tipo: MediaDeviceKind): readonly MediaDeviceInfo[] {
  return porTipo.get(tipo) ?? VAZIA;
}

export function useDispositivos(tipo: MediaDeviceKind): readonly MediaDeviceInfo[] {
  return useSyncExternalStore(assinarDispositivos, () => lerDispositivos(tipo));
}

/** Os que têm nome — sem permissão o navegador os entrega anônimos. */
export function comNome(ds: readonly MediaDeviceInfo[]): MediaDeviceInfo[] {
  return ds.filter((d) => d.label.length > 0);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparDispositivos(): void {
  porTipo = new Map();
  ouvintes.clear();
}
