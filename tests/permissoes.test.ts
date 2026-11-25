import { describe, expect, it } from "vitest";
import { pode } from "../src/servicos/permissoes";
import { PERFIS } from "../src/servicos/rotulos";
import { proximasSituacoes } from "../src/servicos/rotulos";

describe("permissões por perfil", () => {
  it("só direção, engenheiro e administrativo cadastram obra", () => {
    const quemPode = PERFIS.filter((perfil) => pode({ perfil, administrador: false }, "obra.criar"));
    expect(quemPode.sort()).toEqual(["administrativo", "direcao", "engenheiro"]);
  });

  it("campo, fiscal, financeiro e contratada não mudam a situação da obra", () => {
    for (const perfil of ["campo", "fiscal", "financeiro", "contratada"] as const)
      expect(pode({ perfil, administrador: false }, "obra.mudar_situacao")).toBe(false);
  });

  it("nenhum perfil gerencia usuários sem ser administrador", () => {
    for (const perfil of PERFIS) expect(pode({ perfil, administrador: false }, "usuario.gerenciar")).toBe(false);
  });

  it("o administrador do sistema pode tudo", () => {
    expect(pode({ perfil: "campo", administrador: true }, "usuario.gerenciar")).toBe(true);
    expect(pode({ perfil: "campo", administrador: true }, "auditoria.ver")).toBe(true);
  });

  it("só a direção vê todas as obras do órgão", () => {
    const quemPode = PERFIS.filter((perfil) => pode({ perfil, administrador: false }, "obra.ver_todas"));
    expect(quemPode).toEqual(["direcao"]);
  });

  it("execução direta pode ir de orçada para em execução, e por contratada não", () => {
    expect(proximasSituacoes("orcada", "direta")).toContain("em_execucao");
    expect(proximasSituacoes("orcada", "contratada")).not.toContain("em_execucao");
    expect(proximasSituacoes("recebida_definitivamente", "contratada")).toEqual([]);
  });
});
