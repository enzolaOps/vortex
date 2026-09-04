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
import type { ComponentProps, ComponentType } from "react";

export {
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsOut,
  BellSimple,
  ChartBar,
  ChatCircle,
  ChatCircleDots,
  ChatsCircle,
  CheckCircle,
  ClockCounterClockwise,
  Copy,
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
  Headphones,
  Info,
  Lock,
  LockSimple,
  Microphone,
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
  ProhibitInset,
  PushPin,
  Rows,
  ShieldCheck,
  SignOut,
  Smiley,
  SpeakerHigh,
  SpeakerSlash,
  Star,
  Sticker,
  Trash,
  Tray,
  Trophy,
  UploadSimple,
  User,
  UserCircle,
  UserPlus,
  VideoCamera,
  VideoCameraSlash,
  WarningCircle,
  WarningOctagon,
} from "@phosphor-icons/react";

/**
 * Os ícones que NÃO podem ser preenchidos — e a razão é medida.
 *
 * ⚠ **O `fill` do Phosphor faz DUAS coisas diferentes conforme o ícone.**
 * Em uns ele solidifica a MESMA forma — sino, cadeado, microfone, câmera,
 * monitor: a silhueta já era o ícone, e preencher só a torna firme. Em
 * outros ele desenha OUTRA forma: o glifo vazado dentro de um quadrado ou
 * círculo. `X`, `Plus` e `Check` são os TRÊS ícones mais usados deste app, e
 * os três caem no segundo grupo — viram uma caixa com o sinal recortado.
 *
 * O critério é a interseção sobre união da SILHUETA (a área que o contorno
 * externo encerra) entre `fill` e `regular`, a 48px. Acima de 0,80 é a mesma
 * forma; abaixo é outra. Os dados têm um vão claro entre 0,45 e 0,57, e a
 * lista pega tudo abaixo de 0,80 — conservador de propósito, porque ícone
 * que muda de FORMA é pior que ícone que muda de PESO.
 *
 * | ícone | IoU | | ícone | IoU |
 * | --- | --- | --- | --- | --- |
 * | `DotsThree` | 0,07 | | `Hash` | 0,42 |
 * | `Check` | 0,13 | | `CaretDown` | 0,43 |
 * | `Plus` | 0,20 | | `TextB` | 0,57 |
 * | `X` | 0,21 | | `Users` | 0,66 |
 * | `Link` | 0,28 | | `MicrophoneSlash` | 0,79 |
 *
 * ⚠ **A referência de qualidade resolve do mesmo jeito, e foi ela que
 * confirmou a regra.** No conjunto do Discord, `guildCross` é um X de TRAÇO
 * dentro de um círculo vermelho — o círculo é crachá semântico, não o ícone
 * — e `guildCheck` é um ✓ de traço grosso, sem caixa nenhuma. Massa sólida
 * onde a silhueta é o ícone; traço grosso onde o glifo é traço. **O conjunto
 * que parece coeso não usa um peso só** — foi essa a leitura errada que
 * quase me fez preencher tudo.
 *
 * ⚠ **Duas entradas são JULGAMENTO e não medição, e ficam marcadas como tal.**
 * `MagnifyingGlass` e `Square` PASSAM no teste de silhueta — a lupa preenchida
 * ainda é círculo com cabo, o quadrado ainda é quadrado. O que elas perdem é
 * uma ABERTURA, e abertura é semântica: a lente significa "você vê através", e
 * o quadrado da barra de título é o contorno de uma JANELA, no botão de
 * maximizar. Preenchidos, viram pirulito e bloco. Tentei medir isso e a métrica
 * super-selecionou — ela acusava `BellSimple`, `Microphone` e `VideoCamera`,
 * que são justamente os que ficam ótimos sólidos, porque o miolo deles nunca
 * foi a identidade. Não há régua aqui; há uma pergunta: o vão quer dizer
 * alguma coisa?
 *
 * ⚠ **A família `*Slash` está aqui por SEMÂNTICA, não só por forma.** A
 * barra que cruza o microfone é a diferença entre transmitindo e mudo, e
 * preenchida ela funde com o corpo. Errar isso é a interface afirmando o
 * contrário do que está acontecendo — a mesma classe de defeito do
 * `aria-pressed` com rótulo que alterna.
 */
export const CONTORNO = [
  "ArrowDown",
  "ArrowLeft",
  "At",
  "BellSimpleSlash",
  "CaretDown",
  "CaretLeft",
  "CaretRight",
  "Check",
  "DotsSixVertical",
  "DotsThree",
  "Hash",
  "Link",
  "LinkSimple",
  "MagnifyingGlass",
  "MicrophoneSlash",
  "Minus",
  "Plus",
  "Power",
  "PushPinSlash",
  "Square",
  "TextB",
  "TextItalic",
  "Users",
  "UsersThree",
  "WifiHigh",
  "WifiSlash",
  "X",
] as const;

/**
 * ⚠ **`{...props}` DEPOIS do `weight`**, e a ordem é o mecanismo: quem passar
 * peso explícito continua vencendo. É a mesma precedência que faz o `fill` de
 * ESTADO (ponto de presença, alfinete fixado) sobreviver ao padrão.
 */
function deContorno<P extends { weight?: unknown }>(
  Icone: ComponentType<P>,
): ComponentType<P> {
  const Envolvido = (props: P) => <Icone weight="bold" {...props} />;
  Envolvido.displayName = "deContorno";
  return Envolvido;
}

import {
  ArrowDown as ArrowDownBase,
  ArrowLeft as ArrowLeftBase,
  At as AtBase,
  BellSimpleSlash as BellSimpleSlashBase,
  CaretDown as CaretDownBase,
  CaretLeft as CaretLeftBase,
  CaretRight as CaretRightBase,
  Check as CheckBase,
  DotsSixVertical as DotsSixVerticalBase,
  DotsThree as DotsThreeBase,
  Hash as HashBase,
  Link as LinkBase,
  LinkSimple as LinkSimpleBase,
  MagnifyingGlass as MagnifyingGlassBase,
  MicrophoneSlash as MicrophoneSlashBase,
  Minus as MinusBase,
  Plus as PlusBase,
  Power as PowerBase,
  PushPinSlash as PushPinSlashBase,
  Square as SquareBase,
  TextB as TextBBase,
  TextItalic as TextItalicBase,
  Users as UsersBase,
  UsersThree as UsersThreeBase,
  WifiHigh as WifiHighBase,
  WifiSlash as WifiSlashBase,
  X as XBase,
} from "@phosphor-icons/react";

export const ArrowDown = deContorno(ArrowDownBase);
export const ArrowLeft = deContorno(ArrowLeftBase);
export const At = deContorno(AtBase);
export const BellSimpleSlash = deContorno(BellSimpleSlashBase);
export const CaretDown = deContorno(CaretDownBase);
export const CaretLeft = deContorno(CaretLeftBase);
export const CaretRight = deContorno(CaretRightBase);
export const Check = deContorno(CheckBase);
export const DotsSixVertical = deContorno(DotsSixVerticalBase);
export const DotsThree = deContorno(DotsThreeBase);
export const Hash = deContorno(HashBase);
export const Link = deContorno(LinkBase);
export const LinkSimple = deContorno(LinkSimpleBase);
export const MagnifyingGlass = deContorno(MagnifyingGlassBase);
export const MicrophoneSlash = deContorno(MicrophoneSlashBase);
export const Minus = deContorno(MinusBase);
export const Plus = deContorno(PlusBase);
export const Power = deContorno(PowerBase);
export const PushPinSlash = deContorno(PushPinSlashBase);
export const Square = deContorno(SquareBase);
export const TextB = deContorno(TextBBase);
export const TextItalic = deContorno(TextItalicBase);
export const Users = deContorno(UsersBase);
export const UsersThree = deContorno(UsersThreeBase);
export const WifiHigh = deContorno(WifiHighBase);
export const WifiSlash = deContorno(WifiSlashBase);
export const X = deContorno(XBase);

export type PropsDeIcone = ComponentProps<typeof XBase>;


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
 * - `calha` (24) — o ícone é o alvo, sozinho numa coluna própria.
 * - `controle` (18) — dentro de um botão, ao lado de outros alvos.
 * - `metadado` (16) — acompanha texto pequeno e não é alvo.
 * - `selo` (14) — dentro de um chip ou badge, onde o texto carrega o sentido.
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
  calha: 24,
  controle: 18,
  metadado: 16,
  selo: 14,
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

/**
 * Os tamanhos que ficam FORA da escala de propósito.
 *
 * ⚠ **Existe porque "exceção decidida" e "número esquecido" são
 * indistinguíveis olhando** — a mesma razão de `SEM_PAR` no contraste e de
 * `EXCECOES` nos pares. Sem esta lista, a única forma de saber se um `9px` era
 * escolha ou descuido é achar quem o escreveu.
 *
 * As duas entradas de hoje são medidas no design, e as duas descrevem glifos
 * que NÃO são ícones no sentido da escala: são pontuação ao lado de um rótulo.
 * Colocá-los num degrau os deixaria maiores que o texto que anotam, que é
 * exatamente o defeito que os produziu.
 *
 * O teste exige as DUAS direções: valor fora da escala que não esteja aqui
 * reprova, e entrada que voltou para a escala também — senão a lista vira
 * depósito que mente sobre uma decisão que ninguém tomou mais.
 */
export const FORA_DA_ESCALA = [
  {
    px: 9,
    onde: "canais/ListaDeCanais.module.css .chevron",
    porque:
      "Triângulo de divulgação ao lado de um rótulo de 11px em caixa alta. " +
      "Em 14 ficava MAIOR que o texto que acompanha, e era o que mais " +
      "denunciava a categoria. 9px é também o rótulo de pasta no rail — os " +
      "dois casos em que o design escreve abaixo do menor degrau tipográfico.",
  },
  {
    px: 13,
    onde: "components/ui/BotaoDeIcone.module.css .xs svg, .sm svg",
    porque:
      "O glifo acompanha o alvo mas não é o alvo: 13 dentro de 28 é o do " +
      "design. Subir para 14 apagaria o degrau contra `.md`/`.lg`, que já " +
      "são 14; descer para 12 é menor do que o design desenha.",
  },
] as const;
