import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoHorizontal } from "@/componentes/Logo";
import { fornecedorAtual, usuarioAtual } from "@/lib/sessao";
import { EscolhaEntrada } from "./EscolhaEntrada";
import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ perfil?: string; senha?: string }> }) {
  const { perfil, senha } = await searchParams;
  const deFornecedor = perfil === "fornecedor";
  if (deFornecedor && (await fornecedorAtual())) redirect("/fornecedor");
  if (!deFornecedor && (await usuarioAtual())) redirect("/inicio");
  return (
    <main className="login">
      <div className="vidro login-caixa entrada">
        <div style={{ marginBottom: 22 }}>
          <LogoHorizontal largura={250} />
          <div style={{ fontSize: 12.5, color: "var(--texto-escuro-fundo-suave)", marginTop: 6, paddingLeft: 3 }}>Gestão de obras civis</div>
        </div>
        <EscolhaEntrada inicial={deFornecedor ? "fornecedor" : perfil === "contratante" ? "contratante" : null} aviso={deFornecedor && senha === "nova" ? "Senha criada. Entre com a nova senha." : undefined} />
      </div>
    </main>
  );
}
