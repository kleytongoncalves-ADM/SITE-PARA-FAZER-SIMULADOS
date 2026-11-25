import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoHorizontal } from "@/componentes/Logo";
import { usuarioAtual } from "@/lib/sessao";
import { precisaInstalar } from "@/servicos/instalacao";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin() {
  if (await usuarioAtual()) redirect("/inicio");
  if (await precisaInstalar()) redirect("/primeiro-acesso");
  return (
    <main className="login">
      <div className="vidro login-caixa entrada">
        <div style={{ marginBottom: 26 }}>
          <LogoHorizontal largura={250} />
          <div style={{ fontSize: 12.5, color: "var(--texto-escuro-fundo-suave)", marginTop: 6, paddingLeft: 3 }}>Gestão de obras civis</div>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Acesse o sistema</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--texto-escuro-fundo-suave)" }}>
          Entre com o seu e-mail e a sua senha.
        </p>
        <FormLogin />
      </div>
    </main>
  );
}
