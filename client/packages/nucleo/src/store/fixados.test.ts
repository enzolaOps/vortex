import { beforeEach, describe, expect, it, vi } from "vitest";

import { buscarFixadas } from "../sdk/fixados";
import {
  aplicarFixacao,
  carregarFixadas,
  carregarMaisFixadas,
  lerFixados,
  limparFixados,
  removerFixada,
} from "./fixados";

vi.mock("../sdk/fixados", () => ({ buscarFixadas: vi.fn() }));

const buscar = vi.mocked(buscarFixadas);
const CANAL = "canal-1";
const ids = () => lerFixados().cargas[CANAL]?.ids;

function pendente<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

beforeEach(() => {
  limparFixados();
  buscar.mockReset();
});

describe("store de fixados", () => {
  it("carrega uma vez por canal: a segunda chamada não busca de novo", async () => {
    buscar.mockResolvedValue({ ids: ["c", "b"], temMais: false });
    await carregarFixadas(CANAL);
    await carregarFixadas(CANAL);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(lerFixados().cargas[CANAL]).toMatchObject({ status: "pronta", ids: ["c", "b"] });
  });

  it("passa por carregando e termina em erro quando a busca falha; tentar de novo refaz", async () => {
    const espera = pendente<undefined>();
    buscar.mockReturnValueOnce(espera.promessa);
    const p = carregarFixadas(CANAL);
    expect(lerFixados().cargas[CANAL]?.status).toBe("carregando");
    espera.resolver(undefined);
    await p;
    expect(lerFixados().cargas[CANAL]?.status).toBe("erro");

    buscar.mockResolvedValueOnce({ ids: ["a"], temMais: false });
    await carregarFixadas(CANAL);
    expect(ids()).toEqual(["a"]);
  });

  it("fixar acrescenta em ordem de tempo e desafixar/apagar tiram, sem nova busca", async () => {
    buscar.mockResolvedValue({ ids: ["05", "01"], temMais: false });
    await carregarFixadas(CANAL);

    aplicarFixacao(CANAL, "03", true);
    expect(ids()).toEqual(["05", "03", "01"]);
    aplicarFixacao(CANAL, "05", false);
    removerFixada(CANAL, "01");
    expect(ids()).toEqual(["03"]);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("evento que chega com a busca em voo vale sobre a resposta, que é mais velha", async () => {
    const espera = pendente<{ ids: string[]; temMais: boolean }>();
    buscar.mockReturnValueOnce(espera.promessa);
    const p = carregarFixadas(CANAL);

    aplicarFixacao(CANAL, "09", true);
    aplicarFixacao(CANAL, "02", false);
    espera.resolver({ ids: ["05", "02"], temMais: false });
    await p;

    expect(ids()).toEqual(["09", "05"]);
  });

  it("evento de canal sem lista carregada não cria lista", () => {
    aplicarFixacao(CANAL, "01", true);
    expect(lerFixados().cargas[CANAL]).toBeUndefined();
  });

  it("carregar mais acrescenta a página seguinte pelo cursor do último, sem duplicar", async () => {
    buscar.mockResolvedValueOnce({ ids: ["09", "08"], temMais: true });
    await carregarFixadas(CANAL);
    buscar.mockResolvedValueOnce({ ids: ["08", "07"], temMais: false });
    await carregarMaisFixadas(CANAL);

    expect(buscar).toHaveBeenLastCalledWith(CANAL, "08");
    expect(lerFixados().cargas[CANAL]).toMatchObject({ ids: ["09", "08", "07"], temMais: false });
  });

  it("refresh forçado mantém a lista na tela e, se falha, não a derruba", async () => {
    buscar.mockResolvedValueOnce({ ids: ["02"], temMais: false });
    await carregarFixadas(CANAL);
    buscar.mockResolvedValueOnce(undefined);
    await carregarFixadas(CANAL, true);
    expect(lerFixados().cargas[CANAL]).toMatchObject({ status: "pronta", ids: ["02"] });
  });
});
