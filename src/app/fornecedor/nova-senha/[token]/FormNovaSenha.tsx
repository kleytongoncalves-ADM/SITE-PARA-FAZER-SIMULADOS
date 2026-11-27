"use client";

import { useActionState } from "react";
import { CircleAlert, Save } from "lucide-react";
import { acaoCriarNovaSenha, type Estado } from "@/app/fornecedor/acoes";

export function FormNovaSenha({ token }: { token: string }) {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoCriarNovaSenha.bind(null, token), {});
  return (
    <form action={acao} style={{ display: "grid", gap: 16 }}>
      {s.erro && <div className="aviso aviso-erro" role="alert" style={{ color: "#ffc2c2" }}><CircleAlert />{s.erro}</div>}
      <div className="campo">
        <label htmlFor="n-nova">Nova senha</label>
        <input id="n-nova" name="nova" type="password" required minLength={6} maxLength={10} autoComplete="new-password" className="entrada-texto" />
      </div>
      <div className="campo">
        <label htmlFor="n-conf">Confirmar</label>
        <input id="n-conf" name="confirmar" type="password" required minLength={6} maxLength={10} autoComplete="new-password" className="entrada-texto" />
      </div>
      <p className="entrada-sub" style={{ margin: 0 }}>6 a 10 caracteres, com letra, número e caractere especial.</p>
      <button className="botao botao-primario" disabled={enviando} style={{ height: 46 }}><Save /> {enviando ? "Salvando…" : "Salvar nova senha"}</button>
    </form>
  );
}
