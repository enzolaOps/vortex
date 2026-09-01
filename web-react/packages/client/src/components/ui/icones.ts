/**
 * O ponto único de ícone do Vortex.
 *
 * ⚠ **Ele não existia, e a ausência tinha custo medido.** 56 arquivos
 * importavam `@phosphor-icons/react` direto, com 89 ícones distintos em DEZ
 * tamanhos diferentes — 20, 17, 16, 15, 14, 13, 12, 11, 10 e 32. `size={17}`
 * ao lado de `size={15}` na mesma barra é o que faz um conjunto parecer
 * desalinhado, muito mais do que a escolha do desenho.
 *
 * ⚠ **Reexportação e não wrapper, de propósito.** Um `<Icone nome="hash" />`
 * exigiria uma união de 89 nomes, perderia o autocompletar por símbolo e
 * quebraria o tree-shaking — o bundle passaria a carregar os 89 sempre. O que
 * este arquivo entrega é a FRONTEIRA: um lugar onde a família está escrita.
 *
 * ⚠ **A fronteira é lint, não convenção** — `@phosphor-icons/react` só pode
 * ser importado aqui, pela mesma regra e pela mesma razão que confina o Radix
 * e o `stoat.js`. Sem ela, o primeiro `import { Hash } from
 * "@phosphor-icons/react"` numa feature transforma troca de família em
 * varredura de 56 arquivos.
 *
 * ## Por que Phosphor, e o que foi medido antes de decidir
 *
 * A pergunta "qual biblioteca tem os melhores ícones" foi respondida com
 * número em vez de gosto. Contra o **Radix Icons** (318 ícones, a alternativa
 * considerada): **28 dos nossos 89 não têm equivalente** — e não são
 * marginais. Falta a superfície de voz INTEIRA (`Microphone`, `SpeakerHigh`,
 * `Headphones`, `Phone`, `VideoCamera`, `PictureInPicture`…), falta `Hash`,
 * que é o ícone mais usado do app, e faltam as ferramentas do composer
 * (`TextB`, `Gif`, `Sticker`).
 *
 * O Radix Icons é um set de CROMO — setas, chevrons, alinhamento —, feito para
 * a documentação do Radix. Ele não tem vocabulário de chat. Adotá-lo custaria
 * desenhar 28 ícones ou conviver com dois sets, e o `CLAUDE.md` registra que o
 * upstream tinha QUATRO sets e chama isso de "dívida herdada aqui, não risco
 * hipotético".
 *
 * Phosphor tem ~9.000 ícones em seis pesos, licença MIT, e — o que decide — os
 * pesos `fill` e `duotone` que este app usa para ESTADO (ponto de presença,
 * alfinete fixado). Lucide e Feather são só contorno: migrar significaria
 * trocar cada estado preenchido por outro desenho, não por outro peso.
 *
 * ⚠ **Isto não fecha a porta.** Com este arquivo, trocar de família passa a
 * ser UM arquivo em vez de 56 — que é exatamente o que a decisão de hoje
 * comprou.
 */
export {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsOut,
  At,
  BellSimple,
  BellSimpleSlash,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChatCircle,
  ChatCircleDots,
  ChatsCircle,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  Copy,
  DotsSixVertical,
  DotsThree,
  DownloadSimple,
  Envelope,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  FileArrowDown,
  FolderSimplePlus,
  Gear,
  GearSix,
  Gif,
  Hammer,
  Hash,
  Headphones,
  Info,
  Link,
  LinkSimple,
  Lock,
  LockSimple,
  MagnifyingGlass,
  Microphone,
  MicrophoneSlash,
  Minus,
  Monitor,
  MusicNotes,
  Note,
  PaperPlaneRight,
  Pause,
  PencilSimple,
  Phone,
  PhoneX,
  PictureInPicture,
  Play,
  Plus,
  Power,
  ProhibitInset,
  PushPin,
  PushPinSlash,
  Rows,
  ShieldCheck,
  SignOut,
  Smiley,
  SpeakerHigh,
  SpeakerSlash,
  Square,
  Star,
  Sticker,
  TextB,
  TextItalic,
  Trash,
  Tray,
  Trophy,
  UploadSimple,
  User,
  UserCircle,
  UserPlus,
  Users,
  UsersThree,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
  WarningOctagon,
  WifiHigh,
  WifiSlash,
  X,
} from "@phosphor-icons/react";

/**
 * A escala de tamanho de ícone.
 *
 * ⚠ **Fechada, e é a metade do conserto que se vê na tela.** Os dez tamanhos
 * livres não eram escolha de ninguém: cada um saiu de copiar o número do
 * arquivo do design para dentro de um `size={}`. É o mesmo defeito que a
 * escala de espaçamento já resolveu para o resto do app — valor solto em
 * componente —, e a resposta é a mesma: degrau nomeado.
 *
 * Quatro degraus, e cada um responde a uma pergunta diferente:
 *
 * - `calha` — o ícone é o alvo, e está sozinho numa coluna própria: avatar de
 *   canal de voz, ícone da linha de canal.
 * - `controle` — o ícone está DENTRO de um botão, ao lado de mais alvos: barra
 *   de ações, doca de chamada, cabeçalho.
 * - `metadado` — o ícone acompanha texto pequeno e não é alvo: estado de
 *   presença na linha, glifo de anexo.
 * - `selo` — dentro de um chip ou badge, onde o texto já carrega o sentido.
 *
 * ⚠ **Não há degrau abaixo de 12.** Phosphor é desenhado em canvas grande e o
 * traço não se alinha ao pixel: abaixo disso o `regular` some contra
 * `surface-2`. Se algum lugar parecer pedir 10, o que ele pede é `selo` com
 * mais respiro em volta.
 */
export const ICONE = {
  calha: 20,
  controle: 16,
  metadado: 14,
  selo: 12,
} as const;

export type TamanhoDeIcone = (typeof ICONE)[keyof typeof ICONE];
