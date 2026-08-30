import { useSyncExternalStore, type ComponentType } from "react";

import { Paleta } from "../../paleta/Paleta";
import { AdicionarServidor } from "../../servidores/AdicionarServidor";
import { ModalDeCanal } from "../../servidores/ModalDeCanal";
import { ModalDeConvite } from "../../servidores/ModalDeConvite";
import { ModalDeExclusao } from "../../servidores/ModalDeExclusao";
import { ModalDeModeracao } from "../../servidores/ModalDeModeracao";
import { AvisoDeLink } from "../../list/AvisoDeLink";
import { Encaminhar } from "../../list/Encaminhar";
import { CriarEnquete } from "../../enquete/CriarEnquete";
import { VisualizadorDeImagem } from "../../list/VisualizadorDeImagem";
import {
  assinarModal,
  fecharModal,
  lerModal,
  type ModalId,
} from "../../store/modais";
import { GerenciarGrupo } from "../../casa/GerenciarGrupo";
import { NovoGrupo } from "../../casa/NovoGrupo";

/**
 * O registro de modais, e o ponto dele é o TIPO.
 *
 * `Record<ModalId, ComponentType>` faz modal novo não compilar até ser
 * registrado aqui — mesma mecânica de `NOME_DO_PAINEL` sobre `PainelId`. Sem
 * isso, acrescentar um `ModalId` e esquecer de registrar daria um modal que
 * "abre" e não renderiza nada: um estado inconsistente sem erro, que é a
 * família de defeito que este projeto mais persegue.
 *
 * Cada componente recebe `aoFechar` e mais nada. Modal que precise de alvo —
 * "apagar ESTA mensagem" — lê o alvo do próprio store, como
 * `store/menuDeMensagem.ts` já faz para o menu de contexto da lista. Passar
 * dados por aqui exigiria tipar a carga por ID, e o benefício não paga a
 * generalidade.
 */
const REGISTRO: Record<ModalId, ComponentType<{ aoFechar: () => void }>> = {
  paleta: Paleta,
  adicionarServidor: AdicionarServidor,
  canal: ModalDeCanal,
  exclusao: ModalDeExclusao,
  convite: ModalDeConvite,
  moderar: ModalDeModeracao,
  imagem: VisualizadorDeImagem,
  link: AvisoDeLink,
  encaminhar: Encaminhar,
  enquete: CriarEnquete,
  novoGrupo: NovoGrupo,
  grupo: GerenciarGrupo,
};

/**
 * Monta o modal aberto, se houver.
 *
 * Montado UMA vez na camada `sobreposto` do shell. Renderiza `null` quase
 * sempre, e é assim que ele custa nada: um `useSyncExternalStore` sobre uma
 * string, comparada por valor.
 *
 * **Montar em vez de esconder** é o que faz cada modal nascer limpo — sem
 * efeito de limpeza, sem estado velho por um quadro. A paleta já dependia
 * disso para a busca começar vazia a cada abertura.
 */
export function Modais() {
  const aberto = useSyncExternalStore(assinarModal, lerModal);
  if (aberto === null) return null;

  const Conteudo = REGISTRO[aberto];
  return <Conteudo aoFechar={fecharModal} />;
}
