"use client";

import { useActionState } from "react";
import { Building2, KeyRound, Save, UserPlus } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { DICA_SENHA, PERFIS, ROTULO_PERFIL, SENHA_MAX, SENHA_MIN } from "@/servicos/rotulos";
import type { Estado } from "../../(sistema)/obras/acoes";
import {
  acaoAlterarEmpresa, acaoAlterarFuncionario, acaoCriarEmpresa, acaoCriarFuncionario, acaoEmpresaAtiva,
  acaoFuncionarioAtivo, acaoRedefinirSenha, acaoTrocarMinhaSenha,
} from "../acoes";

const ESFERAS: [string, string][] = [
  ["empresa_privada", "Empresa privada"],
  ["municipal", "Prefeitura / órgão municipal"],
  ["estadual", "Órgão estadual"],
  ["federal", "Órgão federal"],
  ["empresa_publica", "Empresa pública"],
];

type Valores = Record<string, string | undefined>;

function Campo({ id, rotulo, erro, dica, children }: { id: string; rotulo: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro ? <span className="erro">{erro}</span> : dica ? <span className="dica">{dica}</span> : null}
    </div>
  );
}

export function FormEmpresa({ empresaId, inicial }: { empresaId?: string; inicial?: Valores }) {
  const acaoBase = empresaId ? acaoAlterarEmpresa.bind(null, empresaId) : acaoCriarEmpresa;
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoBase, {});
  const v = (k: string) => estado.valores?.[k] ?? inicial?.[k] ?? "";
  const e = (k: string) => estado.erros?.[k];
  const p = empresaId ? `e-${empresaId}-` : "nova-";
  return (
    <form action={acao} style={{ display: "grid", gap: 14 }}>
      <Avisos erro={estado.erro} ok={estado.ok} />
      <Campo id={p + "nome"} rotulo="Nome" erro={e("nome")}>
        <input id={p + "nome"} name="nome" className="entrada-texto" required defaultValue={v("nome")} aria-invalid={!!e("nome")} />
      </Campo>
      <Campo id={p + "cnpj"} rotulo="CNPJ" erro={e("cnpj")}>
        <input id={p + "cnpj"} name="cnpj" inputMode="numeric" className="entrada-texto" defaultValue={v("cnpj")} aria-invalid={!!e("cnpj")} placeholder="00.000.000/0000-00" />
      </Campo>
      <Campo id={p + "esfera"} rotulo="Tipo" erro={e("esfera")}>
        <select id={p + "esfera"} name="esfera" className="entrada-texto" defaultValue={v("esfera") || "empresa_privada"}>
          {ESFERAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </Campo>
      <div className="instalacao-dupla">
        <Campo id={p + "municipio"} rotulo="Município">
          <input id={p + "municipio"} name="municipio" className="entrada-texto" defaultValue={v("municipio")} />
        </Campo>
        <Campo id={p + "uf"} rotulo="UF" erro={e("uf")}>
          <input id={p + "uf"} name="uf" maxLength={2} required className="entrada-texto" defaultValue={v("uf") || "RJ"} style={{ textTransform: "uppercase" }} aria-invalid={!!e("uf")} />
        </Campo>
      </div>
      <button className="botao botao-primario" disabled={enviando}>
        {empresaId ? <Save /> : <Building2 />}
        {enviando ? "Salvando…" : empresaId ? "Salvar" : "Cadastrar"}
      </button>
    </form>
  );
}

export function BotaoEmpresaAtiva({ empresaId, ativo }: { empresaId: string; ativo: boolean }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoEmpresaAtiva.bind(null, empresaId, !ativo), {});
  return (
    <form
      action={acao}
      onSubmit={(ev) => {
        if (ativo && !confirm("Desativar a empresa? Os funcionários perdem o acesso.")) ev.preventDefault();
      }}
    >
      <button className="botao botao-neutro" disabled={enviando}>{ativo ? "Desativar empresa" : "Reativar empresa"}</button>
      {estado.erro && <div className="fraco" role="alert" style={{ color: "#c23a3a", marginTop: 4 }}>{estado.erro}</div>}
    </form>
  );
}

export function FormFuncionario({ orgaoId, usuarioId, inicial, administrador }: { orgaoId: string; usuarioId?: string; inicial?: Valores; administrador?: boolean }) {
  const acaoBase = usuarioId ? acaoAlterarFuncionario.bind(null, orgaoId, usuarioId) : acaoCriarFuncionario.bind(null, orgaoId);
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoBase, {});
  const novo = !usuarioId;
  // Depois de criar, o formulário volta limpo para o próximo cadastro.
  const v = (k: string) => (novo && estado.ok ? "" : estado.valores?.[k] ?? inicial?.[k] ?? "");
  const e = (k: string) => estado.erros?.[k];
  const p = usuarioId ? `f-${usuarioId}-` : "novo-";
  return (
    <form action={acao} style={{ display: "grid", gap: 12 }} key={novo ? estado.ok ?? "form" : "form"}>
      <Avisos erro={estado.erro} ok={estado.ok} />
      <Campo id={p + "nome"} rotulo="Nome completo" erro={e("nome")}>
        <input id={p + "nome"} name="nome" className="entrada-texto" required defaultValue={v("nome")} aria-invalid={!!e("nome")} />
      </Campo>
      <Campo id={p + "email"} rotulo="E-mail" erro={e("email")}>
        <input id={p + "email"} name="email" type="email" autoComplete="off" className="entrada-texto" required defaultValue={v("email")} aria-invalid={!!e("email")} />
      </Campo>
      <Campo id={p + "perfil"} rotulo="Cargo" erro={e("perfil")}>
        <select id={p + "perfil"} name="perfil" className="entrada-texto" defaultValue={v("perfil") || "gestor_contrato"}>
          {PERFIS.map((x) => <option key={x} value={x}>{ROTULO_PERFIL[x]}</option>)}
        </select>
      </Campo>
      <Campo id={p + "registroProfissional"} rotulo="CREA/CAU">
        <input id={p + "registroProfissional"} name="registroProfissional" className="entrada-texto" defaultValue={v("registroProfissional")} />
      </Campo>
      {novo && (
        <Campo id={p + "senha"} rotulo="Senha" erro={e("senha")} dica={DICA_SENHA}>
          <input id={p + "senha"} name="senha" type="password" autoComplete="new-password" className="entrada-texto" required minLength={SENHA_MIN} maxLength={SENHA_MAX} aria-invalid={!!e("senha")} />
        </Campo>
      )}
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
        <input type="checkbox" name="administrador" defaultChecked={!!administrador} style={{ width: 17, height: 17, accentColor: "#f28c28" }} />
        Administrador
      </label>
      <button className={novo ? "botao botao-primario" : "botao botao-neutro botao-pequeno"} disabled={enviando}>
        {novo ? <UserPlus /> : <Save />}
        {enviando ? "Salvando…" : novo ? "Cadastrar" : "Salvar"}
      </button>
    </form>
  );
}

export function FormSenha({ orgaoId, usuarioId }: { orgaoId: string; usuarioId: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoRedefinirSenha.bind(null, orgaoId, usuarioId), {});
  const e = estado.erros?.senha;
  return (
    <form action={acao} style={{ display: "grid", gap: 10 }} key={estado.ok ?? "senha"}>
      <Avisos erro={e ? undefined : estado.erro} ok={estado.ok} />
      <Campo id={`s-${usuarioId}`} rotulo="Nova senha" erro={e} dica={DICA_SENHA}>
        <input id={`s-${usuarioId}`} name="senha" type="password" autoComplete="new-password" required minLength={SENHA_MIN} maxLength={SENHA_MAX} className="entrada-texto" aria-invalid={!!e} />
      </Campo>
      <button className="botao botao-neutro botao-pequeno" disabled={enviando}><KeyRound />{enviando ? "Salvando…" : "Salvar senha"}</button>
    </form>
  );
}

export function BotaoFuncionarioAtivo({ orgaoId, usuarioId, ativo, nome }: { orgaoId: string; usuarioId: string; ativo: boolean; nome: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoFuncionarioAtivo.bind(null, orgaoId, usuarioId, !ativo), {});
  return (
    <form action={acao}>
      <button className="botao botao-neutro botao-pequeno" disabled={enviando} aria-label={`${ativo ? "Desativar" : "Reativar"} o acesso de ${nome}`}>
        {ativo ? "Desativar" : "Reativar"}
      </button>
      {estado.erro && <div className="fraco" role="alert" style={{ color: "#c23a3a", marginTop: 4 }}>{estado.erro}</div>}
    </form>
  );
}

export function FormMinhaSenha() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoTrocarMinhaSenha, {});
  const e = (k: string) => estado.erros?.[k];
  return (
    <form action={acao} style={{ display: "grid", gap: 12 }} key={estado.ok ?? "minha-senha"}>
      <Avisos erro={estado.erros ? undefined : estado.erro} ok={estado.ok} />
      <Campo id="atual" rotulo="Senha atual" erro={e("atual")}>
        <input id="atual" name="atual" type="password" autoComplete="current-password" required className="entrada-texto" aria-invalid={!!e("atual")} />
      </Campo>
      <Campo id="nova" rotulo="Nova senha" erro={e("nova")} dica={DICA_SENHA}>
        <input id="nova" name="nova" type="password" autoComplete="new-password" required minLength={SENHA_MIN} maxLength={SENHA_MAX} className="entrada-texto" aria-invalid={!!e("nova")} />
      </Campo>
      <Campo id="nova2" rotulo="Repita a nova senha" erro={e("nova2")}>
        <input id="nova2" name="nova2" type="password" autoComplete="new-password" required minLength={SENHA_MIN} maxLength={SENHA_MAX} className="entrada-texto" aria-invalid={!!e("nova2")} />
      </Campo>
      <button className="botao botao-primario" disabled={enviando}><KeyRound />{enviando ? "Salvando…" : "Salvar senha"}</button>
    </form>
  );
}
