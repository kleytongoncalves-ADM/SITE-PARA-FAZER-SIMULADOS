import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { comContexto, fecharPool, pool } from "../src/lib/db";
import { entrar, gerarHashSenha } from "../src/servicos/auth";
import {
  alterarFuncionario, criarEmpresa, criarFuncionario, definirEmpresaAtiva, definirFuncionarioAtivo, donoDaSessao,
  entrarPlataforma, listarEmpresas, listarFuncionarios, redefinirSenha, trocarSenhaDono, type Dono,
} from "../src/servicos/plataforma";
import { SENHA } from "./apoio";

afterAll(fecharPool);

let dono: Dono;
const emailDono = `dono.${randomUUID().slice(0, 8)}@teste.exemplo`;

beforeAll(async () => {
  const r = await pool().query(
    "insert into dono_plataforma (nome, email, senha_hash) values ('Dono de Teste', $1, $2) returning id, nome, email",
    [emailDono, gerarHashSenha(SENHA)],
  );
  dono = r.rows[0];
});

const email = (p: string) => `${p}.${randomUUID().slice(0, 8)}@teste.exemplo`;

describe("login da administração da plataforma", () => {
  it("entra só com e-mail e senha e tem sessão própria", async () => {
    const r = await entrarPlataforma(emailDono.toUpperCase(), SENHA);
    expect(r.ok).toBe(true);
    if (r.ok) expect((await donoDaSessao(r.token))?.email).toBe(emailDono);
    expect((await entrarPlataforma(emailDono, "errada")).ok).toBe(false);
  });
  it("o login do dono não abre o sistema das empresas, e o de funcionário não abre a plataforma", async () => {
    expect((await entrar(emailDono, SENHA)).ok).toBe(false);
    const orgao = await criarEmpresa(dono, { nome: "Empresa X", esfera: "empresa_privada", uf: "RJ" });
    const e = email("func");
    await criarFuncionario(dono, orgao, { nome: "Func X", email: e, perfil: "fiscal", senha: SENHA });
    expect((await entrarPlataforma(e, SENHA)).ok).toBe(false);
  });
});

describe("empresas e funcionários", () => {
  it("cadastra empresa sem CNPJ e valida os campos", async () => {
    await expect(criarEmpresa(dono, { nome: "", esfera: "x", uf: "R" })).rejects.toMatchObject({
      erros: { nome: expect.any(String), esfera: expect.any(String), uf: expect.any(String) },
    });
    await expect(criarEmpresa(dono, { nome: "Com CNPJ ruim", cnpj: "123", esfera: "municipal", uf: "RJ" })).rejects.toMatchObject({
      erros: { cnpj: "O CNPJ precisa ter 14 números." },
    });
    const id = await criarEmpresa(dono, { nome: "Construtora Teste", esfera: "empresa_privada", uf: "rj", municipio: "Niterói" });
    const e = (await listarEmpresas()).find((x) => x.id === id)!;
    expect(e).toMatchObject({ nome: "Construtora Teste", uf: "RJ", cnpj: null, ativo: true, funcionarios: 0 });
  });

  it("cria funcionários que entram em /login e conta por cargo", async () => {
    const orgao = await criarEmpresa(dono, { nome: "Empresa Cargos", esfera: "empresa_privada", uf: "RJ" });
    const e1 = email("gestor");
    await criarFuncionario(dono, orgao, { nome: "Gestora Um", email: e1, perfil: "gestor_contrato", senha: SENHA });
    await criarFuncionario(dono, orgao, { nome: "Gestor Dois", email: email("gestor"), perfil: "gestor_contrato", senha: SENHA });
    await criarFuncionario(dono, orgao, { nome: "Fiscal Um", email: email("fiscal"), perfil: "fiscal", senha: SENHA, administrador: true });
    const resumo = (await listarEmpresas()).find((x) => x.id === orgao)!;
    expect(resumo.porCargo).toEqual({ gestor_contrato: 2, fiscal: 1 });
    expect(resumo.ativos).toBe(3);
    const login = await entrar(e1, SENHA);
    expect(login.ok && login.usuario.orgaoId).toBe(orgao);
    // A auditoria registra que foi o dono da plataforma quem criou.
    const n = await comContexto({ usuarioId: null, orgaoId: orgao }, async (c) =>
      (await c.query("select count(*)::int as n from auditoria where operador_id = $1 and acao = 'criou'", [dono.id])).rows[0].n);
    expect(n).toBe(3);
  });

  it("recusa senha fraca e e-mail repetido", async () => {
    const orgao = await criarEmpresa(dono, { nome: "Empresa Senhas", esfera: "empresa_privada", uf: "RJ" });
    await expect(criarFuncionario(dono, orgao, { nome: "Pessoa", email: email("p"), perfil: "campo", senha: "123456" })).rejects.toMatchObject({
      erros: { senha: expect.stringContaining("letra") },
    });
    const e = email("rep");
    await criarFuncionario(dono, orgao, { nome: "Pessoa", email: e, perfil: "campo", senha: SENHA });
    await expect(criarFuncionario(dono, orgao, { nome: "Outra", email: e, perfil: "campo", senha: SENHA })).rejects.toThrow("Já existe um usuário com este e-mail");
  });

  it("muda o cargo, troca a senha, desativa e reativa", async () => {
    const orgao = await criarEmpresa(dono, { nome: "Empresa Mudanças", esfera: "empresa_privada", uf: "RJ" });
    const e = email("muda");
    const id = await criarFuncionario(dono, orgao, { nome: "Pessoa Muda", email: e, perfil: "campo", senha: SENHA });
    await alterarFuncionario(dono, orgao, id, { nome: "Pessoa Mudada", email: e, perfil: "engenheiro" });
    expect((await listarFuncionarios(orgao))[0]).toMatchObject({ nome: "Pessoa Mudada", perfil: "engenheiro" });
    await redefinirSenha(dono, orgao, id, "Outra#456");
    expect((await entrar(e, SENHA)).ok).toBe(false);
    expect((await entrar(e, "Outra#456")).ok).toBe(true);
    await definirFuncionarioAtivo(dono, orgao, id, false);
    expect(await entrar(e, "Outra#456")).toMatchObject({ ok: false, motivo: "inativo" });
    await definirFuncionarioAtivo(dono, orgao, id, true);
    expect((await entrar(e, "Outra#456")).ok).toBe(true);
  });

  it("não mexe em funcionário de outra empresa", async () => {
    const a = await criarEmpresa(dono, { nome: "Empresa A", esfera: "empresa_privada", uf: "RJ" });
    const b = await criarEmpresa(dono, { nome: "Empresa B", esfera: "empresa_privada", uf: "RJ" });
    const id = await criarFuncionario(dono, a, { nome: "Pessoa A", email: email("a"), perfil: "campo", senha: SENHA });
    await expect(definirFuncionarioAtivo(dono, b, id, false)).rejects.toThrow("Funcionário não encontrado");
  });

  it("desativar a empresa tira o acesso de todos e encerra as sessões", async () => {
    const orgao = await criarEmpresa(dono, { nome: "Empresa Desligada", esfera: "empresa_privada", uf: "RJ" });
    const e = email("des");
    await criarFuncionario(dono, orgao, { nome: "Pessoa", email: e, perfil: "campo", senha: SENHA });
    const antes = await entrar(e, SENHA);
    await definirEmpresaAtiva(dono, orgao, false);
    expect(await entrar(e, SENHA)).toMatchObject({ ok: false, motivo: "inativo" });
    const s = await pool().query("select count(*)::int as n from sessao s join usuario u on u.id = s.usuario_id where u.orgao_id = $1", [orgao]);
    expect(s.rows[0].n).toBe(0);
    expect(antes.ok).toBe(true);
    await definirEmpresaAtiva(dono, orgao, true);
    expect((await entrar(e, SENHA)).ok).toBe(true);
  });
});

describe("conta do dono", () => {
  it("troca a própria senha só com a senha atual certa", async () => {
    const r = await pool().query(
      "insert into dono_plataforma (nome, email, senha_hash) values ('Outro Dono', $1, $2) returning id, nome, email",
      [email("outro"), gerarHashSenha(SENHA)],
    );
    const d = r.rows[0] as Dono;
    await expect(trocarSenhaDono(d, "errada", "Nova@123")).rejects.toMatchObject({ erros: { atual: "Senha atual incorreta." } });
    await expect(trocarSenhaDono(d, SENHA, "123456")).rejects.toMatchObject({ erros: { nova: expect.any(String) } });
    await trocarSenhaDono(d, SENHA, "Nova@123");
    expect((await entrarPlataforma(d.email, "Nova@123")).ok).toBe(true);
    expect((await entrarPlataforma(d.email, SENHA)).ok).toBe(false);
  });
});
