import { afterAll, describe, expect, it } from "vitest";
import { fecharPool, opcoesDeConexao, pool } from "../src/lib/db";
import { instalar, precisaInstalar } from "../src/servicos/instalacao";
import { entrarPlataforma } from "../src/servicos/plataforma";

afterAll(fecharPool);

const dados = { nome: "Dona da Plataforma", email: "dona@teste.exemplo", senha: "SenhaDeTeste123" };

describe("conexão com o banco", () => {
  it("não cifra a conexão local", () => {
    expect(opcoesDeConexao("postgres://a:b@localhost:5432/x").ssl).toBe(false);
  });
  it("cifra e confere o certificado em banco remoto, mesmo que a URL peça menos", () => {
    const o = opcoesDeConexao("postgres://a:b@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=disable");
    expect(o.connectionString).not.toContain("sslmode");
    expect(o.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((o.ssl as { ca: string }).ca).toContain("BEGIN CERTIFICATE");
    expect(opcoesDeConexao("postgres://a:b@banco.exemplo.org/x").ssl).toEqual({ rejectUnauthorized: true });
  });
});

describe("proteção das tabelas sem isolamento por órgão", () => {
  it("liga a proteção por linha em órgão, usuário, sessão e migração", async () => {
    const r = await pool().query(
      "select relname from pg_class where relname in ('orgao','usuario','sessao','migracao','dono_plataforma','sessao_plataforma') and relrowsecurity and relforcerowsecurity order by 1",
    );
    expect(r.rows.map((l) => l.relname)).toEqual(["dono_plataforma", "migracao", "orgao", "sessao", "sessao_plataforma", "usuario"]);
  });
  it("não deixa funções executáveis por qualquer papel", async () => {
    const r = await pool().query("select has_function_privilege('public', 'mudar_situacao_obra(uuid, situacao_obra, text, text)', 'execute') as pode").catch(() => null);
    if (r) expect(r.rows[0].pode).toBe(false);
  });
});

describe("primeiro acesso", () => {
  it("valida os dados antes de gravar", async () => {
    await expect(instalar({ ...dados, email: "sem-arroba" }, "")).rejects.toThrow("e-mail válido");
    await expect(instalar({ ...dados, senha: "curta" }, "")).rejects.toThrow("10 caracteres");
  });
  it("exige o código de instalação quando ele está definido", async () => {
    process.env.CODIGO_INSTALACAO = "codigo-de-teste-123";
    try {
      await expect(instalar(dados, "errado")).rejects.toThrow("Código de instalação incorreto");
    } finally {
      delete process.env.CODIGO_INSTALACAO;
    }
  });
  it("cria só o dono da plataforma, com nome, e-mail e senha, e depois se fecha", async () => {
    await pool().query("delete from sessao_plataforma");
    const jaTem = !(await precisaInstalar());
    if (!jaTem) {
      await instalar(dados, "");
      expect(await precisaInstalar()).toBe(false);
      const r = await entrarPlataforma(dados.email, dados.senha);
      expect(r.ok).toBe(true);
    }
    await expect(instalar({ ...dados, email: "outra@teste.exemplo" }, "")).rejects.toThrow("já foi instalado");
  });
});
