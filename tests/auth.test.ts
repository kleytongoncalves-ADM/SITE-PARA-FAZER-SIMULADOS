import { afterAll, describe, expect, it } from "vitest";
import { fecharPool } from "../src/lib/db";
import { conferirSenha, entrar, gerarHashSenha, sair, usuarioDaSessao, validarSenhaNova } from "../src/servicos/auth";
import { definirAtivo } from "../src/servicos/usuarios";
import { novoOrgao, novoUsuario, SENHA } from "./apoio";

afterAll(fecharPool);

describe("senha", () => {
  it("o hash confere com a senha certa e recusa a errada", () => {
    const h = gerarHashSenha("UmaSenhaBoa123");
    expect(h).not.toContain("UmaSenhaBoa123");
    expect(conferirSenha("UmaSenhaBoa123", h)).toBe(true);
    expect(conferirSenha("outra", h)).toBe(false);
  });

  it("exige de 6 a 10 caracteres, com letra, números e um caractere especial", () => {
    expect(validarSenhaNova("a@1")).toContain("de 6 a 10");
    expect(validarSenhaNova("Abcde@12345")).toContain("de 6 a 10");
    expect(validarSenhaNova("123456")).toContain("letra");
    expect(validarSenhaNova("abc@def")).toContain("números");
    expect(validarSenhaNova("abc123")).toContain("caractere especial");
    expect(validarSenhaNova("A@123456")).toBeNull();
    expect(validarSenhaNova("Gestor#10")).toBeNull();
  });
});

describe("login e sessão", () => {
  it("entra com a senha certa, reconhece a sessão e encerra ao sair", async () => {
    const u = await novoUsuario(await novoOrgao(), "engenheiro");
    const r = await entrar(u.email.toUpperCase(), SENHA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await usuarioDaSessao(r.token))?.id).toBe(u.id);
    await sair(r.token);
    expect(await usuarioDaSessao(r.token)).toBeNull();
  });

  it("recusa senha errada e e-mail desconhecido com o mesmo motivo", async () => {
    const u = await novoUsuario(await novoOrgao(), "fiscal");
    expect(await entrar(u.email, "errada")).toEqual({ ok: false, motivo: "credenciais" });
    expect(await entrar("ninguem@teste.exemplo", "errada")).toEqual({ ok: false, motivo: "credenciais" });
  });

  it("bloqueia depois de 5 senhas erradas, mesmo com a senha certa em seguida", async () => {
    const u = await novoUsuario(await novoOrgao(), "campo");
    for (let i = 0; i < 4; i++) expect((await entrar(u.email, "errada")).ok).toBe(false);
    expect(await entrar(u.email, "errada")).toEqual({ ok: false, motivo: "bloqueado" });
    expect(await entrar(u.email, SENHA)).toEqual({ ok: false, motivo: "bloqueado" });
  });

  it("usuário desativado não entra e perde a sessão aberta", async () => {
    const orgao = await novoOrgao();
    const admin = await novoUsuario(orgao, "administrativo", { administrador: true });
    const u = await novoUsuario(orgao, "financeiro");
    const r = await entrar(u.email, SENHA);
    expect(r.ok).toBe(true);
    await definirAtivo(admin, u.id, false);
    if (r.ok) expect(await usuarioDaSessao(r.token)).toBeNull();
    expect(await entrar(u.email, SENHA)).toEqual({ ok: false, motivo: "inativo" });
  });

  it("token inventado não abre sessão", async () => {
    expect(await usuarioDaSessao("token-que-nao-existe")).toBeNull();
    expect(await usuarioDaSessao(undefined)).toBeNull();
  });
});
