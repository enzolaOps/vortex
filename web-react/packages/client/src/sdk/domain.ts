/**
 * Tipos de domínio do Vortex.
 *
 * Declarados pelo app, NUNCA derivados dos tipos do `stoat.js`. Derivar faria a
 * forma do protocolo vazar para todo componente que lê um snapshot, e aí a
 * primeira feature que o Stoat não tem viraria refactor do app inteiro.
 *
 * Este arquivo não importa `stoat.js`. Se algum dia importar, a desvinculação
 * acabou — o lint de boundary existe para impedir isso.
 */

/** Estado de envio. Vive no cliente; o protocolo não tem esse conceito. */
import type { Enquete } from "../store/enquetes";

/**
 * ⚠ **`subindo` é ANTES de `pending`, e os dois existem porque a espera é de
 * natureza diferente.** `pending` é "o servidor ainda não confirmou" — uma
 * ida e volta, sem nada para mostrar. `subindo` é "o arquivo está saindo
 * daqui": tem duração observável, tem fração, e tem cancelamento.
 *
 * Colapsá-los daria uma linha que diz "enviando" por trinta segundos sem
 * dizer quanto falta, que é a mesma queixa que a faixa de voz resolveu ao
 * parar de inventar milissegundos.
 */
export type SendState = "subindo" | "sent" | "pending" | "failed";

/**
 * Teto de caracteres de uma mensagem.
 *
 * Declarado pelo Vortex, não lido do SDK — mesmo que hoje coincida com o do
 * Stoat. É limite de produto: o dia em que o backend divergir, quem manda é
 * esta linha, e o composer não precisa saber que houve divergência.
 */
export const LIMITE_DE_CONTEUDO = 2000;

/**
 * Onde o pedaço começa no texto original — a identidade dele.
 *
 * Existe por causa do lint que proíbe índice como `key`, e a regra tem razão
 * mesmo aqui, onde os pedaços não reordenam: o deslocamento vem do DADO e o
 * índice vem da posição no array. Dois `<@fulano>` na mesma frase são coisas
 * diferentes, e só o deslocamento sabe disso.
 */
type ComPosicao = { readonly de: number };

/**
 * Um trecho INLINE de mensagem.
 *
 * `valor` na menção é o ID de quem foi mencionado, não o nome — quem resolve
 * nome é o componente, que já assina o membro. Guardar o nome aqui congelaria
 * um apelido que muda.
 *
 * `enfase`, `forte`, `riscado` e `link` carregam filhos porque markdown
 * aninha: `**negrito com [link](…)**` é uma coisa só, e uma lista plana não
 * sabe representá-la. Quem monta esta árvore é `markdown/analisar.ts`.
 */
export type TrechoDeMensagem =
  | (ComPosicao & { readonly tipo: "texto"; readonly valor: string })
  | (ComPosicao & { readonly tipo: "mencao"; readonly valor: string })
  /**
   * Emoji personalizado do servidor. `valor` é o ID.
   *
   * ⚠ **O ID e não a URL, ao contrário de `avatarUrl` e `iconeUrl`.** Aqueles
   * são derivados na escrita porque montar a URL exigiria que o componente
   * soubesse do `autumn`; aqui a árvore de markdown é CACHEADA por conteúdo,
   * e assar a URL nela a congelaria — o endereço do servidor de mídia vem da
   * configuração, que só existe depois da conexão, e a mesma mensagem pode
   * ser analisada antes dela. Quem resolve é `urlDeEmoji`, em `sdk/`.
   *
   * ⚠ **Emoji Unicode NÃO passa por aqui.** Ele é texto e o navegador o
   * desenha; um tipo para ele seria trabalho por nada no componente mais
   * quente do app. Só o personalizado precisa virar imagem.
   */
  | (ComPosicao & { readonly tipo: "emoji"; readonly valor: string })
  | (ComPosicao & { readonly tipo: "codigo"; readonly valor: string })
  | (ComPosicao & { readonly tipo: "quebra" })
  | (ComPosicao & {
      readonly tipo: "enfase" | "forte" | "riscado";
      readonly filhos: readonly TrechoDeMensagem[];
    })
  | (ComPosicao & {
      readonly tipo: "link";
      /**
       * Já validada em `hrefSeguro`. Só `http:`, `https:` e `mailto:` chegam
       * aqui — o resto virou texto antes, e o tipo não carrega o inseguro.
       */
      readonly href: string;
      readonly filhos: readonly TrechoDeMensagem[];
    });

export type ItemDeLista = ComPosicao & {
  readonly filhos: readonly BlocoDeMensagem[];
};

/**
 * Um bloco de mensagem — o nível de cima da árvore.
 *
 * A separação entre bloco e trecho não é cerimônia: bloco ocupa linha e muda a
 * ALTURA da linha de mensagem, e altura é o que o virtualizador estima. Ter os
 * dois no mesmo tipo faria a estimativa ter de decidir caso a caso o que é
 * empilhado e o que é corrido.
 */
export type BlocoDeMensagem =
  | (ComPosicao & {
      readonly tipo: "paragrafo";
      readonly filhos: readonly TrechoDeMensagem[];
    })
  | (ComPosicao & {
      readonly tipo: "titulo";
      readonly nivel: 1 | 2 | 3;
      readonly filhos: readonly TrechoDeMensagem[];
    })
  | (ComPosicao & {
      readonly tipo: "blocoDeCodigo";
      readonly valor: string;
      readonly lingua: string | undefined;
    })
  | (ComPosicao & {
      readonly tipo: "citacao";
      readonly filhos: readonly BlocoDeMensagem[];
    })
  | (ComPosicao & {
      readonly tipo: "lista";
      readonly ordenada: boolean;
      readonly inicio: number;
      readonly itens: readonly ItemDeLista[];
    })
  | (ComPosicao & { readonly tipo: "regra" });

/**
 * Um anexo, já reduzido ao que a linha precisa.
 *
 * `largura` e `altura` são o ponto do tipo inteiro. Sem eles a imagem carrega
 * e MUDA a altura da linha depois de o virtualizador já a ter medido — o
 * layout shift clássico, que aqui não é só feio: a lista está ancorada, e uma
 * linha que cresce acima da âncora empurra tudo o que está sendo lido.
 *
 * O protocolo entrega os dois em `Metadata` para imagem e vídeo. Para arquivo
 * e áudio não entrega, e não precisa — eles têm altura própria e fixa.
 */
export type AnexoSnapshot = {
  readonly id: string;
  readonly nome: string;
  readonly url: string;
  /**
   * ⚠ **`audio` é tipo PRÓPRIO, e não um `arquivo` com extensão certa.**
   *
   * A diferença muda o que a linha desenha: arquivo vira um cartão com nome e
   * peso, áudio vira um player com forma de onda e posição. Deduzir isso da
   * extensão no render seria a forma do protocolo vazando para o componente
   * mais quente do app — que é o que a camada anticorrupção existe para
   * impedir. O protocolo já distingue: `Metadata.type === "Audio"`.
   */
  readonly tipo: "imagem" | "video" | "audio" | "arquivo";
  /** Só para imagem e vídeo, e é o que reserva o espaço. */
  readonly largura: number | undefined;
  readonly altura: number | undefined;
  /**
   * O tamanho do arquivo, JÁ FORMATADO.
   *
   * Derivação na escrita, como `createdAtText` e `sigla` — formatar bytes no
   * render multiplicaria um `Intl.NumberFormat` por cada re-render da linha
   * mais quente do app, e ele apareceu no firehose a 4x quando a hora era
   * formatada assim.
   *
   * `undefined` quando o protocolo não manda: o rodapé some, em vez de mostrar
   * "0 B" para um arquivo que existe.
   */
  readonly tamanhoTexto: string | undefined;
};

/**
 * O cartão de um link — o embed que o design desenha sob a mensagem do Rafa.
 *
 * ⚠ **Não é o embed do protocolo, e a distância é de propósito.** O protocolo
 * tem quatro variantes (`Website`, `Image`, `Video`, `Text`) com dezenas de
 * campos entre elas; a interface desenha UMA coisa — um cartão com origem,
 * título, resumo e miniatura. Trazer as quatro para o componente faria a forma
 * do protocolo vazar para a linha mais quente do app, que é exatamente o que a
 * camada anticorrupção existe para impedir.
 *
 * Quem gera o embed é o SERVIDOR, a partir do link — o cliente não pede nada e
 * não busca nada. É por isso que o cartão não tem estado de carregamento: ou
 * ele veio no snapshot da mensagem, ou não existe.
 *
 * ⚠ **A miniatura NÃO é buscada.** `imagemUrl` é desenhado, mas o mesmo
 * argumento da imagem de markdown vale aqui com força menor: a URL vem de um
 * terceiro. A diferença é que quem a resolveu foi o servidor, não o autor da
 * mensagem — o autor escreveu um link, e o servidor decidiu o que mostrar. Por
 * isso ela passa, e a de markdown não.
 */
export type EmbedSnapshot = {
  /** Chave de lista. O protocolo não dá id ao embed; é a URL, que é única. */
  readonly id: string;
  /** Para onde o cartão leva. `undefined` = cartão sem link, só texto. */
  readonly url: string | undefined;
  /** "vortex.dev" — a origem, e é o que ancora a confiança no cartão. */
  readonly origem: string | undefined;
  readonly titulo: string | undefined;
  readonly descricao: string | undefined;
  /** Miniatura à direita. `undefined` = cartão só de texto. */
  readonly imagemUrl: string | undefined;
  /**
   * A cor da barra à esquerda, escolhida por quem publicou.
   *
   * ⚠ **Passa pelo mesmo tratamento do cargo colorido**, e pela mesma razão: é
   * cor CRUA de terceiro, e o projeto garante contraste. Aqui ela só pinta uma
   * barra de 2px, então o risco é menor — mas a barra encosta na superfície do
   * cartão, e uma cor que suma nela é uma barra que não existe.
   */
  readonly cor: string | undefined;
};

export type MessageSnapshot = {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string | undefined;
  readonly content: string;
  /**
   * O conteúdo já em árvore: markdown analisado e menções separadas.
   *
   * Derivação na ESCRITA, como `createdAtText` — analisar no render repetiria
   * o trabalho a cada re-render da linha mais quente do app. E como a escrita
   * do snapshot também se repete (layout, envio, permissão, reação), quem
   * segura o custo de verdade é o cache por conteúdo em `markdown/analisar.ts`.
   */
  readonly blocos: readonly BlocoDeMensagem[];
  /** Menciona VOCÊ. A linha inteira se destaca. */
  readonly mencionaVoce: boolean;
  /** Anexos, já traduzidos. Vazio é o caso comum. */
  readonly anexos: readonly AnexoSnapshot[];
  readonly createdAt: number;
  /**
   * Hora já formatada. Derivação acontece no adapter, uma vez na escrita —
   * `toLocaleTimeString` no render é custo de Intl multiplicado por cada
   * re-render de linha, e apareceu no firehose a 4x.
   */
  readonly createdAtText: string;
  /**
   * A hora sem segundos — "14:02" —, para a coluna do modo compacto.
   *
   * ⚠ **Campo próprio e não um `slice` de `createdAtText`.** Cortar string
   * formatada por `Intl` é a armadilha clássica: o formato muda com o idioma
   * (`2:02 PM`), e um corte por índice acerta em português e mente em inglês.
   *
   * Derivação na ESCRITA, como `createdAtText`, `sigla` e `tamanhoTexto` — um
   * `Intl.DateTimeFormat` no render seria multiplicado por cada re-render da
   * linha mais quente do app, que é exatamente o erro nº 4 do briefing.
   */
  readonly createdAtCurto: string;
  readonly editedAt: number | undefined;
  /**
   * Presente = a linha é do SISTEMA, não de alguém.
   *
   * "Entrou", "saiu", "renomeou o canal". O protocolo carrega isso como
   * mensagem com `system`, e o cliente hoje renderiza como se fosse fala —
   * com avatar, nome e conteúdo vazio.
   *
   * É um campo do snapshot e não um tipo de linha separado por decisão de
   * arquitetura: no protocolo é a MESMA entidade, ocupa a mesma posição no
   * histórico e tem o mesmo ID. Um segundo tipo de item na lista faria os
   * índices do virtualizador deixarem de casar com os de mensagem — o mesmo
   * motivo pelo qual o divisor de data é parte da linha e não um item próprio.
   */
  readonly sistema: SistemaSnapshot | undefined;
  /**
   * IDs das mensagens a que esta responde.
   *
   * Array e não um ID só porque o protocolo permite responder a várias — raro,
   * mas representável, e achatar para uma perderia dado sem avisar. A linha
   * renderiza uma citação por item; na prática é sempre uma.
   *
   * Guarda o ID, nunca o conteúdo citado. Copiar o texto no momento da
   * resposta congelaria a citação: editar o original deixaria a citação
   * mentindo, e apagar deixaria uma cópia órfã de algo que não existe mais.
   */
  readonly respostas: readonly string[];
  /** Fixada no canal. Vem do protocolo; a lista de fixadas é derivada disto. */
  readonly fixada: boolean;
  /**
   * As reações, já achatadas e ordenadas.
   *
   * Array e não `Map<emoji, número>`: a contagem sozinha não diz se EU reagi,
   * e sem isso o chip não sabe se está aceso nem o clique sabe se adiciona ou
   * remove. Era o que faltava para as reações saírem de "renderizadas" para
   * "usáveis".
   *
   * Ordem de primeira reação, herdada da iteração do Map do SDK — estável, e
   * é o que impede os chips de dançarem quando alguém reage.
   */
  readonly reactions: readonly ReacaoSnapshot[];
  /**
   * Cartões de link, gerados pelo servidor.
   *
   * Array vazio quando não há — nunca `undefined`. Duas ausências diferentes
   * fariam a linha testar as duas, e a linha é o componente mais quente do app.
   */
  readonly embeds: readonly EmbedSnapshot[];

  /**
   * Campo do Vortex que o protocolo não carrega.
   *
   * Está aqui desde o primeiro dia de propósito: é a prova barata de que a
   * camada anticorrupção comporta um modelo mais rico que o do Stoat. O adapter
   * preenche com default; quando existir backend para isso, só o adapter muda.
   */
  readonly sendState: SendState;

  /**
   * A enquete desta mensagem, quando há.
   *
   * Campo do Vortex que o protocolo não carrega — o mesmo arranjo de
   * `sendState`, das não-lidas e do agrupamento. Entra por parâmetro no
   * `map.ts` e é o adapter que decide de onde vem; hoje vem de
   * `store/enquetes.ts`, e o dia em que o protocolo tiver enquete só o adapter
   * muda.
   *
   * `undefined` na esmagadora maioria das mensagens, que é o que o mantém
   * barato: uma comparação de referência a mais no snapshot da linha.
   */
  readonly enquete: Enquete | undefined;

  /**
   * Primeira mensagem do autor naquela janela: mostra avatar, nome e hora.
   *
   * Mensagens consecutivas do mesmo autor dentro de uma janela curta agrupam
   * sem repetir avatar e nome. É o que faz a lista parecer conversa em vez de
   * log — e é densidade, não enfeite: repetir o cabeçalho a cada linha custa
   * ~28px de altura por mensagem num app onde caber histórico é o ponto.
   */
  readonly iniciaGrupo: boolean;

  /**
   * Rótulo do divisor de data, quando esta linha abre um dia novo.
   *
   * Vive no snapshot, e não no render, porque depende da mensagem ANTERIOR — e
   * a lei nº 1 diz que a linha assina apenas a si mesma. Ler o vizinho no
   * render faria a linha re-renderizar quando o vizinho mudasse.
   *
   * O que torna isso possível: `authorId` e `createdAt` são imutáveis depois
   * da criação, então agrupamento e divisor só mudam em INSERÇÃO e REMOÇÃO,
   * nunca em edição ou reaction. O adapter recalcula nesses dois momentos e o
   * campo se comporta como qualquer outro do snapshot.
   */
  readonly dia: string | undefined;

  /**
   * Esta é a PRIMEIRA mensagem que ainda não foi lida.
   *
   * A linha desenha o divisor de "novas mensagens" acima dela. É posição, não
   * contagem — e é a diferença entre "tem 47 coisas novas" e "você parou
   * AQUI", que é a informação de que alguém precisa ao voltar a um canal.
   *
   * Campo do snapshot pelo mesmo motivo de `dia`: depende do cursor do canal,
   * que a linha não conhece nem deve conhecer.
   */
  readonly primeiraNaoLida: boolean;
};

/** Uma reação agregada. `minha` é o que faz o chip ser um botão de dois estados. */
export type ReacaoSnapshot = {
  readonly emoji: string;
  readonly total: number;
  readonly minha: boolean;
  /**
   * QUEM reagiu — os primeiros, não todos.
   *
   * O design mostra "Marina, Téo, Júlia, Rafa · e outros 3" ao pousar sobre o
   * chip, e o protocolo entrega o conjunto inteiro de IDs. Trazê-lo inteiro
   * seria copiar um `Set` de tamanho arbitrário para dentro do snapshot da
   * linha mais quente do app, a cada reação, para desenhar quatro nomes.
   *
   * `total` continua sendo a contagem VERDADEIRA; esta lista é só a amostra
   * que o tooltip nomeia. As duas juntas dão "e outros 3" sem custo.
   */
  readonly quem: readonly string[];
};

/** Quantos nomes o tooltip de reação chega a mostrar. Ver `ReacaoSnapshot.quem`. */
export const NOMES_POR_REACAO = 4;

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

/**
 * O status que EU escolho — e ele não é o mesmo tipo que o status EXIBIDO.
 *
 * A diferença é `invisivel`, e ela é a razão de existirem dois tipos em vez de
 * um. Quem escolhe invisível continua conectado, recebendo mensagem e podendo
 * responder; o que muda é que todo mundo vê `offline`. Colapsar os dois num
 * tipo só produz o defeito clássico desta tela: o menu abre com "Online"
 * marcado porque `PresenceStatus` nunca teve como dizer "invisível", e a
 * pessoa não consegue saber se a escolha dela pegou.
 *
 * `offline` NÃO está aqui de propósito: ninguém escolhe estar offline, isso é
 * consequência de fechar o app. Um item de menu que não pode ser escolhido é
 * ruído; um estado que não pode ser escolhido não deve ser representável na
 * união da escolha.
 */
export type PresencaEscolhida = "online" | "idle" | "dnd" | "invisivel";

/*
  ⚠ Não há função de conversão `PresencaEscolhida → PresenceStatus` aqui, e a
  ausência é decisão: quem faz essa conversão é o SERVIDOR. Ele recebe
  `Invisible` e passa a mandar `Offline` para todo mundo, inclusive de volta
  para mim na member list. Escrever a conversão no cliente daria um segundo
  dono da mesma regra, e o cliente perderia se os dois discordassem.
*/

export type UserSnapshot = {
  readonly id: string;
  readonly username: string;
  readonly status: PresenceStatus;
};

/* ------------------------------------------------------- colunas laterais */

/**
 * Iniciais de um nome, para o avatar sem imagem.
 *
 * Vive no snapshot e não no render pela mesma razão de `createdAtText`: é
 * derivação de escrita. Uma member list de servidor grande rola milhares de
 * linhas, e recalcular isto por render multiplicaria um `split`/`slice` por
 * cada passagem de scroll.
 */
export type ComSigla = {
  readonly sigla: string;
  /**
   * A imagem, quando o servidor de mídia tem uma.
   *
   * ⚠ **URL pronta, e não o ID do anexo.** Montar a URL no componente exigiria
   * que ele soubesse o endereço do `autumn`, que vem da configuração buscada
   * pelo SDK — ou seja, a forma do protocolo vazando para a linha de mensagem.
   * O getter do SDK (`avatarURL`, `iconURL`) já resolve isso, e chamá-lo na
   * ESCRITA é a mesma disciplina de `sigla` e `createdAtText`.
   *
   * `undefined` é o caso comum hoje e continua sendo o certo: o gradiente por
   * ID identifica melhor que uma silhueta cinza igual para todo mundo. Ver
   * `Avatar`, onde a imagem COBRE o gradiente em vez de substituí-lo.
   */
  readonly avatarUrl: string | undefined;
};

export type ServerSnapshot = ComSigla & {
  readonly id: string;
  readonly name: string;
  /**
   * Não-lidas e menções são do CLIENTE, como `sendState`.
   *
   * O protocolo tem `unread` booleano por canal; o Vortex conta. Contagem é
   * produto — é o que diferencia "tem coisa nova" de "tem 300 coisas novas" —
   * e é exatamente o tipo de divergência que a camada anticorrupção existe
   * para comportar sem tocar em componente.
   */
  readonly naoLidas: number;
  readonly mencoes: number;
};

/**
 * Uma linha do SISTEMA — "entrou", "saiu", "renomeou o canal".
 *
 * União fechada, e o texto é montado no COMPONENTE, não aqui. Guardar a frase
 * pronta no snapshot congelaria o idioma no momento em que o evento chegou: a
 * pessoa que troca de idioma veria o histórico antigo na língua antiga, e o
 * `i18n` não teria onde encostar. O domínio guarda o FATO; a frase é
 * apresentação.
 *
 * `texto` é a válvula de escape para os tipos do protocolo que este cliente
 * ainda não estrutura (fixar mensagem, chamada iniciada, troca de dono). Sem
 * ela, um tipo novo do upstream renderizaria uma linha vazia — que é pior que
 * uma linha genérica, porque não dá para diferenciar de bug.
 */
export type SistemaSnapshot =
  | { readonly tipo: "entrou" | "saiu"; readonly userId: string }
  | {
      readonly tipo: "adicionou" | "removeu";
      readonly userId: string;
      readonly porId: string;
    }
  | { readonly tipo: "renomeou"; readonly porId: string; readonly nome: string }
  | { readonly tipo: "texto"; readonly texto: string };

/**
 * O que uma linha da coluna representa.
 *
 * Cresceu na etapa 3 e a diferença não é cosmética: `texto` e `voz` são canais
 * DE SERVIDOR, e os três novos não pertencem a servidor nenhum. É por isso que
 * `ChannelSnapshot.serverId` sempre foi opcional — o domínio já comportava a
 * conversa antes de existir coluna que a mostrasse.
 *
 * `notas` é o `SavedMessages` do protocolo: a conversa consigo mesmo, que todo
 * mundo tem uma. Fica no tipo porque a coluna a trata diferente — ela não tem
 * destinatário nem presença, e chamá-la de `dm` faria a interface procurar um
 * "outro lado" que não existe.
 */
export type CanalTipo = "texto" | "voz" | "dm" | "grupo" | "notas";

/**
 * Uma categoria de canais.
 *
 * A coluna partia por TIPO — texto de um lado, voz do outro — e isso era
 * placeholder assumido: o protocolo tem `server.categories`, e quem administra
 * o servidor decide os grupos. Partir por tipo impunha uma organização que
 * ninguém pediu, e escondia a que alguém pediu.
 *
 * O tipo do canal não some: ele continua no `ChannelSnapshot`, decidindo o
 * ícone e se a linha carrega uma sala. O que muda é que ele não organiza mais
 * a coluna.
 *
 * `titulo` é `undefined` na categoria padrão — a cesta dos canais que ninguém
 * categorizou. Sem título, ela renderiza sem cabeçalho, no topo: é o que
 * significa "não está em grupo nenhum", e inventar um rótulo ("Geral",
 * "Outros") criaria um grupo que o servidor não tem.
 */
export type CategoriaDeCanais = {
  readonly id: string;
  readonly titulo: string | undefined;
  readonly canais: readonly string[];
};

/** O `id` que o protocolo dá à cesta dos não categorizados. */
export const CATEGORIA_PADRAO = "default";

export type ChannelSnapshot = {
  readonly id: string;
  readonly serverId: string | undefined;
  readonly name: string;
  readonly tipo: CanalTipo;
  /**
   * A imagem do grupo, quando alguém subiu uma.
   *
   * URL pronta e não o ID do anexo, pela mesma razão de `ComSigla.avatarUrl`:
   * montar a URL no componente exigiria que ele soubesse o endereço do
   * `autumn`, que é forma de protocolo. O getter do SDK resolve, e chamá-lo na
   * ESCRITA é a disciplina de `sigla` e `createdAtText`.
   *
   * `undefined` no caso comum, e para todo canal que não é grupo.
   */
  readonly iconeUrl: string | undefined;
  /**
   * O tópico do canal (`description` no protocolo).
   *
   * `topico` e não `descricao`: no produto isto é o assunto do canal, e é
   * assim que quem usa chama. Nome de campo do protocolo não é nome de
   * conceito do domínio.
   */
  readonly topico: string | undefined;
  /**
   * Modo lento, em segundos. `0` = desativado.
   *
   * ⚠ **Campo do protocolo que chegava e era ignorado — o mesmo padrão do
   * `statusTexto` e do `ehMencao`.** Ele é de LEITURA apenas: `slowmode` está
   * no objeto do canal mas não em `DataEditChannel`, então a interface o
   * mostra e o controle de mudança é pendente. Ver `sdk/canal.ts`.
   */
  readonly modoLentoSegundos: number;
  /**
   * Restrição de idade.
   *
   * ⚠ **Chegava do protocolo e o snapshot não o carregava**, então a tela de
   * configuração nascia sempre em "Padrão" — inclusive num canal já marcado.
   * Ela AFIRMAVA o contrário do servidor, e salvar mandava `nsfw: false`
   * desmarcando o que ninguém pediu para desmarcar.
   */
  readonly restritoPorIdade: boolean;
  /**
   * Teto de gente na sala de voz. `undefined` fora de canal de voz.
   *
   * ⚠ Mesmo defeito do `restritoPorIdade`: a tela chutava 8 fixo. Num canal
   * com outro limite ela mostrava 8, e salvar sobrescrevia.
   */
  readonly limiteDeUsuarios: number | undefined;
  readonly naoLidas: number;
  readonly mencoes: number;
  /**
   * Silenciado.
   *
   * Não esconde o canal e não zera a contagem — apaga o REALCE. Quem silencia
   * quer parar de ser chamado, não parar de saber; esconder seria decidir pela
   * pessoa que aquele canal deixou de existir.
   */
  readonly silenciado: boolean;
  /**
   * Canal restrito — o cadeado que o design desenha ao lado de "liderança".
   *
   * ⚠ **É "pode estar escondido de alguém", não "escondido de você".** Vem de
   * `potentiallyRestrictedChannel`, que responde se ALGUM cargo tem
   * `ViewChannel` negado — inclusive o cargo padrão. Um canal que você não
   * pode ver nem chega na sessão, então a pergunta útil na coluna é a outra:
   * "isto aqui é do time todo ou de um grupo?".
   *
   * Nome do domínio e não do protocolo, como `topico`: quem usa chama de
   * privado.
   */
  readonly privado: boolean;
  /**
   * Teto de gente na sala de voz — o `8` de "3/8" no design.
   *
   * `undefined` em canal que não é de voz E em sala sem teto: o protocolo trata
   * `max_users: 0` como ausência, e a coluna precisa saber a diferença entre
   * "cabem oito" e "cabe quem vier". Mostrar "3/0" seria pior que não mostrar.
   */
  readonly limite: number | undefined;
  /**
   * Modo lento, em segundos entre mensagens — o "Modo lento · 30 s" do design.
   *
   * `0` é o normal e significa desligado; o protocolo usa zero e não ausência,
   * e o domínio preserva isso porque a pergunta "quantos segundos" tem uma
   * resposta numérica sempre. Quem desenha decide que zero não mostra nada.
   *
   * ⚠ **É informativo aqui, não regra.** O composer NÃO bloqueia por conta
   * própria: quem conta o intervalo é o servidor, e um cliente que bloqueia
   * sozinho erra nos dois sentidos — trava quem já podia enviar (relógios
   * diferentes) e libera quem não podia (recarregar a página zera o contador
   * local). Dizer a regra é útil; fingir aplicá-la é pior que nada.
   */
  readonly modoLento: number;
  /**
   * O outro lado de uma conversa direta. Só existe em `dm`.
   *
   * Calculado no adapter a partir de `recipientIds` menos eu, e NÃO lido de
   * `channel.recipient` — o getter do SDK faz `client.user!.id`, que estoura
   * antes do `Ready`. Este cliente precisa desenhar a coluna de conversas na
   * abertura, que é exatamente o momento em que `client.user` ainda não existe.
   */
  readonly destinatarioId: string | undefined;
  /** Quantas pessoas há num grupo. `0` fora dele. */
  readonly participantes: number;
  /**
   * Quando a última mensagem chegou, para ordenar a coluna de conversas.
   *
   * Vem do ULID da última mensagem, que carrega o tempo — não é campo próprio
   * do protocolo. Zero quando o canal nunca teve mensagem: conversa recém-aberta
   * vai para o fim, e não para um topo que ela não merece.
   */
  readonly ultimaEm: number;
  /**
   * A última mensagem do canal, por ID.
   *
   * ⚠ **Só o ID, e não o conteúdo.** Quem quiser o texto assina a mensagem —
   * `useMessage(id)` —, e é o que faz a caixa de entrada mostrar a prévia sem
   * o snapshot do CANAL carregar texto que muda a cada mensagem nova. Copiar o
   * conteúdo para cá republicaria o canal (e a coluna inteira, e o rail) a
   * cada palavra digitada por qualquer pessoa.
   *
   * `undefined` em canal que nunca teve mensagem. E o snapshot da mensagem
   * pode não existir: o store só materializa o que alguém assinou, então a
   * prévia de um canal que a sessão nunca abriu simplesmente não aparece — que
   * é a degradação honesta, e não um estado de carregamento mentiroso.
   */
  readonly ultimaMensagemId: string | undefined;
};

/**
 * A relação com outra pessoa.
 *
 * Vocabulário do app: o protocolo diz `Friend | Incoming | Outgoing | Blocked |
 * BlockedOther | None | User`, e as duas últimas são "ninguém" e "eu mesmo".
 * Colapsar aqui é o trabalho da camada anticorrupção — a tela de amigos tem
 * quatro abas, não sete.
 */
export type Relacao =
  | "amigo"
  | "recebido"
  | "enviado"
  | "bloqueado"
  /** Bloqueou VOCÊ. Some da interface; existe para não virar "nenhuma". */
  | "bloqueadoPor"
  | "nenhuma";

export type RelacaoSnapshot = ComSigla & {
  readonly id: string;
  readonly displayName: string;
  readonly username: string;
  readonly relacao: Relacao;
  readonly status: PresenceStatus;
};

/**
 * A chave de um membro: servidor MAIS usuário.
 *
 * Marcada (`branded`) de propósito. A pendência que isto fecha era descrita
 * assim: *"o snapshot de membro é keyed por ID de USUÁRIO, e apelido mora no
 * ServerMember — uma chave de usuário não sabe de qual servidor se fala"*.
 *
 * Trocar a chave por uma string composta resolveria o dado e deixaria o erro
 * possível: `members.getSnapshot(userId)` continuaria compilando e devolvendo
 * `undefined` para sempre, sem erro nenhum. Com a marca, passar um ID de
 * usuário onde se espera uma chave de membro **não compila**.
 *
 * Tornar impossível > tipo > lint. Aqui o tipo é o mecanismo inteiro.
 */
export type ChaveDeMembro = string & { readonly __chaveDeMembro: unique symbol };

export function chaveDeMembro(serverId: string, userId: string): ChaveDeMembro {
  return `${serverId}:${userId}` as ChaveDeMembro;
}

/** O lado de volta, para quem tem a chave e precisa assinar presença. */
export function usuarioDaChave(chave: ChaveDeMembro): string {
  return chave.slice(chave.indexOf(":") + 1);
}

export type MemberSnapshot = ComSigla & {
  /**
   * ID de USUÁRIO, não a chave.
   *
   * Presença é do usuário, não do membro: a mesma pessoa aparece online nos
   * cinco servidores dela ao mesmo tempo. `PontoDePresenca` assina por este
   * campo, e é por isso que ele sobrevive à chave composta.
   */
  readonly id: string;
  readonly displayName: string;
  /**
   * Cor do cargo que hasteia a pessoa. `undefined` = cor de texto normal.
   *
   * Vem crua do protocolo (é escolha de quem administra o servidor, não do
   * nosso sistema de tokens), então é o único lugar do app onde uma cor
   * literal é legítima — e por isso ela nunca pinta fundo, só texto sobre
   * superfície conhecida.
   */
  /** Username global — o que a pessoa é fora deste servidor. */
  readonly username: string;
  /** `undefined` quando não declarados. Nunca inventar um valor. */
  readonly pronomes: string | undefined;
  /** Status escrito pela pessoa. Vazio é ausência, não string vazia. */
  readonly statusTexto: string | undefined;
  readonly cor: string | undefined;
  /**
   * O nome do cargo que hasteia a pessoa — o "VTX" e o "MOD" do design.
   *
   * `undefined` quando ninguém a hasteia, que é o caso da maioria: o crachá é
   * do design justamente porque marca a MINORIA. Um crachá em toda linha não
   * distinguiria ninguém, e roubaria a largura do nome.
   *
   * Mesmo cargo de `cor` — `hoistedRole` é um só —, então o crachá e a cor do
   * nome nunca discordam. Se viessem de cargos diferentes, a linha diria duas
   * coisas sobre a mesma pessoa.
   */
  readonly cargo: string | undefined;
  /**
   * TODOS os cargos desta pessoa neste servidor, do mais alto para o mais
   * baixo.
   *
   * ⚠ **Isto é o que a fase 6 destravou, e a ausência dele bloqueava quatro
   * superfícies de uma vez** — as pílulas de cargo, o submenu de cargos, o
   * item "acima da sua hierarquia" e o crachá do cartão de perfil. O snapshot
   * carregava só `cor` e `cargo`, que são do hasteado; "quais são os cargos
   * dela" não era representável.
   *
   * IDs e não objetos: o nome e a cor de um cargo mudam quando quem administra
   * os edita, e copiá-los para dentro do snapshot de CADA membro faria uma
   * renomeação republicar a member list inteira. Quem resolve é
   * `cargosDoServidor`, que assina o servidor uma vez.
   */
  readonly cargosIds: readonly string[];
  /**
   * Esta pessoa está ABAIXO de mim na hierarquia?
   *
   * ⚠ Campo e não cálculo no componente: a comparação é `inferiorTo` do SDK,
   * e o `stoat.js` só pode ser importado dentro de `src/sdk/`. É a mesma razão
   * de `podeExpulsar` não existir como pergunta solta na tela.
   *
   * `false` quando não dá para saber (sem sessão, sem membro): o default de
   * "não sei" é NÃO PODE, que é o certo para uma ação de moderação.
   */
  readonly abaixoDeMim: boolean;
  /**
   * Fim do castigo, em epoch ms. `undefined` = sem castigo.
   *
   * Número e não `Date`: `getSnapshot` precisa devolver referência estável, e
   * um `Date` novo a cada leitura é exatamente o erro nº 1 do briefing.
   */
  readonly silenciadoAte: number | undefined;
  /**
   * Quando entrou no servidor, já formatado.
   *
   * ⚠ **Formatado na ESCRITA, como `createdAtText`** — a página de membros
   * desenha mil linhas, e um `Intl.DateTimeFormat` por render seria o erro
   * nº 4 do briefing com data no lugar de markdown.
   *
   * ⚠ **E é o único dos dois que existe.** O design mostra "entrou em" E
   * "última atividade"; `ServerMember` tem `joinedAt` e mais nada. Atividade
   * não é campo, rota nem evento no Stoat.
   */
  readonly entrouEm: string | undefined;
  /**
   * O mesmo instante, em epoch ms — o que a ORDENAÇÃO usa.
   *
   * ⚠ **Dois campos da mesma fonte, como `createdAt` e `createdAtText`.** A
   * string é localizada ("3 abr 2026") e ordenar por ela dá ordem alfabética
   * de mês. O número existe para comparar; a string, para desenhar.
   *
   * A alternativa era ordenar pela ordem do array de IDs, e ela ESTAVA no
   * código com a justificativa de que o protocolo entrega por ULID. É falso
   * aqui: a lista da página vem dos baldes de presença concatenados, então
   * "entrada mais recente" entregava a ordem de quem está online. Passou por
   * typecheck, lint e olho — só apareceu com datas de verdade na tela.
   */
  readonly entrouEmMs: number | undefined;
};

/**
 * Balde de ordenação da member list.
 *
 * Dois, não quatro: separar `idle` e `dnd` em seções próprias faria toda
 * mudança de presença reordenar a lista, e presença é o evento mais volumoso
 * do app. Com dois baldes, `online → idle → dnd` não move ninguém — só o
 * pontinho muda, e ele assina sozinho.
 *
 * É a mesma decisão de escopo da lei nº 1, aplicada à ordenação em vez de à
 * subscrição.
 */
export type Balde = "online" | "offline";

/**
 * Uma seção da member list.
 *
 * Seção por CARGO, e só do lado online — que é o que o Discord faz, e não por
 * imitação: é o que preserva a decisão dos dois baldes. Presença muda o tempo
 * todo (55% da carga do firehose) e **cargo não pisca**, então seccionar por
 * cargo não reordena nada; `online → idle → dnd` continua não movendo ninguém,
 * porque os três caem na mesma seção. Offline permanece um balde só,
 * independente de cargo, pelo mesmo motivo.
 *
 * A lei nº 1 não proíbe seção. Proíbe seção sobre estado de alta frequência.
 */
export type SecaoDeMembros = {
  /** ID do cargo, ou `SEM_CARGO` para quem não tem cargo hasteado. */
  readonly id: string;
  readonly rotulo: string;
  readonly cor: string | undefined;
  readonly ids: readonly string[];
};

export const SEM_CARGO = "@sem-cargo";

/**
 * O que a pessoa está publicando na sala. Tela ganha de vídeo, vídeo de voz —
 * a mesma precedência que o SDK aplica, mantida aqui porque é regra de
 * apresentação e o domínio é quem a declara.
 */
export type EstadoDeVoz = "voz" | "video" | "tela";

/**
 * Alguém DENTRO de um canal de voz.
 *
 * A peça que separa sala de chamada. No Stoat um canal de voz é uma chamada
 * que se faz; aqui é um lugar onde há gente, visível antes de entrar — e o
 * protocolo sempre soube disso: `Ready.voice_states` entrega quem está em cada
 * canal no login, antes de entrar em qualquer um.
 *
 * `desde` é epoch ms, e não `Date`, pela mesma razão de `silenciadoAte`:
 * `getSnapshot` precisa devolver referência estável.
 */
export type ParticipanteDeVoz = {
  readonly userId: string;
  readonly estado: EstadoDeVoz;
  readonly desde: number;
  /**
   * Não está publicando áudio — mudo.
   *
   * ⚠ Vem de `is_publishing` do protocolo, que já chegava no objeto do SDK e
   * ninguém lia. É campo do PROTOCOLO e não do LiveKit: qualquer cliente
   * Stoat vê o mesmo, e ele sobrevive a quem entrou na sala antes de você.
   *
   * Separado de `estado` de propósito: estado é o que a pessoa está
   * PUBLICANDO (voz, vídeo, tela) e é excludente; mudo e surdo são
   * modificadores que valem junto com qualquer um deles — dá para estar
   * compartilhando a tela e mudo ao mesmo tempo.
   */
  readonly mudo: boolean;
  /** Não está recebendo áudio — surdo. Vem de `is_receiving`. */
  readonly surdo: boolean;
  /**
   * Silenciado POR ORDEM DO SERVIDOR — o `SRV` do design.
   *
   * ⚠ Diferente de `mudo`: aquele é escolha da pessoa e ela desfaz quando
   * quiser; este é `can_publish: false` no `ServerMember`, e só quem modera
   * desfaz. A tela precisa distinguir os dois — "está sem microfone agora" e
   * "não pode falar aqui" pedem reações opostas de quem está esperando
   * resposta.
   */
  readonly mudoPeloServidor: boolean;
};

export function baldeDe(status: PresenceStatus): Balde {
  return status === "offline" ? "offline" : "online";
}
