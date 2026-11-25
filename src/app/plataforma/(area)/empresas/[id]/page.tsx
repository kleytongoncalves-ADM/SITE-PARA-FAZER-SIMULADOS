import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, KeyRound, Pencil } from "lucide-react";
import { listarFuncionarios, obterEmpresa, ROTULO_ESFERA, type Funcionario } from "@/servicos/plataforma";
import { PERFIS, ROTULO_PERFIL, type Perfil } from "@/servicos/rotulos";
import { BotaoEmpresaAtiva, BotaoFuncionarioAtivo, FormEmpresa, FormFuncionario, FormSenha } from "../../Formularios";

export const metadata: Metadata = { title: "Empresa · Administração" };

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export default async function PaginaEmpresa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  const { id } = await params;
  const { nova } = await searchParams;
  const empresa = await obterEmpresa(id);
  if (!empresa) notFound();
  const funcionarios = await listarFuncionarios(id);
  const porCargo = new Map<Perfil, Funcionario[]>();
  for (const f of funcionarios) porCargo.set(f.perfil, [...(porCargo.get(f.perfil) ?? []), f]);
  const comGente = PERFIS.filter((p) => porCargo.has(p));
  const vazios = PERFIS.filter((p) => !porCargo.has(p));

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo"><Link href="/plataforma" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={14} />Empresas</Link></div>
          <h1 className="titulo" style={{ overflowWrap: "anywhere" }}>{empresa.nome}</h1>
          <p className="subtitulo">
            {ROTULO_ESFERA[empresa.esfera]}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""} · {empresa.municipio ? `${empresa.municipio}/` : ""}{empresa.uf} · <b>{empresa.ativos}</b> {empresa.ativos === 1 ? "funcionário ativo" : "funcionários ativos"}
            {!empresa.ativo && <> · <span className="etiqueta et-neutra">Desativada</span></>}
          </p>
        </div>
        <BotaoEmpresaAtiva empresaId={empresa.id} ativo={empresa.ativo} />
      </div>

      {nova && (
        <div className="aviso aviso-ok" role="status" style={{ marginBottom: 16 }}>
          <Building2 />Empresa cadastrada. Agora crie o acesso dos funcionários no formulário ao lado.
        </div>
      )}

      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div>
          <h2 className="cartao-titulo" style={{ marginBottom: 12 }}>Funcionários por cargo</h2>
          {comGente.length === 0 ? (
            <div className="cartao vazio">
              <b>Nenhum funcionário ainda</b>
              Crie o primeiro acesso no formulário ao lado. A pessoa entra em /login com o e-mail e a senha que você definir.
            </div>
          ) : (
            <div className="cargos">
              {comGente.map((cargo, i) => {
                const lista = porCargo.get(cargo)!;
                return (
                  <section key={cargo} className="cartao surgir" style={{ "--i": i, padding: 16 } as React.CSSProperties}>
                    <div className="cargo-titulo">
                      <h3>{ROTULO_PERFIL[cargo]}</h3>
                      <span className="etiqueta et-azul num">{lista.filter((f) => f.ativo).length}</span>
                    </div>
                    {lista.map((f) => (
                      <div key={f.id} className="pessoa-linha" style={{ opacity: f.ativo ? 1 : 0.6 }}>
                        <span className="avatar" aria-hidden="true">{iniciais(f.nome)}</span>
                        <div className="pessoa-corpo">
                          <div className="forte">{f.nome}</div>
                          <div className="fraco">{f.email}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {f.administrador && <span className="etiqueta et-laranja">Administra a empresa</span>}
                            {!f.ativo && <span className="etiqueta et-neutra">Desativado</span>}
                            {f.bloqueado && <span className="etiqueta et-vermelha">Bloqueado por tentativas</span>}
                          </div>
                          <div className="pessoa-acoes">
                            <BotaoFuncionarioAtivo orgaoId={empresa.id} usuarioId={f.id} ativo={f.ativo} nome={f.nome} />
                          </div>
                          <details className="gaveta" style={{ marginTop: 8 }}>
                            <summary className="botao botao-texto" style={{ fontSize: 12.5 }}><Pencil size={13} />Editar dados e cargo</summary>
                            <div className="gaveta-corpo">
                              <FormFuncionario
                                orgaoId={empresa.id}
                                usuarioId={f.id}
                                inicial={{ nome: f.nome, email: f.email, perfil: f.perfil, registroProfissional: f.registroProfissional ?? "" }}
                                administrador={f.administrador}
                              />
                            </div>
                          </details>
                          <details className="gaveta" style={{ marginTop: 4 }}>
                            <summary className="botao botao-texto" style={{ fontSize: 12.5 }}><KeyRound size={13} />Trocar senha</summary>
                            <div className="gaveta-corpo"><FormSenha orgaoId={empresa.id} usuarioId={f.id} /></div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
          {comGente.length > 0 && vazios.length > 0 && (
            <p className="cargos-vazios">Cargos sem ninguém: {vazios.map((p) => ROTULO_PERFIL[p]).join(", ")}.</p>
          )}
        </div>

        <div className="grade" style={{ alignItems: "start" }}>
          <section className="cartao surgir" style={{ "--i": 1 } as React.CSSProperties}>
            <h2 className="cartao-titulo">Novo funcionário</h2>
            <p className="cartao-sub" style={{ marginBottom: 14 }}>A pessoa entra em /login com este e-mail e esta senha. Ninguém é excluído, só desativado.</p>
            <FormFuncionario orgaoId={empresa.id} />
          </section>
          <details className="cartao gaveta surgir" style={{ "--i": 2 } as React.CSSProperties}>
            <summary className="cartao-titulo" style={{ display: "flex", alignItems: "center", gap: 8 }}><Pencil size={15} />Dados da empresa</summary>
            <FormEmpresa
              empresaId={empresa.id}
              inicial={{ nome: empresa.nome, cnpj: empresa.cnpj ?? "", esfera: empresa.esfera, uf: empresa.uf, municipio: empresa.municipio ?? "" }}
            />
          </details>
        </div>
      </div>
    </>
  );
}
