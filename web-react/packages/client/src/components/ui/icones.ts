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
 * A escala de tamanho de ícone — **a mesma que o CSS já tinha**.
 *
 * ⚠ **Ela não é nova, e eu quase a duplicei.** `tokens.css` define
 * `--vx-icon-0..3` desde antes deste arquivo, com 102 consumidores e a razão
 * escrita. Só que ela vive em CSS, e um `size={}` de TSX não a alcança — então
 * os dez tamanhos livres cresceram AO LADO dela, cada um copiado do arquivo do
 * design para dentro de um `size={}`, sem nunca colidir com nada.
 *
 * O que este objeto acrescenta é ALCANCE, não escala: os mesmos quatro
 * números, disponíveis onde o CSS não chega. `pareamento` abaixo é a amarração,
 * e um teste a confere contra o `tokens.css` — nos dois sentidos, como
 * `TokenName` já faz com as cores. Duas listas que precisam concordar e não têm
 * mecanismo sempre divergem; este projeto já registrou isso três vezes.
 *
 * Os nomes são SEMÂNTICOS aqui e ordinais lá, e isso é de propósito. Em CSS o
 * degrau aparece dentro de uma regra que já diz de que componente se trata; num
 * `size={}` solto no meio de JSX, `--vx-icon-1` não diz nada e `metadado` diz.
 *
 * - `calha` (20) — o ícone é o alvo, sozinho numa coluna própria.
 * - `controle` (16) — dentro de um botão, ao lado de outros alvos.
 * - `metadado` (14) — acompanha texto pequeno e não é alvo.
 * - `selo` (12) — dentro de um chip ou badge, onde o texto carrega o sentido.
 *
 * ⚠ **Onde o CSS dimensiona o `svg`, esta prop é MORTA.** Medido em navegador:
 * 43 ícones da tela inicial trazem `size={20}` no TSX e desenham 12 ou 14,
 * porque uma regra como `.acoes svg { inline-size: var(--vx-icon-1) }` vence a
 * prop. O número no TSX não é o da tela — é a família do comentário que afirma
 * uma medida que não existe. Está na tabela de pendências do `CLAUDE.md`;
 * limpar exige varrer os consumidores um a um, decidindo em cada um quem deve
 * ser o dono.
 */
export const ICONE = {
  /**
   * O ícone É a ilustração, e não acompanha nada.
   *
   * ⚠ **Único degrau SEM par em CSS**, e o `pareamento` abaixo o registra como
   * tal — o default de um degrau sem justificativa é reprovar. Ele existe
   * porque nasceu em TSX e nunca teve consumidor de CSS: o glifo do diálogo de
   * atualização obrigatória, onde o ícone carrega a mensagem sozinho. Havendo
   * texto ao lado disputando a atenção, o degrau é `calha`.
   *
   * ⚠ **Este degrau só apareceu ao APLICAR a escala, e o inventário o tinha
   * perdido.** A varredura casava `<Icone … size={N}>` numa linha só, e o
   * único uso de 32 está em JSX quebrado em cinco linhas. Contei "zero usos de
   * 32" e o `typecheck` me desmentiu.
   */
  ilustracao: 32,
  calha: 20,
  controle: 16,
  metadado: 14,
  selo: 12,
} as const;

export type TamanhoDeIcone = (typeof ICONE)[keyof typeof ICONE];

/**
 * Qual degrau daqui é qual custom property do `tokens.css`.
 *
 * `null` quer dizer "não tem par, e eis a razão" — a mesma disciplina de
 * `SEM_PAR` no contraste. O teste exige as DUAS direções: degrau sem entrada
 * aqui reprova, e entrada apontando para uma var que sumiu do CSS também.
 */
export const pareamento = {
  ilustracao: null, // nasceu em TSX, nenhum CSS o dimensiona
  calha: "--vx-icon-3",
  controle: "--vx-icon-2",
  metadado: "--vx-icon-1",
  selo: "--vx-icon-0",
} as const satisfies Record<keyof typeof ICONE, string | null>;
