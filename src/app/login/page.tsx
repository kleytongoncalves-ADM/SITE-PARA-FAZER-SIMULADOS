import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/componentes/Logo";
import { usuarioAtual } from "@/lib/sessao";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  if (await usuarioAtual()) redirect("/inicio");
  return (
    <main className="login">
      <div className="vidro login-caixa entrada">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <Logo tamanho={46} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>Orçamento CiviObra</div>
            <div style={{ fontSize: 12.5, color: "var(--texto-escuro-fundo-suave)" }}>Gestão de obras civis</div>
          </div>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Acesse o sistema</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--texto-escuro-fundo-suave)" }}>
          Use o e-mail e a senha fornecidos pelo administrador do seu órgão.
        </p>
        <FormLogin />
      </div>
    </main>
  );
}
