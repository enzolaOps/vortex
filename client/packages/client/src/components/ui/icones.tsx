/**
 * Ponto único de ícone. Call sites importam daqui, nunca do pacote.
 *
 * Remix Fill por padrão; Line em CONTORNO (preencher mudaria a forma).
 * `weight` do Phosphor é engolido aqui — Remix não tem.
 */
import type { ComponentType, SVGProps } from "react";
import {
  RiAccountCircleFill,
  RiAddLine,
  RiAlertFill,
  RiArrowDownLine,
  RiArrowDownSLine,
  RiArrowGoBackFill,
  RiArrowGoForwardFill,
  RiArrowLeftLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiAtLine,
  RiBarChartFill,
  RiBold,
  RiChat1Fill,
  RiChat3Fill,
  RiCheckLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiCloseLine,
  RiComputerFill,
  RiDeleteBin6Fill,
  RiDiscussFill,
  RiDownload2Fill,
  RiDraggable,
  RiEmojiStickerFill,
  RiEmotionHappyFill,
  RiErrorWarningFill,
  RiExpandDiagonalFill,
  RiExternalLinkFill,
  RiEyeFill,
  RiEyeOffFill,
  RiFileCopyFill,
  RiFileDownloadFill,
  RiFileGifFill,
  RiFolderAddFill,
  RiForbidFill,
  RiGroupLine,
  RiHammerFill,
  RiHashtag,
  RiHeadphoneFill,
  RiHistoryFill,
  RiInbox2Fill,
  RiInformationFill,
  RiItalic,
  RiLink,
  RiListCheck,
  RiLock2Fill,
  RiLockFill,
  RiLogoutBoxRFill,
  RiLoopLeftFill,
  RiMailFill,
  RiMailLine,
  RiMicFill,
  RiMicOffLine,
  RiMoreLine,
  RiMusic2Fill,
  RiNotification3Fill,
  RiNotificationOffLine,
  RiPauseFill,
  RiPencilFill,
  RiPhoneFill,
  RiPictureInPicture2Fill,
  RiPlayFill,
  RiPushpinFill,
  RiPushpinLine,
  RiRefreshFill,
  RiSearchLine,
  RiSendPlane2Fill,
  RiSettings3Fill,
  RiSettings4Fill,
  RiShieldCheckFill,
  RiShutDownLine,
  RiSquareLine,
  RiStarFill,
  RiStickyNoteFill,
  RiSubtractLine,
  RiTeamLine,
  RiTrophyFill,
  RiUnpinLine,
  RiUpload2Fill,
  RiUserAddFill,
  RiUserFill,
  RiVideoFill,
  RiVideoOffFill,
  RiVolumeMuteFill,
  RiVolumeUpFill,
  RiWifiLine,
  RiWifiOffLine,
} from "@remixicon/react";

type PropsDeIcone = SVGProps<SVGSVGElement> & {
  size?: number | string;
  color?: string;
  weight?: string;
};

type Remix = ComponentType<{
  size?: number | string;
  color?: string;
  className?: string;
}>;

function vx(Icone: Remix): ComponentType<PropsDeIcone> {
  function IconeVx({ weight, size, color, className, ...rest }: PropsDeIcone) {
    void weight;
    return (
      <Icone size={size} color={color} className={className} {...rest} />
    );
  }
  IconeVx.displayName = "Icone";
  return IconeVx;
}

function comPeso(Fill: Remix, Line: Remix): ComponentType<PropsDeIcone> {
  function Icone({ weight, size, color, className, ...rest }: PropsDeIcone) {
    const C = weight === "regular" ? Line : Fill;
    return <C size={size} color={color} className={className} {...rest} />;
  }
  Icone.displayName = "comPeso";
  return Icone;
}

export const ArrowBendUpLeft = vx(RiArrowGoBackFill);
export const ArrowBendUpRight = vx(RiArrowGoForwardFill);
export const ArrowClockwise = vx(RiRefreshFill);
export const ArrowCounterClockwise = vx(RiArrowGoBackFill);
export const ArrowSquareOut = vx(RiExternalLinkFill);
export const ArrowsClockwise = vx(RiLoopLeftFill);
export const ArrowsOut = vx(RiExpandDiagonalFill);
export const BellSimple = vx(RiNotification3Fill);
export const ChartBar = vx(RiBarChartFill);
export const ChatCircle = vx(RiChat1Fill);
export const ChatCircleDots = vx(RiChat3Fill);
export const ChatsCircle = vx(RiDiscussFill);
export const CheckCircle = vx(RiCheckboxCircleFill);
export const ClockCounterClockwise = vx(RiHistoryFill);
export const Copy = vx(RiFileCopyFill);
export const DownloadSimple = vx(RiDownload2Fill);
export const Eye = vx(RiEyeFill);
export const EyeSlash = vx(RiEyeOffFill);
export const FileArrowDown = vx(RiFileDownloadFill);
export const FolderSimplePlus = vx(RiFolderAddFill);
export const Gear = vx(RiSettings3Fill);
export const GearSix = vx(RiSettings4Fill);
export const Gif = vx(RiFileGifFill);
export const Hammer = vx(RiHammerFill);
export const Headphones = vx(RiHeadphoneFill);
export const Info = vx(RiInformationFill);
export const Lock = vx(RiLockFill);
export const LockSimple = vx(RiLock2Fill);
export const Microphone = vx(RiMicFill);
export const Monitor = vx(RiComputerFill);
export const MusicNotes = vx(RiMusic2Fill);
export const Note = vx(RiStickyNoteFill);
export const PaperPlaneRight = vx(RiSendPlane2Fill);
export const Pause = vx(RiPauseFill);
export const PencilSimple = vx(RiPencilFill);
export const Phone = vx(RiPhoneFill);
export const PhoneX = vx(RiCloseCircleFill);
export const PictureInPicture = vx(RiPictureInPicture2Fill);
export const Play = vx(RiPlayFill);
export const ProhibitInset = vx(RiForbidFill);
export const Rows = vx(RiListCheck);
export const ShieldCheck = vx(RiShieldCheckFill);
export const SignOut = vx(RiLogoutBoxRFill);
export const Smiley = vx(RiEmotionHappyFill);
export const SpeakerHigh = vx(RiVolumeUpFill);
export const SpeakerSlash = vx(RiVolumeMuteFill);
export const Star = vx(RiStarFill);
export const Sticker = vx(RiEmojiStickerFill);
export const Trash = vx(RiDeleteBin6Fill);
export const Tray = vx(RiInbox2Fill);
export const Trophy = vx(RiTrophyFill);
export const UploadSimple = vx(RiUpload2Fill);
export const User = vx(RiUserFill);
export const UserCircle = vx(RiAccountCircleFill);
export const UserPlus = vx(RiUserAddFill);
export const VideoCamera = vx(RiVideoFill);
export const VideoCameraSlash = vx(RiVideoOffFill);
export const WarningCircle = vx(RiErrorWarningFill);
export const WarningOctagon = vx(RiAlertFill);

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

export const ArrowDown = vx(RiArrowDownLine);
export const ArrowLeft = vx(RiArrowLeftLine);
export const At = vx(RiAtLine);
export const BellSimpleSlash = vx(RiNotificationOffLine);
export const CaretDown = vx(RiArrowDownSLine);
export const CaretLeft = vx(RiArrowLeftSLine);
export const CaretRight = vx(RiArrowRightSLine);
export const Check = vx(RiCheckLine);
export const DotsSixVertical = vx(RiDraggable);
export const DotsThree = vx(RiMoreLine);
export const Hash = vx(RiHashtag);
export const Link = vx(RiLink);
export const LinkSimple = vx(RiLink);
export const MagnifyingGlass = vx(RiSearchLine);
export const MicrophoneSlash = vx(RiMicOffLine);
export const Minus = vx(RiSubtractLine);
export const Plus = vx(RiAddLine);
export const Power = vx(RiShutDownLine);
export const PushPinSlash = vx(RiUnpinLine);
export const Square = vx(RiSquareLine);
export const TextB = vx(RiBold);
export const TextItalic = vx(RiItalic);
export const Users = vx(RiGroupLine);
export const UsersThree = vx(RiTeamLine);
export const WifiHigh = vx(RiWifiLine);
export const WifiSlash = vx(RiWifiOffLine);
export const X = vx(RiCloseLine);

export const Envelope = comPeso(RiMailFill, RiMailLine);
export const EnvelopeSimple = Envelope;
export const PushPin = comPeso(RiPushpinFill, RiPushpinLine);

export type { PropsDeIcone };

export const ICONE = {
  ilustracao: 32,
  calha: 24,
  controle: 18,
  metadado: 16,
  selo: 14,
} as const;

export type TamanhoDeIcone = (typeof ICONE)[keyof typeof ICONE];

export const pareamento = {
  ilustracao: null,
  calha: "--vx-icon-3",
  controle: "--vx-icon-2",
  metadado: "--vx-icon-1",
  selo: "--vx-icon-0",
} as const satisfies Record<keyof typeof ICONE, string | null>;

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
