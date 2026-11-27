"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, Pencil, UserPlus } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { DESCRICAO_PAPEL, PAPEIS, ROTULO_PAPEL } from "@/servicos/papeis-fornecedor";
import type { UsuarioDaEmpresa } from "@/servicos/fornecedores";
import { acaoAlterarUsuario, acaoCriarUsuario, acaoSenhaDoUsuario, type Estado } from "../../acoes";

const erro = (e: Estado, k: string) => (e.erros?.[k] ? <span className="erro">{e.erros[k]}</span> : null);

/** Usuários da empresa: cada um com o próprio acesso e a sua permissão. */
export function Usuarios({ usuarios, admin }: { usuarios: UsuarioDaEmpresa[]; admin: boolean }) {
  return (
    <div className="grade" style={{ gap: 12, marginTop: 12 }}>
      <ul className="usuarios-lista">
        {usuarios.map((u) => <LinhaUsuario key={u.id} u={u} admin={admin} />)}
      </ul>
      {admin && <NovoUsuario />}
      <dl className="papeis-legenda">
        {PAPEIS.map((p) => <div key={p}><dt>{ROTULO_PAPEL[p]}</dt><dd>{DESCRICAO_PAPEL[p]}</dd></div>)}
      </dl>
    </div>
  );
}

function LinhaUsuario({ u, admin }: { u: UsuarioDaEmpresa; admin: boolean }) {
  const [aberto, setAberto] = useState<"editar" | "senha" | null>(null);
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoAlterarUsuario.bind(null, u.id), {});
  const [ss, acaoSenha, enviandoSenha] = useActionState<Estado, FormData>(acaoSenhaDoUsuario.bind(null, u.id), {});
  return (
    <li className={`usuario-linha ${u.ativo ? "" : "inativo"}`}>
      <div className="usuario-topo">
        <span className="avatar" aria-hidden="true">{u.nome.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>
        <div style={{ minWidth: 0 }}>
          <b>{u.nome}{u.voce && <span className="fraco"> (você)</span>}</b>
          <span className="fraco">{u.email}{u.cargo ? ` · ${u.cargo}` : ""}</span>
        </div>
        <span className={`etiqueta ${u.papel === "administrador" ? "et-azul" : u.papel === "cotacoes" ? "et-verde" : "et-neutra"}`}>{ROTULO_PAPEL[u.papel]}</span>
        {!u.ativo && <span className="etiqueta et-vermelha">Inativo</span>}
        {admin && (
          <span className="usuario-acoes">
            <button type="button" className="botao botao-texto botao-pequeno" onClick={() => setAberto(aberto === "editar" ? null : "editar")} aria-expanded={aberto === "editar"}><Pencil /> Alterar</button>
            {!u.voce && <button type="button" className="botao botao-texto botao-pequeno" onClick={() => setAberto(aberto === "senha" ? null : "senha")} aria-expanded={aberto === "senha"}><KeyRound /> Senha</button>}
          </span>
        )}
      </div>
      {aberto === "editar" && (
        <form action={acao} className="grade-form usuario-form">
          <div className="c12"><Avisos erro={s.erro} ok={s.ok} /></div>
          <div className="campo c4"><label htmlFor={`c-${u.id}`}>Cargo</label><input id={`c-${u.id}`} name="cargo" className="entrada-texto" defaultValue={u.cargo ?? ""} maxLength={80} placeholder="Responsável comercial" /></div>
          <div className="campo c4"><label htmlFor={`p-${u.id}`}>Permissão</label><select id={`p-${u.id}`} name="papel" className="entrada-texto" defaultValue={u.papel}>{PAPEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}</select></div>
          <label className="opcao-check c4" style={{ alignSelf: "end" }}><input type="checkbox" name="ativo" defaultChecked={u.ativo} /> Acesso ativo</label>
          <div className="c12 rodape-form"><button className="botao botao-primario botao-pequeno" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</button></div>
        </form>
      )}
      {aberto === "senha" && (
        <form action={acaoSenha} className="grade-form usuario-form">
          <div className="c12"><Avisos erro={ss.erro} ok={ss.ok} /></div>
          <div className="campo c6"><label htmlFor={`s-${u.id}`}>Nova senha para {u.nome.split(" ")[0]}</label><input id={`s-${u.id}`} name="senha" type="text" className="entrada-texto" required minLength={6} maxLength={10} autoComplete="off" /></div>
          <div className="c6 rodape-form" style={{ alignSelf: "end" }}><button className="botao botao-primario botao-pequeno" disabled={enviandoSenha}>{enviandoSenha ? "Salvando…" : "Definir senha"}</button></div>
          <p className="cartao-sub c12">6 a 10 caracteres, com letra, número e caractere especial. Passe a senha para a pessoa por um canal seguro.</p>
        </form>
      )}
    </li>
  );
}

function NovoUsuario() {
  const [aberto, setAberto] = useState(false);
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoCriarUsuario, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.ok) ref.current?.reset(); }, [s]);
  if (!aberto) return <div><button type="button" className="botao botao-neutro" onClick={() => setAberto(true)}><UserPlus /> Novo usuário</button>{s.ok && <Avisos ok={s.ok} />}</div>;
  return (
    <form ref={ref} action={acao} className="grade-form usuario-form">
      <div className="c12"><Avisos erro={s.erros ? undefined : s.erro} ok={s.ok} /></div>
      <div className="campo c6"><label htmlFor="n-nome">Nome</label><input id="n-nome" name="nome" className="entrada-texto" required maxLength={120} />{erro(s, "nome")}</div>
      <div className="campo c6"><label htmlFor="n-email">E-mail de acesso</label><input id="n-email" name="email" type="email" className="entrada-texto" required maxLength={160} />{erro(s, "email")}</div>
      <div className="campo c4"><label htmlFor="n-cargo">Cargo</label><input id="n-cargo" name="cargo" className="entrada-texto" maxLength={80} placeholder="Responsável por orçamentos" /></div>
      <div className="campo c4"><label htmlFor="n-papel">Permissão</label><select id="n-papel" name="papel" className="entrada-texto" defaultValue="cotacoes">{PAPEIS.map((p) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}</select>{erro(s, "papel")}</div>
      <div className="campo c4"><label htmlFor="n-senha">Senha inicial</label><input id="n-senha" name="senha" type="text" className="entrada-texto" required minLength={6} maxLength={10} autoComplete="off" />{erro(s, "senha")}</div>
      <p className="cartao-sub c8">6 a 10 caracteres, com letra, número e caractere especial. A pessoa pode trocar depois de entrar.</p>
      <div className="c4 rodape-form"><button type="button" className="botao botao-texto" onClick={() => setAberto(false)}>Cancelar</button><button className="botao botao-primario" disabled={enviando}><UserPlus /> {enviando ? "Criando…" : "Criar usuário"}</button></div>
    </form>
  );
}
