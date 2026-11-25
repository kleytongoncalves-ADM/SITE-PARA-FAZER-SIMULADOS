"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { acaoInstalar, type EstadoInstalacao } from "./acoes";

export function FormInstalacao({ pedeCodigo }: { pedeCodigo: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoInstalacao, FormData>(acaoInstalar, {});
  const v = estado.valores ?? {};
  return (
    <form action={acao} style={{ display: "grid", gap: 14 }}>
      {estado.erro && (
        <div className="aviso aviso-erro" role="alert" style={{ color: "#ffc2c2" }}>
          <CircleAlert />
          {estado.erro}
        </div>
      )}
      <div className="campo">
        <label htmlFor="nome">Seu nome</label>
        <input id="nome" name="nome" required autoComplete="name" defaultValue={v.nome} className="entrada-texto" />
      </div>
      <div className="campo">
        <label htmlFor="email">Seu e-mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" defaultValue={v.email} className="entrada-texto" placeholder="voce@empresa.com.br" />
      </div>
      <div className="instalacao-dupla">
        <div className="campo">
          <label htmlFor="senha">Crie uma senha</label>
          <input id="senha" name="senha" type="password" required minLength={10} autoComplete="new-password" className="entrada-texto" />
        </div>
        <div className="campo">
          <label htmlFor="senha2">Repita a senha</label>
          <input id="senha2" name="senha2" type="password" required minLength={10} autoComplete="new-password" className="entrada-texto" />
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--texto-escuro-fundo-suave)", marginTop: -6 }}>Pelo menos 10 caracteres, com letras e números.</div>
      {pedeCodigo && (
        <div className="campo">
          <label htmlFor="codigo">Código de instalação</label>
          <input id="codigo" name="codigo" type="password" required autoComplete="off" className="entrada-texto" />
        </div>
      )}
      <button className="botao botao-primario" disabled={enviando} style={{ height: 46, marginTop: 4 }}>
        {enviando ? "Criando…" : "Criar o meu acesso"}
        <ArrowRight />
      </button>
    </form>
  );
}
