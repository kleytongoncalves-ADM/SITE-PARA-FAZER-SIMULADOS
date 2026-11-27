import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IfcAPI } from "web-ifc";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cargaDemonstracao } from "../src/dados/base-demonstracao";
import { fecharPool, pool } from "../src/lib/db";
import { compactar, descompactar, desempacotarModelo, emPartes, empacotarModelo, extrairModelo, type Modelo } from "../src/lib/ifc/modelo";
import { extrairQuantitativos, type LeituraIfc } from "../src/lib/ifc/quantitativos";
import { guardarParteDoModelo, lerParteDoModelo, projetoDoOrcamento, lancarQuantitativo, listarLeiturasIfc, medidaDaUnidade, obterLeituraIfc, quantidadeDoGrupo, registrarLeituraIfc, removerLeituraIfc } from "../src/servicos/ifc";
import { gravarCargaSinapi } from "../src/servicos/importador-sinapi";
import { criarObra, type Ator } from "../src/servicos/obras";
import { adicionarEtapa, criarOrcamento, obterOrcamento } from "../src/servicos/orcamentos";
import { SemPermissao } from "../src/servicos/permissoes";
import { buscarComposicoes } from "../src/servicos/precos";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

const arquivo = join(__dirname, "arquivos", "casa-terrea.ifc");
let api: IfcAPI;
let leitura: LeituraIfc;
let eng: Ator, fiscal: Ator, tabela: string;

/** O mesmo arquivo com as medidas em milímetros (só a declaração de unidade muda). */
const emMilimetros = (t: string) => t.replace("IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)", "IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)");

function ler(conteudo: string | Buffer) {
  const m = api.OpenModel(new Uint8Array(Buffer.from(conteudo)));
  try { return extrairQuantitativos(api, m); } finally { api.CloseModel(m); }
}

beforeAll(async () => {
  api = new IfcAPI();
  await api.Init();
  leitura = ler(readFileSync(arquivo));
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await gravarCargaSinapi(c, cargaDemonstracao(), "demonstracao");
    await c.query("commit");
    tabela = r.find((x) => x.regime === "nao_desonerado")!.tabelaId;
  } finally { c.release(); }
  const orgao = await novoOrgao();
  eng = await novoUsuario(orgao, "engenheiro");
  fiscal = await novoUsuario(orgao, "fiscal");
});
afterAll(fecharPool);

describe("leitura do IFC", () => {
  it("agrupa por classe, tipo e material, com as quantidades do arquivo", () => {
    expect(leitura).toMatchObject({ schema: "IFC4", elementos: 74 });
    const grupo = (rotulo: string, material?: string) => leitura.grupos.find((g) => g.rotulo === rotulo && (!material || g.material === material))!;
    expect(grupo("Laje", "Concreto armado")).toMatchObject({ elementos: 1, area: 80, volume: 8, calculadas: [] });
    expect(grupo("Porta")).toMatchObject({ elementos: 5, area: 8.4 });
    expect(grupo("Fundação")).toMatchObject({ elementos: 19, comprimento: 62, volume: 5.142 });
    expect(grupo("Parede").pavimentos).toEqual(["Térreo"]);
  });

  it("calcula pela geometria o que o arquivo não traz e marca como calculado", () => {
    const parede = leitura.grupos.find((g) => g.rotulo === "Parede")!;
    expect(parede.calculadas).toEqual(expect.arrayContaining(["area", "volume"]));
    // 62 m de parede com pé-direito de 2,8 m, menos portas e janelas: entre 140 e 175 m² de uma face.
    expect(parede.area!).toBeGreaterThan(140);
    expect(parede.area!).toBeLessThan(175);
    const pilar = leitura.grupos.find((g) => g.rotulo === "Pilar")!;
    expect(pilar.calculadas).toContain("comprimento");
    expect(pilar.comprimento).toBeCloseTo(46.8, 1);
  });

  it("converte pelas unidades do projeto", () => {
    const mm = ler(emMilimetros(readFileSync(arquivo, "utf8")));
    const viga = (l: LeituraIfc) => l.grupos.find((g) => g.rotulo === "Viga")!;
    expect(viga(mm).comprimento).toBeCloseTo(viga(leitura).comprimento! / 1000, 4);
    expect(viga(mm).volume).toBe(viga(leitura).volume); // volume declarado em m³ continua igual
  });

  it("escolhe a medida pela unidade do serviço", () => {
    expect(medidaDaUnidade("M2")).toBe("area");
    expect(medidaDaUnidade("m³")).toBe("volume");
    expect(medidaDaUnidade("UN")).toBe("elementos");
    expect(medidaDaUnidade("H")).toBeNull();
    expect(quantidadeDoGrupo({ comprimento: null, area: "156.909", volume: null, peso: null, elementos: 9 }, "area", "2")).toBe("313.8180");
    expect(() => quantidadeDoGrupo({ comprimento: null, area: null, volume: null, peso: null, elementos: 9 }, "area", "1")).toThrow(/não tem área/);
  });
});

describe("quantitativos do IFC no orçamento", () => {
  async function orcamento() {
    const obraId = await criarObra(eng, dadosObra());
    const id = await criarOrcamento(eng, { obraId, nome: "Casa", tabelaId: tabela });
    const etapa = await adicionarEtapa(eng, id, "Alvenaria");
    return { id, etapa };
  }

  it("guarda a leitura e lança a mesma área em mais de um serviço, com a memória de cálculo", async () => {
    const { id, etapa } = await orcamento();
    const leituraId = await registrarLeituraIfc(eng, id, { arquivo: "casa-terrea.ifc", tamanho: 128459, leitura });
    const l = await obterLeituraIfc(eng, leituraId);
    expect(l.quantitativos).toHaveLength(leitura.grupos.length);
    const parede = l.quantitativos.find((g) => g.rotulo === "Parede")!;
    const alv = (await buscarComposicoes(eng, { tabelaId: tabela, busca: "alvenaria" }))[0];
    const reboco = (await buscarComposicoes(eng, { tabelaId: tabela, busca: "reboco" }))[0];
    await lancarQuantitativo(eng, id, parede.id, { tipo: "composicao", refId: alv.id, etapaId: etapa, medida: "area" });
    await lancarQuantitativo(eng, id, parede.id, { tipo: "composicao", refId: reboco.id, etapaId: etapa, medida: "area", multiplicador: "2" });

    const o = await obterOrcamento(eng, id);
    const [i1, i2] = o.etapas[0].itens;
    expect(Number(i1.quantidade)).toBeCloseTo(Number(parede.area), 3);
    expect(Number(i2.quantidade)).toBeCloseTo(Number(parede.area) * 2, 3);
    expect(i2.memoria).toMatch(/IFC casa-terrea\.ifc: Parede/);
    expect(i2.memoria).toMatch(/× 2 =/);
    expect(i2.memoria).toMatch(/geometria/);

    const depois = await obterLeituraIfc(eng, leituraId);
    expect(depois.quantitativos.find((g) => g.id === parede.id)!.lancamentos).toHaveLength(2);
    expect((await listarLeiturasIfc(eng, id))[0]).toMatchObject({ lancamentos: 2 });

    // Excluir a leitura não tira os itens do orçamento.
    await removerLeituraIfc(eng, id, leituraId);
    expect((await obterOrcamento(eng, id)).etapas[0].itens).toHaveLength(2);
    expect(await listarLeiturasIfc(eng, id)).toHaveLength(0);
  });

  it("recusa leitura inválida e perfil sem edição", async () => {
    const { id } = await orcamento();
    await expect(registrarLeituraIfc(eng, id, { arquivo: "casa.dwg", tamanho: 1, leitura })).rejects.toThrow(/\.ifc/);
    await expect(registrarLeituraIfc(eng, id, { arquivo: "casa.ifc", tamanho: 1, leitura: { ...leitura, grupos: [{ ...leitura.grupos[0], area: -1 }] } })).rejects.toThrow(/inválido/);
    await expect(registrarLeituraIfc(fiscal, id, { arquivo: "casa.ifc", tamanho: 1, leitura })).rejects.toBeInstanceOf(SemPermissao);
  });

  it("monta o modelo 3D por grupo e o entrega ligado aos itens lançados", async () => {
    // Modelo: geometria reunida pelos mesmos grupos dos quantitativos, sem os ambientes.
    const m = api.OpenModel(new Uint8Array(readFileSync(arquivo)));
    let modelo: Modelo;
    try {
      const grupoDoElemento = new Map<number, number>();
      const l = extrairQuantitativos(api, m, grupoDoElemento);
      const r = extrairModelo(api, m, grupoDoElemento);
      expect(r.aviso).toBeNull();
      modelo = r.modelo!;
      const ordemAmbiente = l.grupos.findIndex((g) => g.rotulo === "Ambiente") + 1;
      expect(modelo.grupos.some((g) => g.ordem === ordemAmbiente)).toBe(false);
      expect(modelo.grupos.length).toBeGreaterThan(4);
    } finally { api.CloseModel(m); }
    // A casa tem 10 x 8 m em planta; a compactação em 16 bits mantém as medidas no milímetro.
    const [x, , z] = modelo.tamanho;
    expect(Math.max(x, z)).toBeGreaterThan(9.9);
    expect(Math.max(x, z)).toBeLessThan(11.5);
    const volta = desempacotarModelo(await descompactar(await compactar(empacotarModelo(modelo))));
    expect(volta.grupos.map((g) => [g.ordem, g.indices.length])).toEqual(modelo.grupos.map((g) => [g.ordem, g.indices.length]));
    const erro = Math.max(...Array.from(volta.grupos[0].posicoes, (v, i) => Math.abs(v - modelo.grupos[0].posicoes[i])));
    expect(erro).toBeLessThan(0.001);

    const pasta = mkdtempSync(join(tmpdir(), "civiobras-ifc-"));
    process.env.ARMAZENAMENTO_PASTA = pasta;
    try {
      const { id, etapa } = await orcamento();
      const leituraId = await registrarLeituraIfc(eng, id, { arquivo: "casa.ifc", tamanho: 1, leitura });
      expect(await projetoDoOrcamento(eng, id)).toBeNull(); // sem modelo ainda
      const partes = emPartes(await compactar(empacotarModelo(modelo)), 2000);
      const total = Math.min(partes.length, 8);
      await expect(guardarParteDoModelo(fiscal, id, leituraId, 0, total, Buffer.from(partes[0]))).rejects.toBeInstanceOf(SemPermissao);
      await expect(guardarParteDoModelo(eng, id, leituraId, 9, 9, Buffer.from(partes[0]))).rejects.toThrow(/inválido/);
      for (let i = 0; i < total; i++) await guardarParteDoModelo(eng, id, leituraId, i, total, Buffer.from(partes[i]));
      expect(Buffer.compare((await lerParteDoModelo(eng, leituraId, 0))!, Buffer.from(partes[0]))).toBe(0);
      expect(await lerParteDoModelo(eng, leituraId, total)).toBeNull();

      const d = await obterLeituraIfc(eng, leituraId);
      expect(d.modelo3d).toBe(true);
      const parede = d.quantitativos.find((g) => g.rotulo === "Parede")!;
      const comp = (await buscarComposicoes(eng, { tabelaId: tabela, busca: "alvenaria" }))[0];
      await lancarQuantitativo(eng, id, parede.id, { tipo: "composicao", refId: comp.id, etapaId: etapa, medida: "area" });
      const projeto = (await projetoDoOrcamento(eng, id))!;
      expect(projeto).toMatchObject({ leituraId, partes: total });
      const item = (await obterOrcamento(eng, id)).etapas[0].itens.at(-1)!;
      expect(projeto.grupos.find((g) => g.ordem === parede.ordem)!.itens).toEqual([item.id]);
      expect(projeto.grupos.filter((g) => g.itens.length)).toHaveLength(1);

      await removerLeituraIfc(eng, id, leituraId);
      expect(await projetoDoOrcamento(eng, id)).toBeNull();
      expect(existsSync(join(pasta, eng.orgaoId, "ifc", leituraId, "modelo-0.bin"))).toBe(false);
    } finally {
      delete process.env.ARMAZENAMENTO_PASTA;
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
