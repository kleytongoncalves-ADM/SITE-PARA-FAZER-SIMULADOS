import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LogoHorizontal } from "@/componentes/Logo";
import { donoAtual } from "@/lib/sessao";
import { FormEntrarPlataforma } from "./FormEntrar";

export const metadata: Metadata = { title: "Administração da plataforma" };
export const dynamic = "force-dynamic";

export default async function EntrarPlataforma() {
  if (await donoAtual()) redirect("/plataforma");
  return (
    <main className="login">
      <div className="vidro login-caixa entrada">
        <div style={{ marginBottom: 26 }}>
          <LogoHorizontal largura={250} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--laranja-claro)", marginTop: 8, paddingLeft: 3, fontWeight: 650 }}>
            <ShieldCheck size={15} /> Administração da plataforma
          </div>
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Área do dono</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--texto-escuro-fundo-suave)" }}>
          Aqui você cadastra as empresas e os funcionários que entram no CiviObras.
        </p>
        <FormEntrarPlataforma />
      </div>
    </main>
  );
}
