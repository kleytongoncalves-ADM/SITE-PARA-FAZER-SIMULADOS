"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { acaoEntrarPlataforma, type EstadoEntrada } from "../acoes";

export function FormEntrarPlataforma() {
  const [estado, acao, enviando] = useActionState<EstadoEntrada, FormData>(acaoEntrarPlataforma, {});
  return (
    <form action={acao} style={{ display: "grid", gap: 16 }}>
      {estado.erro && (
        <div className="aviso aviso-erro" role="alert" style={{ color: "#ffc2c2" }}>
          <CircleAlert />
          {estado.erro}
        </div>
      )}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={estado.email} className="entrada-texto" />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="entrada-texto" />
      </div>
      <button className="botao botao-primario" disabled={enviando} style={{ height: 46, marginTop: 4 }}>
        {enviando ? "Entrando…" : "Entrar na administração"}
        <ArrowRight />
      </button>
    </form>
  );
}
