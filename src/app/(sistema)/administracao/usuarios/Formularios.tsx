"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { DICA_SENHA, PERFIS, ROTULO_PERFIL, SENHA_MAX, SENHA_MIN } from "@/servicos/rotulos";
import type { Estado } from "../../obras/acoes";
import { acaoCriarUsuario, acaoDefinirAtivo } from "../acoes";

export function FormUsuario() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoCriarUsuario, {});
  const v = (k: string) => (estado.ok ? "" : estado.valores?.[k] ?? "");
  const e = (k: string) => estado.erros?.[k];
  return (
    <form action={acao} style={{ display: "grid", gap: 14 }} key={estado.ok ?? JSON.stringify(estado.valores ?? {})}>
      <Avisos erro={estado.erro} ok={estado.ok} />
      <div className="campo">
        <label htmlFor="nome">Nome completo</label>
        <input id="nome" name="nome" className="entrada-texto" required defaultValue={v("nome")} aria-invalid={!!e("nome")} />
        {e("nome") && <span className="erro">{e("nome")}</span>}
      </div>
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" className="entrada-texto" required defaultValue={v("email")} aria-invalid={!!e("email")} />
        {e("email") && <span className="erro">{e("email")}</span>}
      </div>
      <div className="campo">
        <label htmlFor="perfil">Perfil</label>
        <select id="perfil" name="perfil" className="entrada-texto" defaultValue={v("perfil") || "engenheiro"}>
          {PERFIS.map((p) => <option key={p} value={p}>{ROTULO_PERFIL[p]}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="registroProfissional">CREA/CAU</label>
        <input id="registroProfissional" name="registroProfissional" className="entrada-texto" defaultValue={v("registroProfissional")} />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha inicial</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" className="entrada-texto" required minLength={SENHA_MIN} maxLength={SENHA_MAX} aria-invalid={!!e("senha")} />
        {e("senha") ? <span className="erro">{e("senha")}</span> : <span className="dica">{DICA_SENHA}</span>}
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, fontWeight: 600 }}>
        <input type="checkbox" name="administrador" style={{ width: 17, height: 17, accentColor: "#f28c28" }} />
        Administrador
      </label>
      <button className="botao botao-primario" disabled={enviando}><UserPlus />{enviando ? "Salvando…" : "Cadastrar"}</button>
    </form>
  );
}

export function BotaoAtivo({ usuarioId, ativo, nome }: { usuarioId: string; ativo: boolean; nome: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoDefinirAtivo.bind(null, usuarioId, !ativo), {});
  return (
    <form action={acao}>
      <button className="botao botao-neutro botao-pequeno" disabled={enviando} aria-label={`${ativo ? "Desativar" : "Reativar"} o acesso de ${nome}`}>
        {ativo ? "Desativar" : "Reativar"}
      </button>
      {estado.erro && <div className="fraco" role="alert" style={{ color: "#c23a3a", marginTop: 4 }}>{estado.erro}</div>}
    </form>
  );
}
