import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoHorizontal } from "@/componentes/Logo";
import { precisaInstalar } from "@/servicos/instalacao";
import { FormInstalacao } from "./FormInstalacao";

export const metadata: Metadata = { title: "Primeiro acesso" };
export const dynamic = "force-dynamic";

export default async function PaginaPrimeiroAcesso() {
  if (!(await precisaInstalar())) redirect("/login");
  const pedeCodigo = !!process.env.CODIGO_INSTALACAO || process.env.NODE_ENV === "production";
  return (
    <main className="login">
      <div className="vidro login-caixa entrada" style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 22 }}>
          <LogoHorizontal largura={220} />
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>Primeiro acesso</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--texto-escuro-fundo-suave)" }}>
          O sistema ainda não tem ninguém cadastrado. Informe o órgão e crie o acesso do administrador. Esta tela deixa de existir depois disso.
        </p>
        <FormInstalacao pedeCodigo={pedeCodigo} />
      </div>
    </main>
  );
}
