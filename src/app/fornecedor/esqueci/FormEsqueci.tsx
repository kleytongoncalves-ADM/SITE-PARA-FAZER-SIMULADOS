"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, Send } from "lucide-react";
import { acaoPedirNovaSenha, type Estado } from "@/app/fornecedor/acoes";

export function FormEsqueci() {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoPedirNovaSenha, {});
  return (
    <form action={acao} style={{ display: "grid", gap: 16 }}>
      {s.erro && <div className="aviso aviso-erro" role="alert" style={{ color: "#ffc2c2" }}><CircleAlert />{s.erro}</div>}
      {s.ok && <div className="aviso aviso-ok" role="status" style={{ color: "#b9f3d2" }}><CircleCheck />{s.ok}</div>}
      <div className="campo">
        <label htmlFor="e-email">E-mail de acesso</label>
        <input id="e-email" name="email" type="email" autoComplete="username" required className="entrada-texto" />
      </div>
      <button className="botao botao-primario" disabled={enviando} style={{ height: 46 }}><Send /> {enviando ? "Enviando…" : "Enviar link"}</button>
    </form>
  );
}
