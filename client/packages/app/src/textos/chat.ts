import { plural } from "nucleo/lib/plural";

export const chat = {
  mensagem: "Mensagem",
  campoDeMensagem: "Escrever mensagem",
  placeholderDoCampo: (canal: string) => `Conversar em ${canal}`,
  enviar: "Enviar",
  responder: "Responder",
  anexar: "Anexar arquivo",
  semMensagens: "Ainda não há mensagens aqui.",
  falhaNoEnvio: "Não foi possível enviar a mensagem.",
  novasMensagens: (n: number) => plural(n, "nova mensagem", "novas mensagens"),
  digitando: (nome: string) => `${nome} está digitando…`,
  editada: "editada",
  listaDeMensagens: "Mensagens",
  autorDesconhecido: "Alguém",
  eventoDoCanal: "Aconteceu algo no canal.",
  comecoDoCanal: "Este é o começo do canal.",
} as const;
