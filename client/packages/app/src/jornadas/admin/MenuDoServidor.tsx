import { pode } from "nucleo/sdk/permissoes";
import { souDono } from "nucleo/sdk/servidores";
import { abrirConfig } from "nucleo/store/config";
import { useCanaisDeTexto, useCanaisDeVoz } from "nucleo/store/hooks";
import { useState } from "react";

import { admin } from "../../textos";
import { Botao } from "../../ui/ds";
import { SetaParaBaixo } from "../../ui/icones";
import {
  ConteudoDoMenu,
  GatilhoDoMenu,
  ItemDeMenu,
  MenuSuspenso,
  SeparadorDeMenu,
} from "../../ui/primitivos/Menus";
import { ConvidarPessoas } from "../salas/ConvidarPessoas";
import { podeAbrirSecao, secoesPermitidas } from "./secoes";
import { SairDoServidor } from "./SairDoServidor";

/**
 * O menu do servidor, no cabeçalho da coluna de salas (PRD 4.7). Cada item só
 * existe para quem pode usá-lo: o menu de um membro comum tem convidar (se o
 * servidor deixa) e sair, e mais nada. Sem nenhum item, o botão nem aparece.
 */
export function MenuDoServidor({ serverId }: { serverId: string }) {
  // Convite é sempre de um canal; o servidor entra por ele. Canal de texto primeiro, senão uma sala.
  const texto = useCanaisDeTexto(serverId);
  const voz = useCanaisDeVoz(serverId);
  const canalParaConvite = texto[0] ?? voz[0];
  const [convidando, setConvidando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const podeConvidar = canalParaConvite !== undefined && pode(canalParaConvite, "criarConvite");
  const secoes = secoesPermitidas(serverId);
  const podeCriarCanal = podeAbrirSecao(serverId, "canais");
  const dono = souDono(serverId);

  return (
    <>
      <MenuSuspenso>
        <GatilhoDoMenu asChild>
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<SetaParaBaixo />}
            aria-label={admin.menu.abrir}
            data-testid="menu-do-servidor"
          />
        </GatilhoDoMenu>
        <ConteudoDoMenu align="end">
          {podeConvidar && (
            <ItemDeMenu
              onSelect={() => {
                setConvidando(true);
              }}
            >
              {admin.menu.convidar}
            </ItemDeMenu>
          )}
          {podeCriarCanal && (
            <ItemDeMenu
              onSelect={() => {
                abrirConfig("canais", serverId);
              }}
            >
              {admin.canaisPagina.criar}
            </ItemDeMenu>
          )}
          {secoes[0] !== undefined && (
            <ItemDeMenu
              onSelect={() => {
                abrirConfig(secoes[0] ?? "servidor", serverId);
              }}
            >
              {admin.menu.configuracoes}
            </ItemDeMenu>
          )}
          {(podeConvidar || podeCriarCanal || secoes.length > 0) && <SeparadorDeMenu />}
          <ItemDeMenu
            variante="perigo"
            onSelect={() => {
              setSaindo(true);
            }}
          >
            {dono ? admin.menu.apagar : admin.menu.sair}
          </ItemDeMenu>
        </ConteudoDoMenu>
      </MenuSuspenso>
      {canalParaConvite !== undefined && (
        <ConvidarPessoas canalId={canalParaConvite} aberto={convidando} aoMudar={setConvidando} />
      )}
      <SairDoServidor serverId={serverId} aberto={saindo} aoMudar={setSaindo} />
    </>
  );
}
