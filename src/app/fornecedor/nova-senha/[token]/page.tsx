import type { Metadata } from "next";
import Link from "next/link";
import { LogoHorizontal } from "@/componentes/Logo";
import { linkDeSenhaValido } from "@/servicos/fornecedores";
import { FormNovaSenha } from "./FormNovaSenha";
import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function NovaSenha({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = await linkDeSenhaValido(token);
  return (
    <main className="login">
      <div className="vidro login-caixa entrada">
        <div style={{ marginBottom: 18 }}><LogoHorizontal largura={190} /></div>
        <h1 className="entrada-titulo">Criar nova senha</h1>
        {valido ? <FormNovaSenha token={token} /> : (
          <>
            <p className="entrada-sub">Este link venceu ou já foi usado.</p>
            <Link href="/fornecedor/esqueci" className="botao botao-neutro">Pedir outro link</Link>
          </>
        )}
      </div>
    </main>
  );
}
