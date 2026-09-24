import { useCallback, useEffect, useRef, useState } from "react";

import { dbDoRms, rmsDe } from "../lib/nivelDeAudio";

/**
 * Câmera e microfone ABERTOS FORA DA CHAMADA, para as duas telas de teste.
 *
 * ⚠ **Não toca em `preferenciasDeVoz`, e a razão é dura.** O motor de voz
 * assina aquele store: escrever ali para "configurar o teste" trocaria o
 * dispositivo de uma chamada VIVA no meio de uma frase. Aqui as preferências
 * são LIDAS para montar as constraints, e nada mais.
 *
 * ⚠ **Também não usa `switchActiveDevice` do LiveKit.** Aquele caminho tem um
 * dono só — o motor —, e um segundo escritor produziria as duas trocas
 * disputando o mesmo dispositivo. Isto aqui é `getUserMedia` cru, numa faixa
 * própria que nunca chega ao transporte.
 *
 * ⚠ **O risco real é a faixa SOBREVIVER à tela**, e não a tela falhar em
 * abri-la: a luz da câmera fica acesa, e em alguns drivers do Windows o
 * segundo `open` falha porque o primeiro nunca fechou. Por isso todo caminho
 * de saída para as faixas — o de desligar, o de trocar de dispositivo, o de
 * desmontar e o de erro.
 */

type Estado = "parado" | "abrindo" | "ligado" | "erro";

/** A mensagem que a tela mostra, pelo nome do erro do navegador. */
function traduzir(e: unknown): string {
  const nome = e instanceof DOMException ? e.name : "";
  if (nome === "NotAllowedError") return "Permissão negada pelo navegador.";
  if (nome === "NotFoundError") return "Nenhum dispositivo encontrado.";
  if (nome === "NotReadableError") {
    return "O dispositivo está em uso por outro programa.";
  }
  if (nome === "OverconstrainedError") {
    return "O dispositivo escolhido não está mais disponível.";
  }
  return "Não foi possível abrir o dispositivo.";
}

/**
 * Uma faixa local, aberta e fechada por quem chama.
 *
 * Devolve o `MediaStream` para o consumidor pendurar num `<video>` ou num
 * `AnalyserNode`; o ciclo de vida fica aqui.
 */
export function useFaixaLocal() {
  const [estado, setEstado] = useState<Estado>("parado");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [faixa, setFaixa] = useState<MediaStream | null>(null);
  const faixaRef = useRef<MediaStream | null>(null);

  /* Guarda contra a faixa que chega DEPOIS de a tela sair — ver `abrir`. */
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      const atual = faixaRef.current;
      faixaRef.current = null;
      if (atual) for (const t of atual.getTracks()) t.stop();
    };
  }, []);

  const fechar = useCallback(() => {
    const atual = faixaRef.current;
    faixaRef.current = null;
    if (atual) for (const t of atual.getTracks()) t.stop();
    setFaixa(null);
    setEstado("parado");
    setErro(undefined);
  }, []);

  /*
    ⚠ **As constraints são ARGUMENTO de `abrir`, e não parâmetro do hook.** Elas
    saem das preferências e são um objeto montado no render de quem chama;
    guardá-las numa ref exigiria escrever durante o render, que o lint deste
    projeto reprova e com razão — o React pode descartar aquele render.
  */
  const abrir = useCallback(async (constraints: MediaStreamConstraints) => {
    /* Fecha a anterior antes de pedir a próxima — sem isto, trocar de
       dispositivo deixaria a faixa velha aberta e a luz acesa. */
    const anterior = faixaRef.current;
    faixaRef.current = null;
    if (anterior) for (const t of anterior.getTracks()) t.stop();

    setEstado("abrindo");
    setErro(undefined);
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      /*
        ⚠ Se a tela desmontou enquanto o navegador perguntava, a faixa chega
        órfã — e sem esta guarda ela fica aberta para sempre. `faixaRef` é
        `null` só nesse caso, porque quem abre a escreve na linha seguinte.
      */
      if (!montadoRef.current) {
        for (const t of s.getTracks()) t.stop();
        return null;
      }
      faixaRef.current = s;
      setFaixa(s);
      setEstado("ligado");
      return s;
    } catch (e) {
      setErro(traduzir(e));
      setEstado("erro");
      return null;
    }
  }, []);

  return { estado, erro, faixa, abrir, fechar };
}

/*
  O nível do microfone de TESTE, em dB — um store efêmero, não estado de
  componente.

  ⚠ **Store e não `useState`, e a razão é a lei nº 1.** O nível muda dezenas de
  vezes por segundo, e a tela tem DOIS medidores lendo o mesmo número (o do
  teste e o do limiar manual). Com `useState` na página, cada passo do RMS
  re-renderizaria a página inteira — interruptores, seletores, a tabela de
  atalhos — para acender uma barra. Aqui só os medidores assinam, e cada um
  acorda sozinho.

  ⚠ **Throttle na FRONTEIRA**, como o store de fala: o laço mede a cada quadro,
  mas publica só quando o dB inteiro muda e no máximo a cada 50 ms. 20 Hz é
  mais rápido do que o olho acompanha um medidor e 3× mais lento que o
  `requestAnimationFrame`.
*/
let nivelDb: number | undefined;
const ouvintesDoNivel = new Set<() => void>();

export function assinarNivelDeEntrada(ouvinte: () => void): () => void {
  ouvintesDoNivel.add(ouvinte);
  return () => {
    ouvintesDoNivel.delete(ouvinte);
  };
}

/** `undefined` = nenhum teste medindo, que é diferente de silêncio. */
export function lerNivelDeEntrada(): number | undefined {
  return nivelDb;
}

function publicarNivel(db: number | undefined): void {
  if (db === nivelDb) return;
  nivelDb = db;
  for (const o of ouvintesDoNivel) o();
}

const INTERVALO_DO_NIVEL_MS = 50;

/**
 * Mede a faixa aberta com um `AnalyserNode` e publica no store acima.
 *
 * ⚠ **Mede de verdade** — a tela dizia por extenso que o medidor era um
 * gabarito parado, e a razão dada era a certa: barra animada com número
 * inventado é a mesma mentira do "Conectado · 42 ms" que a faixa de voz
 * recusou. A conta de dB é a de `lib/nivelDeAudio.ts`, a MESMA que a porta de
 * voz do motor usa — é o que mantém a marca do limiar honesta.
 */
export function useMedirEntrada(faixa: MediaStream | null): void {
  useEffect(() => {
    if (!faixa) return;

    const ctx = new AudioContext();
    const fonte = ctx.createMediaStreamSource(faixa);
    const analisador = ctx.createAnalyser();
    /* 1024 dá ~21ms de janela a 48kHz: curto o bastante para acompanhar a
       fala, longo o bastante para o RMS não tremer com um estalo. */
    analisador.fftSize = 1024;
    fonte.connect(analisador);

    const amostra = new Float32Array(analisador.fftSize);
    let vivo = true;
    let publicadoEm = -Infinity;

    function quadro(agora: number) {
      if (!vivo) return;
      if (agora - publicadoEm >= INTERVALO_DO_NIVEL_MS) {
        analisador.getFloatTimeDomainData(amostra);
        publicadoEm = agora;
        publicarNivel(Math.round(dbDoRms(rmsDe(amostra))));
      }
      requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    return () => {
      vivo = false;
      fonte.disconnect();
      /* Sem faixa não há o que medir: o medidor volta a "— dB" em vez de
         congelar no último número. */
      publicarNivel(undefined);
      /* `close()` devolve o dispositivo de áudio ao sistema. Sem ele, cada
         abertura da tela deixa um `AudioContext` vivo — o erro nº 5 do
         briefing, e o navegador tem teto de contextos por aba. */
      void ctx.close();
    };
  }, [faixa]);
}

/** Onde o teste de microfone está. */
export type FaseDoTeste = "parado" | "gravando" | "tocando";

/**
 * Grava 5 s e toca de volta — o que a tela promete por extenso.
 *
 * ⚠ **Gravar e não só medir.** Um medidor ao vivo responde "o microfone está
 * pegando"; ouvir de volta responde "e soa como o quê" — que é a pergunta de
 * quem tem eco, ruído de ventoinha ou ganho errado, e a razão de a tela dizer
 * "ouça de volta".
 *
 * ⚠ **Sem `mimeType` escolhido à mão.** O suporte varia por navegador
 * (`audio/webm;codecs=opus` no Chromium, `audio/mp4` no Safari), e pedir um
 * que não existe faz o construtor LANÇAR. O default do navegador é sempre um
 * formato que ele mesmo sabe tocar, que é a única garantia de que importa
 * aqui — o arquivo nunca sai desta aba.
 */
export function useTesteDeMicrofone(duracaoMs = 5000) {
  const [fase, setFase] = useState<FaseDoTeste>("parado");
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const encerrar = useCallback(() => {
    const g = gravadorRef.current;
    gravadorRef.current = null;
    if (g && g.state !== "inactive") g.stop();

    const a = audioRef.current;
    audioRef.current = null;
    if (a) {
      a.pause();
      a.src = "";
    }
    /* ⚠ `revokeObjectURL` e não só soltar a referência: cada blob de 5 s de
       Opus fica preso à aba até o `revoke`, e testar dez vezes numa sessão de
       8 h é o erro nº 5 do briefing com áudio no lugar de listener. */
    if (urlRef.current !== null) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setFase("parado");
  }, []);

  useEffect(() => encerrar, [encerrar]);

  const gravar = useCallback(
    (faixa: MediaStream) => {
      const pedacos: Blob[] = [];
      const g = new MediaRecorder(faixa);
      gravadorRef.current = g;

      g.ondataavailable = (e) => {
        if (e.data.size > 0) pedacos.push(e.data);
      };
      g.onstop = () => {
        if (gravadorRef.current !== g) return; // encerrado por fora
        gravadorRef.current = null;
        const url = URL.createObjectURL(new Blob(pedacos, { type: g.mimeType }));
        urlRef.current = url;

        const a = new Audio(url);
        audioRef.current = a;
        a.onended = encerrar;
        /*
          ⚠ Falha de reprodução cai no MESMO encerrar, e sem isto a tela ficaria
          presa em "tocando" para sempre — o estado que nenhum botão desfaz.
        */
        a.onerror = encerrar;
        setFase("tocando");
        void a.play().catch(encerrar);
      };

      g.start();
      setFase("gravando");
      setTimeout(() => {
        if (gravadorRef.current === g && g.state !== "inactive") g.stop();
      }, duracaoMs);
    },
    [duracaoMs, encerrar],
  );

  return { fase, gravar, encerrar };
}
