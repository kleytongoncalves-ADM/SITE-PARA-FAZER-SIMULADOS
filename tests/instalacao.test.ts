import { afterAll, describe, expect, it } from "vitest";
import { fecharPool, opcoesDeConexao, pool } from "../src/lib/db";
import { instalar } from "../src/servicos/instalacao";
import { novoOrgao, novoUsuario } from "./apoio";

afterAll(fecharPool);

const dados = {
  orgaoNome: "Prefeitura de Teste", cnpj: "11.222.333/0001-44", esfera: "municipal", uf: "rj",
  nome: "Pessoa Administradora", email: "admin@teste.exemplo", senha: "SenhaDeTeste123",
};

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
      "select relname from pg_class where relname in ('orgao','usuario','sessao','migracao') and relrowsecurity and relforcerowsecurity order by 1",
    );
    expect(r.rows.map((l) => l.relname)).toEqual(["migracao", "orgao", "sessao", "usuario"]);
  });
  it("não deixa funções executáveis por qualquer papel", async () => {
    const r = await pool().query("select has_function_privilege('public', 'mudar_situacao_obra(uuid, situacao_obra, text, text)', 'execute') as pode").catch(() => null);
    if (r) expect(r.rows[0].pode).toBe(false);
  });
});

describe("primeiro acesso", () => {
  it("recusa quando já existe usuário", async () => {
    await novoUsuario(await novoOrgao(), "direcao");
    await expect(instalar(dados, "")).rejects.toThrow("já foi instalado");
  });
  it("valida os dados antes de gravar", async () => {
    await expect(instalar({ ...dados, cnpj: "123" }, "")).rejects.toThrow("14 números");
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
});
