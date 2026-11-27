import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { moverArquivos } from "../scripts/mover-arquivos";
import { ArmazenamentoPasta, ArmazenamentoSupabase, armazenamento, ErroDeArmazenamento } from "../src/lib/armazenamento";
import { comContexto, fecharPool } from "../src/lib/db";
import { abrirDiario, enviarFoto, excluirFoto, lerFoto } from "../src/servicos/campo";
import { enviarDocumento, lerArquivo, novaVersao, obterDocumento, superarDocumento } from "../src/servicos/documentos";
import { criarObra, vincular, type Ator } from "../src/servicos/obras";
import { dadosObra, novoOrgao, novoUsuario } from "./apoio";

// ---------------------------------------------------------------------------
// Imitação da API do Supabase Storage (só o que o sistema usa)
// ---------------------------------------------------------------------------
const CHAVE = "sb_secret_teste";
const objetos = new Map<string, { bytes: Buffer; mime: string }>();
const buckets = new Map<string, { public: boolean; file_size_limit: number }>();
let falharEnvio = false;
let servidor: Server;
let url = "";

function iniciar() {
  servidor = createServer(async (req, res) => {
    const partes: Buffer[] = [];
    for await (const p of req) partes.push(p as Buffer);
    const corpo = Buffer.concat(partes);
    const responder = (status: number, json: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)); };
    if (req.headers.apikey !== CHAVE || req.headers.authorization !== `Bearer ${CHAVE}`) return responder(403, { message: "chave inválida" });
    const caminho = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    let m: RegExpMatchArray | null;
    if ((m = caminho.match(/^\/storage\/v1\/bucket\/([^/]+)$/)) && req.method === "GET") {
      const b = buckets.get(m[1]);
      return b ? responder(200, { id: m[1], ...b }) : responder(400, { statusCode: "404", error: "Bucket not found" });
    }
    if (caminho === "/storage/v1/bucket" && req.method === "POST") {
      const b = JSON.parse(corpo.toString());
      buckets.set(b.id, { public: b.public, file_size_limit: b.file_size_limit });
      return responder(200, { name: b.id });
    }
    if ((m = caminho.match(/^\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/)) && req.method === "GET") {
      const o = objetos.get(`${m[1]}/${m[2]}`);
      if (!o) return responder(400, { statusCode: "404", error: "not_found", message: "Object not found" });
      res.writeHead(200, { "Content-Type": o.mime });
      return res.end(o.bytes);
    }
    if ((m = caminho.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)) && req.method === "POST") {
      if (falharEnvio) return responder(500, { message: "falha simulada" });
      objetos.set(`${m[1]}/${m[2]}`, { bytes: corpo, mime: String(req.headers["content-type"]) });
      return responder(200, { Key: `${m[1]}/${m[2]}` });
    }
    if ((m = caminho.match(/^\/storage\/v1\/object\/([^/]+)$/)) && req.method === "DELETE") {
      for (const p of JSON.parse(corpo.toString()).prefixes as string[]) objetos.delete(`${m[1]}/${p}`);
      return responder(200, []);
    }
    responder(404, { message: "rota desconhecida" });
  });
  return new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", () => {
    url = `http://127.0.0.1:${(servidor.address() as { port: number }).port}`;
    ok();
  }));
}

const usarStorage = () => { process.env.SUPABASE_URL = url; process.env.SUPABASE_SECRET_KEY = CHAVE; };
const usarBanco = () => { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; };
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

let orgao: string, eng: Ator, direcao: Ator, campo: Ator, outro: Ator;
beforeAll(async () => {
  await iniciar();
  orgao = await novoOrgao();
  eng = await novoUsuario(orgao, "engenheiro");
  direcao = await novoUsuario(orgao, "direcao");
  campo = await novoUsuario(orgao, "campo");
  outro = await novoUsuario(await novoOrgao("Outro órgão"), "direcao");
});
afterEach(() => { usarBanco(); falharEnvio = false; });
afterAll(async () => {
  usarBanco();
  servidor.close();
  await fecharPool();
});

const consulta = (sql: string, p: unknown[]) => comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => (await c.query(sql, p)).rows);
const jpeg = (marca: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(marca), Buffer.from([0xff, 0xd9])]);
const pdf = (marca: string) => ({ nome: `${marca}.pdf`, conteudo: Buffer.from(`%PDF-1.4 ${marca}`) });
let dia = 0;
async function diarioAberto() {
  const obraId = await criarObra(eng, dadosObra());
  await vincular(direcao, obraId, campo.id, "campo");
  // Atalho de teste: põe a obra em execução sem montar contrato e cronograma.
  await comContexto({ usuarioId: null, orgaoId: orgao }, async (c) => {
    await c.query("select set_config('app.mudando_situacao', 'sim', true)");
    await c.query("update obra set situacao = 'em_execucao' where id = $1", [obraId]);
  });
  dia += 1;
  const diarioId = await abrirDiario(campo, obraId, `2026-11-${String(dia).padStart(2, "0")}`);
  return { obraId, diarioId };
}
const foto = (obraId: string, diarioId: string, marca: string) => ({
  obraId, alvo: { diarioId }, legenda: "Frente", mime: "image/jpeg", largura: 800, altura: 600, conteudo: jpeg(marca), miniatura: jpeg(`mini-${marca}`),
});

describe("configuração", () => {
  it("sem variáveis guarda no banco; com uma só, recusa", () => {
    usarBanco();
    expect(armazenamento()).toBeNull();
    process.env.SUPABASE_URL = url;
    expect(() => armazenamento()).toThrow(ErroDeArmazenamento);
    usarStorage();
    expect(armazenamento()?.tipo).toBe("supabase");
  });

  it("cria o bucket privado e recusa caminhos fora do padrão", async () => {
    const arm = new ArmazenamentoSupabase(url, CHAVE, "arquivos");
    expect(await arm.prepararBucket()).toBe("criado");
    expect(buckets.get("arquivos")!.public).toBe(false);
    expect(await arm.prepararBucket()).toBe("existente");
    buckets.set("publico", { public: true, file_size_limit: 1 });
    await expect(new ArmazenamentoSupabase(url, CHAVE, "publico").prepararBucket()).rejects.toThrow(/privado/);
    await expect(arm.guardar("../fora.txt", Buffer.from("x"), "text/plain")).rejects.toThrow(/inválido/);
    await expect(new ArmazenamentoSupabase(url, "errada", "arquivos").ler("a/b.txt")).rejects.toThrow(/403/);
  });

  it("pasta local guarda, lê e remove", async () => {
    const arm = new ArmazenamentoPasta(mkdtempSync(join(tmpdir(), "civiobras-")));
    await arm.guardar("org/fotos/a.jpg", Buffer.from("abc"), "image/jpeg");
    expect((await arm.ler("org/fotos/a.jpg"))!.toString()).toBe("abc");
    await arm.remover(["org/fotos/a.jpg"]);
    expect(await arm.ler("org/fotos/a.jpg")).toBeNull();
    await expect(arm.ler("org/../../etc/passwd")).rejects.toThrow(/inválido/);
  });
});

describe("fotos no armazenamento", () => {
  it("grava fora do banco, lê só quem pode e remove ao excluir", async () => {
    usarStorage();
    const { obraId, diarioId } = await diarioAberto();
    const id = await enviarFoto(campo, foto(obraId, diarioId, "f1"));
    const [r] = await consulta("select conteudo, miniatura, arquivo, arquivo_miniatura from foto where id = $1", [id]);
    expect(r.conteudo).toBeNull();
    expect(r.miniatura).toBeNull();
    expect(r.arquivo).toBe(`${orgao}/fotos/${obraId}/${id}.jpg`);
    expect(objetos.get(`arquivos/${r.arquivo}`)!.bytes.equals(jpeg("f1"))).toBe(true);
    expect((await lerFoto(campo, id, false))!.bytes.equals(jpeg("f1"))).toBe(true);
    expect((await lerFoto(campo, id, true))!.bytes.equals(jpeg("mini-f1"))).toBe(true);
    expect(await lerFoto(outro, id, false)).toBeNull();
    // Continua imutável: só o lugar do arquivo pode mudar, e uma vez só.
    await expect(consulta("update foto set legenda = 'x' where id = $1", [id])).rejects.toThrow(/históricos/);
    await expect(consulta("update foto set arquivo = 'outro/lugar.jpg' where id = $1", [id])).rejects.toThrow(/não muda/);
    await excluirFoto(campo, id);
    expect(objetos.has(`arquivos/${r.arquivo}`)).toBe(false);
    expect(objetos.has(`arquivos/${r.arquivo_miniatura}`)).toBe(false);
  });

  it("falha no armazenamento não deixa registro, e falha no banco não deixa arquivo", async () => {
    usarStorage();
    const { obraId, diarioId } = await diarioAberto();
    falharEnvio = true;
    await expect(enviarFoto(campo, foto(obraId, diarioId, "f2"))).rejects.toThrow(/falha simulada/);
    expect(await consulta("select 1 from foto where diario_id = $1", [diarioId])).toHaveLength(0);
    falharEnvio = false;
    const antes = objetos.size;
    const doc = await enviarDocumento(eng, obraId, { categoria: "projeto", tipo: "Projeto", titulo: "P1" }, pdf("p1"));
    const subst = await enviarDocumento(eng, obraId, { categoria: "projeto", tipo: "Projeto", titulo: "P2" }, pdf("p2"));
    await superarDocumento(eng, doc, subst, "Revisado");
    // O banco recusa a versão (documento superado) depois do envio: o arquivo é retirado.
    await expect(novaVersao(eng, doc, pdf("p1b"), "Nova")).rejects.toThrow(/superado/);
    expect(objetos.size).toBe(antes + 2);
  });
});

describe("documentos no armazenamento", () => {
  it("guarda tamanho e SHA-256 do arquivo e lê de volta só para quem pode", async () => {
    usarStorage();
    const obraId = await criarObra(eng, dadosObra());
    const id = await enviarDocumento(eng, obraId, { categoria: "projeto", tipo: "Projeto estrutural", titulo: "Bloco A" }, pdf("rev0"));
    expect(await novaVersao(eng, id, { nome: "planilha.xlsx", conteudo: Buffer.from("PK planilha") }, "Quantitativos")).toBe(2);
    const d = await obterDocumento(eng, id);
    const v1 = d.versoes.find((v) => v.numero === 1)!;
    expect(v1.sha256).toBe(sha(pdf("rev0").conteudo));
    const linhas = await consulta("select numero, conteudo, arquivo, tamanho from documento_versao where documento_id = $1 order by numero", [id]);
    expect(linhas.map((l) => l.conteudo)).toEqual([null, null]);
    expect(linhas[0].arquivo).toMatch(new RegExp(`^${orgao}/documentos/${obraId}/${id}/[0-9a-f-]{36}\\.pdf$`));
    expect(linhas[1].arquivo).toMatch(/\.xlsx$/);
    expect(linhas[0].tamanho).toBe(pdf("rev0").conteudo.length);
    const f = await lerArquivo(eng, v1.id);
    expect(f!.bytes.equals(pdf("rev0").conteudo)).toBe(true);
    expect(f!.nome).toBe("rev0.pdf");
    expect(await lerArquivo(outro, v1.id)).toBeNull();
    await expect(consulta("update documento_versao set mudanca = 'x' where id = $1", [v1.id])).rejects.toThrow(/históricos/);
    await expect(consulta("update documento_versao set sha256 = $2 where id = $1", [v1.id, "0".repeat(64)])).rejects.toThrow(/históricos/);
    await expect(consulta("delete from documento_versao where id = $1", [v1.id])).rejects.toThrow();
  });
});

describe("mudança dos arquivos que estão no banco", () => {
  it("copia e confere, libera o banco só depois, e pode rodar de novo", async () => {
    usarBanco();
    const { obraId, diarioId } = await diarioAberto();
    const fotoId = await enviarFoto(campo, foto(obraId, diarioId, "antiga"));
    const docId = await enviarDocumento(eng, obraId, { categoria: "projeto", tipo: "Projeto", titulo: "Antigo" }, pdf("antigo"));
    const [vAntiga] = await consulta("select id, conteudo, arquivo from documento_versao where documento_id = $1", [docId]);
    expect(vAntiga.conteudo).not.toBeNull();
    expect(vAntiga.arquivo).toBeNull();

    usarStorage();
    const arm = armazenamento()!;
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    try {
      const r1 = await moverArquivos(c, arm);
      expect(r1.falhas).toEqual([]);
      expect(r1.fotosCopiadas).toBeGreaterThanOrEqual(1);
      expect(r1.versoesCopiadas).toBeGreaterThanOrEqual(1);
      const [f1] = await consulta("select conteudo is not null as no_banco, arquivo from foto where id = $1", [fotoId]);
      expect(f1.no_banco).toBe(true);
      expect(f1.arquivo).toBe(`${orgao}/fotos/${obraId}/${fotoId}.jpg`);
      expect((await lerFoto(campo, fotoId, false))!.bytes.equals(jpeg("antiga"))).toBe(true);

      // Arquivo perdido no armazenamento: a liberação não apaga o banco.
      const [v] = await consulta("select arquivo from documento_versao where id = $1", [vAntiga.id]);
      const guardado = objetos.get(`arquivos/${v.arquivo}`)!;
      objetos.delete(`arquivos/${v.arquivo}`);
      const r2 = await moverArquivos(c, arm, { liberar: true });
      expect(r2.falhas.map((x) => x.id)).toContain(vAntiga.id);
      expect((await consulta("select conteudo from documento_versao where id = $1", [vAntiga.id]))[0].conteudo).not.toBeNull();
      expect((await lerArquivo(eng, vAntiga.id))!.bytes.equals(pdf("antigo").conteudo)).toBe(true);

      objetos.set(`arquivos/${v.arquivo}`, guardado);
      const r3 = await moverArquivos(c, arm, { liberar: true });
      expect(r3.falhas).toEqual([]);
      expect(r3.restantes).toEqual({ fotos: 0, versoes: 0, bytes: 0 });
      const [f3] = await consulta("select conteudo, miniatura from foto where id = $1", [fotoId]);
      expect(f3.conteudo).toBeNull();
      expect(f3.miniatura).toBeNull();
      expect((await lerFoto(campo, fotoId, true))!.bytes.equals(jpeg("mini-antiga"))).toBe(true);
      expect((await lerArquivo(eng, vAntiga.id))!.bytes.equals(pdf("antigo").conteudo)).toBe(true);
      expect(await lerArquivo(outro, vAntiga.id)).toBeNull();

      const r4 = await moverArquivos(c, arm, { liberar: true });
      expect(r4.fotosCopiadas + r4.versoesCopiadas + r4.fotosLiberadas + r4.versoesLiberadas).toBe(0);
    } finally {
      await c.end();
    }
  });
});
