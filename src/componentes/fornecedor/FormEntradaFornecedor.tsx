"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, Building2, CircleAlert } from "lucide-react";
import { acaoEntrarFornecedor, type EstadoEntrada } from "@/app/fornecedor/acoes";

/** Entrada do fornecedor: e-mail, senha e o caminho para cadastrar a empresa. */
export function FormEntradaFornecedor({ voltar = "/fornecedor", cadastro = "/fornecedor/cadastro", emailInicial }: { voltar?: string; cadastro?: string; emailInicial?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrada, FormData>(acaoEntrarFornecedor, { email: emailInicial });
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <form action={acao} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="voltar" value={voltar} />
        {estado.erro && <div className="aviso aviso-erro" role="alert" style={{ color: "#ffc2c2" }}><CircleAlert />{estado.erro}</div>}
        <div className="campo">
          <label htmlFor="f-email">E-mail</label>
          <input id="f-email" name="email" type="email" autoComplete="username" required defaultValue={estado.email} className="entrada-texto" placeholder="vendas@suaempresa.com.br" />
        </div>
        <div className="campo">
          <label htmlFor="f-senha">Senha</label>
          <input id="f-senha" name="senha" type="password" autoComplete="current-password" required className="entrada-texto" />
        </div>
        <button className="botao botao-primario" disabled={enviando} style={{ height: 46, marginTop: 4 }}>
          {enviando ? "Entrando…" : "Entrar"}<ArrowRight />
        </button>
      </form>
      <div className="entrada-cadastro">
        <span>Primeiro acesso da empresa?</span>
        <Link href={cadastro} className="botao botao-neutro"><Building2 /> Cadastrar minha empresa</Link>
      </div>
    </div>
  );
}
