"use client";

import { useCallback, useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Search, UserPlus } from "lucide-react";
import { Janela } from "@/componentes/Janela";
import { PERFIS, ROTULO_PERFIL, type Perfil } from "@/servicos/rotulos";
import { BotaoEmpresaAtiva, BotaoFuncionarioAtivo, FormEmpresa, FormFuncionario, FormSenha } from "./Formularios";

type Pessoa = {
  id: string; nome: string; email: string; perfil: Perfil; administrador: boolean; ativo: boolean;
  registroProfissional: string | null; bloqueado: boolean;
};

type EmpresaDados = { id: string; nome: string; cnpj: string; esfera: string; uf: string; municipio: string; ativo: boolean };

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Botões do cabeçalho da empresa: editar dados e desativar. */
export function AcoesEmpresa({ empresa }: { empresa: EmpresaDados }) {
  const [aberta, setAberta] = useState(false);
  const fechar = useCallback(() => setAberta(false), []);
  return (
    <div className="acoes-cabecalho">
      <button type="button" className="botao botao-neutro" onClick={() => setAberta(true)}><Pencil />Editar<span className="so-largo"> empresa</span></button>
      <BotaoEmpresaAtiva empresaId={empresa.id} ativo={empresa.ativo} />
      <Janela titulo="Editar empresa" aberta={aberta} aoFechar={fechar}>
        <FormEmpresa
          empresaId={empresa.id}
          inicial={{ nome: empresa.nome, cnpj: empresa.cnpj, esfera: empresa.esfera, uf: empresa.uf, municipio: empresa.municipio }}
          aoConcluir={fechar}
        />
      </Janela>
    </div>
  );
}

/** Botão "Nova empresa" do quadro, com o formulário em janela. */
export function NovaEmpresa({ abrirJa = false }: { abrirJa?: boolean }) {
  const [aberta, setAberta] = useState(abrirJa);
  const fechar = useCallback(() => setAberta(false), []);
  return (
    <>
      <button type="button" className="botao botao-primario" onClick={() => setAberta(true)}><Plus />Nova empresa</button>
      <Janela titulo="Nova empresa" aberta={aberta} aoFechar={fechar}>
        <FormEmpresa />
      </Janela>
    </>
  );
}

type Modo = { tipo: "novo" } | { tipo: "editar"; p: Pessoa } | { tipo: "senha"; p: Pessoa } | null;

export function Equipe({ empresaId, pessoas }: { empresaId: string; pessoas: Pessoa[] }) {
  const [busca, setBusca] = useState("");
  const [cargo, setCargo] = useState<Perfil | "">("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [modo, setModo] = useState<Modo>(null);
  const fechar = useCallback(() => setModo(null), []);

  const inativos = pessoas.filter((p) => !p.ativo).length;
  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((p) =>
      (mostrarInativos || p.ativo) &&
      (!cargo || p.perfil === cargo) &&
      (!termo || semAcento(`${p.nome} ${p.email} ${p.registroProfissional ?? ""}`).includes(termo)),
    );
  }, [pessoas, busca, cargo, mostrarInativos]);

  const grupos = PERFIS.map((perfil) => ({ perfil, lista: filtradas.filter((p) => p.perfil === perfil) })).filter((g) => g.lista.length);
  const contagem = (perfil: Perfil) => pessoas.filter((p) => p.perfil === perfil && (mostrarInativos || p.ativo)).length;

  return (
    <section className="cartao equipe">
      <div className="equipe-barra">
        <h2 className="cartao-titulo">Funcionários</h2>
        <button type="button" className="botao botao-primario" onClick={() => setModo({ tipo: "novo" })}><UserPlus />Novo funcionário</button>
      </div>

      {pessoas.length > 0 && (
        <div className="equipe-filtros">
          <label className="equipe-busca">
            <Search aria-hidden="true" />
            <input type="search" placeholder="Buscar por nome, e-mail ou CREA/CAU" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar funcionário" />
          </label>
          <select className="entrada-texto" value={cargo} onChange={(e) => setCargo(e.target.value as Perfil | "")} aria-label="Filtrar por cargo">
            <option value="">Todos os cargos</option>
            {PERFIS.map((p) => <option key={p} value={p}>{ROTULO_PERFIL[p]} ({contagem(p)})</option>)}
          </select>
          {inativos > 0 && (
            <label className="interruptor interruptor-pequeno">
              <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
              <span className="interruptor-trilho" aria-hidden="true" />
              <span>Inativos ({inativos})</span>
            </label>
          )}
        </div>
      )}

      {pessoas.length === 0 ? (
        <div className="vazio equipe-vazia">
          <b>Nenhum funcionário cadastrado</b>
          <button type="button" className="botao botao-neutro" onClick={() => setModo({ tipo: "novo" })}><UserPlus />Cadastrar o primeiro</button>
        </div>
      ) : grupos.length === 0 ? (
        <div className="vazio">Nenhum funcionário encontrado.</div>
      ) : (
        <div className="equipe-grupos">
          {grupos.map(({ perfil, lista }) => (
            <div key={perfil} className="equipe-grupo">
              <h3 className="equipe-grupo-titulo">{ROTULO_PERFIL[perfil]}<span className="num">{lista.length}</span></h3>
              <ul className="equipe-lista">
                {lista.map((p) => (
                  <li key={p.id} className={p.ativo ? "pessoa-item" : "pessoa-item pessoa-inativa"}>
                    <span className="avatar" aria-hidden="true">{iniciais(p.nome)}</span>
                    <div className="pessoa-item-corpo">
                      <div className="pessoa-item-nome">
                        <span className="forte">{p.nome}</span>
                        {p.administrador && <span className="etiqueta et-laranja">Administrador</span>}
                        {!p.ativo && <span className="etiqueta et-neutra">Inativo</span>}
                        {p.bloqueado && <span className="etiqueta et-vermelha">Bloqueado</span>}
                      </div>
                      <div className="fraco pessoa-item-email">{p.email}{p.registroProfissional ? ` · ${p.registroProfissional}` : ""}</div>
                    </div>
                    <div className="pessoa-item-acoes">
                      <button type="button" className="icone-acao" onClick={() => setModo({ tipo: "editar", p })} aria-label={`Editar ${p.nome}`} title="Editar"><Pencil /></button>
                      <button type="button" className="icone-acao" onClick={() => setModo({ tipo: "senha", p })} aria-label={`Alterar a senha de ${p.nome}`} title={p.bloqueado ? "Alterar senha e desbloquear" : "Alterar senha"}><KeyRound /></button>
                      <BotaoFuncionarioAtivo orgaoId={empresaId} usuarioId={p.id} ativo={p.ativo} nome={p.nome} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Janela titulo="Novo funcionário" aberta={modo?.tipo === "novo"} aoFechar={fechar}>
        <FormFuncionario orgaoId={empresaId} aoConcluir={fechar} />
      </Janela>
      <Janela titulo={modo?.tipo === "editar" ? `Editar ${modo.p.nome}` : "Editar"} aberta={modo?.tipo === "editar"} aoFechar={fechar}>
        {modo?.tipo === "editar" && (
          <FormFuncionario
            orgaoId={empresaId}
            usuarioId={modo.p.id}
            inicial={{ nome: modo.p.nome, email: modo.p.email, perfil: modo.p.perfil, registroProfissional: modo.p.registroProfissional ?? "" }}
            administrador={modo.p.administrador}
            aoConcluir={fechar}
          />
        )}
      </Janela>
      <Janela titulo={modo?.tipo === "senha" ? `Senha de ${modo.p.nome}` : "Senha"} aberta={modo?.tipo === "senha"} aoFechar={fechar} largura={460}>
        {modo?.tipo === "senha" && <FormSenha orgaoId={empresaId} usuarioId={modo.p.id} aoConcluir={fechar} />}
      </Janela>
    </section>
  );
}
