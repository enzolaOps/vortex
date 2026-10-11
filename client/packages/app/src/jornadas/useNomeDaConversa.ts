import { useChannel, usePessoa } from "nucleo/store/hooks";

import { casa } from "../textos";

interface CanalParaNome {
  readonly tipo: string;
  readonly name?: string | undefined;
}

interface PessoaParaNome {
  readonly displayName?: string | undefined;
  readonly username?: string | undefined;
}

const preenchido = (texto: string | undefined): string | undefined => {
  const limpo = texto?.trim();
  return limpo === undefined || limpo === "" ? undefined : limpo;
};

/**
 * O nome exibível de uma conversa, SEMPRE definido. DM não tem `name` no
 * protocolo: o nome é o da pessoa do outro lado, e enquanto ela não carregou
 * a conversa se chama "Conversa" (nunca vazio, nunca "undefined").
 */
export function nomeDaConversa(canal: CanalParaNome | undefined, pessoa: PessoaParaNome | undefined): string {
  if (canal?.tipo === "notas") return casa.conversa.notasTitulo;
  if (canal?.tipo === "grupo") return preenchido(canal.name) ?? casa.conversa.grupoSemNome;
  if (canal?.tipo === "dm") {
    return preenchido(pessoa?.displayName) ?? preenchido(pessoa?.username) ?? casa.conversa.semNome;
  }
  return preenchido(canal?.name) ?? casa.conversa.semNome;
}

/** O nome da conversa, assinando o canal e a pessoa do outro lado: atualiza quando ela chega. */
export function useNomeDaConversa(canalId: string): string {
  const canal = useChannel(canalId);
  const pessoa = usePessoa(canal?.tipo === "dm" ? (canal.destinatarioId ?? "") : "");
  return nomeDaConversa(canal, pessoa);
}
