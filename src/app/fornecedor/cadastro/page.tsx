import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ResumoCotacao } from "@/componentes/fornecedor/ResumoCotacao";
import { LogoHorizontal } from "@/componentes/Logo";
import { fornecedorAtual } from "@/lib/sessao";
import { preparoDoConvite, preparoDoLinkAberto } from "@/servicos/fornecedores";
import { FormCadastro } from "./FormCadastro";
import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Cadastrar empresa", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{40,50}$/;

export default async function Cadastro({ searchParams }: { searchParams: Promise<{ convite?: string; link?: string }> }) {
  const { convite, link } = await searchParams;
  const voltar = convite && TOKEN.test(convite) ? `/cotacao/${convite}` : link && TOKEN.test(link) ? `/convite/${link}` : "/fornecedor";
  if (await fornecedorAtual()) redirect(voltar);
  const h = await headers();
  const rede = (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || null;
  const preparo = convite && TOKEN.test(convite) ? await preparoDoConvite(convite, rede).catch(() => null)
    : link && TOKEN.test(link) ? await preparoDoLinkAberto(link, rede).catch(() => null) : null;
  const empresa = preparo && "empresa" in preparo ? (preparo.empresa as { cnpj: string; razaoSocial: string; email: string }) : null;
  const entrar = voltar === "/fornecedor" ? "/login?perfil=fornecedor" : voltar;

  return (
    <main className="login">
      <div className={`vidro login-caixa entrada cadastro-caixa ${preparo ? "com-resumo" : ""}`}>
        <div className="cadastro-cabeca">
          <LogoHorizontal largura={190} />
          <Link href={entrar} className="botao botao-texto botao-texto-claro"><ArrowLeft /> Já tenho acesso</Link>
        </div>
        <div className="cadastro-grade">
          {preparo && <ResumoCotacao r={preparo.resumo} />}
          <div>
            <h1 className="entrada-titulo">Cadastrar minha empresa</h1>
            <p className="entrada-sub">{preparo ? "Depois do cadastro, a cotação abre na sua área, pronta para preencher." : "Com o cadastro, a empresa recebe e responde cotações de todos os órgãos que usam o CiviObras."}</p>
            <FormCadastro voltar={voltar} entrar={entrar}
              inicial={empresa ? { cnpj: empresa.cnpj, razaoSocial: empresa.razaoSocial, email: empresa.email } : {}} />
          </div>
        </div>
      </div>
    </main>
  );
}
