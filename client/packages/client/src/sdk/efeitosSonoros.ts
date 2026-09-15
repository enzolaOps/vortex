/**
 * Tocar um efeito sonoro — para si e para a sala.
 *
 * ## A abordagem, e por que não é faixa no LiveKit
 *
 * Três caminhos foram pesados, e a latência decidiu:
 *
 *  1. **Publicar uma faixa de áudio temporária no LiveKit.** Cada clique
 *     pagaria renegociação de SDP antes do primeiro byte, e o `can_publish_sources`
 *     do token só autoriza `microphone` e as de vídeo — seria outro fork, no
 *     emissor do token.
 *  2. **Mixar na faixa do microfone** (`AudioContext` somando o arquivo à
 *     captura). Sem renegociação, mas o som atravessa o codec e o filtro de
 *     ruído de VOZ, morre quando a pessoa está muda — que é justamente quando
 *     alguém aperta um botão de "tambor" —, e quem ouve não consegue baixar os
 *     sons sem baixar a voz de quem os tocou. E o motor de voz está sendo
 *     mexido por outro grupo agora.
 *  3. **Evento + reprodução local em cada cliente** — o escolhido. Quem clica
 *     ouve NA HORA (o arquivo toca antes da rede), o `delta` autoriza e publica
 *     `VoiceSoundboardPlay` no canal, e cada cliente da sala toca o mesmo
 *     arquivo do `autumn`, que ele pode ter em cache. A latência para a sala é
 *     a de um evento de socket — a mesma da mensagem —, sem SDP e sem codec, e
 *     o volume de cada ouvinte multiplica o de origem.
 *
 * ⚠ **O que (3) perde, dito:** quem ouve a sala por um cliente que não conhece
 * o evento (o Stoat de referência) não ouve os sons. É instância privada deste
 * produto, e é a mesma troca de toda feature de fork.
 */
import { client, conectado } from "./client";
import { bitDaPermissao } from "./cargos";
import { motivoDoErro } from "./erros";
import type { EfeitoSonoro } from "./expressoes";
import { paraEfeitoSonoro } from "./expressoes";
import { toast } from "../components/ui/toastStore";
import { lerChamada } from "../store/chamada";
import { lerPreferenciasDeVoz } from "../store/preferenciasDeVoz";
import { lerVolumeDoPainel, marcarTocando } from "../store/soundboard";

/*
  Os bits vêm da tabela de `cargos.ts`, e não de uma cópia aqui: com duas, o
  editor de cargos e o painel poderiam discordar sobre qual é o bit 43, e o
  teste que guarda uma não guardaria a outra.
*/
const USAR_SOUNDBOARD = bitDaPermissao("UseSoundboard");
const FALAR = bitDaPermissao("Speak");

/**
 * Pode tocar para a sala deste canal?
 *
 * `Speak` + `UseSoundboard`, as mesmas duas que o servidor confere. Lida do
 * valor calculado do canal, porque `havePermission` só aceita nomes da tabela
 * do SDK. Sem sessão, `true` — a exceção estreita de `permissoes.ts`.
 */
export function podeUsarSoundboard(channelId: string): boolean {
  if (client.user === undefined) return true;
  const canal = client.channels.get(channelId);
  if (!canal) return false;
  try {
    const p = canal.permission;
    return (p & USAR_SOUNDBOARD) === USAR_SOUNDBOARD && (p & FALAR) === FALAR;
  } catch {
    return false;
  }
}

/** Volume final de um som nesta máquina: origem × painel, de 0 a 1. */
export function volumeFinal(origem: number, painel: number): number {
  return Math.min(1, Math.max(0, (origem / 100) * (painel / 100)));
}

/**
 * Teto de sons simultâneos. Sem ele, alguém segurando a tecla "1" empilharia
 * dezenas de `<audio>` — ruído para a sala e memória para quem ouve.
 */
const SIMULTANEOS = 4;
/** Os `<audio>` vivos de cada som — é o que "parar" precisa alcançar. */
const tocandoAgora = new Map<string, Map<HTMLAudioElement, () => void>>();
let total = 0;

/** Para todas as instâncias de um som nesta máquina. */
export function pararLocalmente(somId: string): void {
  const vivos = tocandoAgora.get(somId);
  if (!vivos) return;
  for (const [audio, soltar] of [...vivos]) {
    audio.pause();
    soltar();
  }
}

/**
 * Toca o arquivo nesta máquina. Não fala com a rede.
 *
 * Exportada porque a PRÉVIA da página de configurações usa exatamente isto — a
 * prévia toca só para você, mesmo dentro de uma sala.
 */
export function tocarLocalmente(som: EfeitoSonoro): void {
  if (som.url === undefined || total >= SIMULTANEOS) return;

  const audio = new Audio(som.url);
  audio.volume = volumeFinal(som.volume, lerVolumeDoPainel());

  /* A saída escolhida em Voz e vídeo — sem isto o som sairia no alto-falante
     enquanto a sala toca no fone. `setSinkId` não existe em todo navegador. */
  const saida = lerPreferenciasDeVoz().saidaId;
  const comSaida = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  if (saida !== undefined && comSaida.setSinkId) void comSaida.setSinkId(saida).catch(() => {});

  let solto = false;
  const soltar = () => {
    if (solto) return;
    solto = true;
    total -= 1;
    const vivos = tocandoAgora.get(som.id);
    vivos?.delete(audio);
    if (!vivos || vivos.size === 0) {
      tocandoAgora.delete(som.id);
      marcarTocando(som.id, false);
    }
  };

  total += 1;
  const vivos = tocandoAgora.get(som.id) ?? new Map<HTMLAudioElement, () => void>();
  vivos.set(audio, soltar);
  tocandoAgora.set(som.id, vivos);
  marcarTocando(som.id, true);
  audio.addEventListener("ended", soltar, { once: true });
  audio.addEventListener("error", soltar, { once: true });
  void audio.play().catch(soltar);
}

/**
 * Toca para a sala: primeiro aqui, depois pede ao servidor que avise os outros.
 *
 * Local ANTES do POST: quem clica não espera a rede para ouvir o que clicou.
 * Se o servidor recusar (sem permissão, fora da sala), o toast diz — o som já
 * tocou só para quem clicou, que é o erro menos ruim.
 */
export function tocarNaSala(channelId: string, som: EfeitoSonoro): void {
  tocarLocalmente(som);
  if (!conectado()) return;
  void client.api
    .post(`/channels/${channelId}/soundboard/${som.id}` as never)
    .catch((e: unknown) => {
      toast({
        tipo: "erro",
        titulo: "A sala não ouviu o som.",
        descricao: motivoDoErro(e),
      });
    });
}

/**
 * O evento de alguém tocando um som. Exportada para teste.
 *
 * Toca só se: estou DENTRO da chamada daquele canal, não fui eu (já ouvi no
 * clique) e não estou surdo — ensurdecer é "não quero ouvir a sala", e a sala
 * inclui os sons dela.
 */
export function aoTocarNaSala(evento: unknown, tocar = tocarLocalmente): boolean {
  const e = evento as { channel_id?: unknown; user_id?: unknown; sound?: unknown } | null;
  const som = paraEfeitoSonoro(e?.sound);
  if (!e || !som || typeof e.channel_id !== "string") return false;

  const chamada = lerChamada();
  if (chamada.estado !== "dentro" || chamada.channelId !== e.channel_id) return false;
  if (e.user_id === client.user?.id) return false;
  if (chamada.surdo) return false;

  tocar(som);
  return true;
}
