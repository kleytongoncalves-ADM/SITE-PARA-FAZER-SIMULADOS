import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoHorizontal } from "@/componentes/Logo";
import { recuperacaoPorEmail } from "@/servicos/fornecedores";
import { FormEsqueci } from "./FormEsqueci";
import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Esqueci() {
  const ativo = recuperacaoPorEmail();
  return (
    <main className="login">
      <div className="vidro login-caixa entrada">
        <div className="cadastro-cabeca">
          <LogoHorizontal largura={190} />
          <Link href="/login?perfil=fornecedor" className="botao botao-texto botao-texto-claro"><ArrowLeft /> Voltar</Link>
        </div>
        <h1 className="entrada-titulo">Esqueci minha senha</h1>
        {ativo ? (
          <>
            <p className="entrada-sub">Informe o e-mail de acesso. Enviamos um link para criar uma nova senha.</p>
            <FormEsqueci />
          </>
        ) : (
          <p className="entrada-sub">A recuperação por e-mail ainda não está ativa. Peça ao administrador da empresa para definir uma nova senha em Minha empresa › Usuários.</p>
        )}
      </div>
    </main>
  );
}
