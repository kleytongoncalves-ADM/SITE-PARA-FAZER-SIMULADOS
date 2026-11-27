import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EntradaPeloConvite } from "@/componentes/fornecedor/EntradaPeloConvite";
import { ErroDeRegra } from "@/lib/db";
import { fornecedorAtual } from "@/lib/sessao";
import { chegarPeloConvite, preparoDoConvite } from "@/servicos/fornecedores";
import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Cotação de materiais", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * Link individual do convite (o do e-mail e o copiado pela equipe). Leva sempre
 * à área do fornecedor: quem já entrou vai direto para a cotação; quem não
 * entrou faz o cadastro ou o login, e volta para cá.
 */
export default async function ConviteIndividual({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const rede = (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || null;
  const voltar = `/cotacao/${token}`;
  let preparo;
  try {
    preparo = await preparoDoConvite(token, rede);
  } catch (e) {
    if (e instanceof ErroDeRegra) return <EntradaPeloConvite resumo={null} voltar={voltar} cadastro="/fornecedor/cadastro" aviso={{ titulo: "Aguarde alguns minutos", texto: e.message }} />;
    throw e;
  }
  if (!preparo) {
    return <EntradaPeloConvite resumo={null} voltar="/fornecedor" cadastro="/fornecedor/cadastro"
      aviso={{ titulo: "Link inválido", texto: "Este endereço não está mais ativo. Peça um novo link a quem solicitou a cotação." }} />;
  }
  const f = await fornecedorAtual();
  if (f) {
    const r = await chegarPeloConvite(f, token, rede);
    if (r.tipo === "cotacao") redirect(`/fornecedor/cotacoes/${r.conviteId}`);
    if (r.tipo === "outra_empresa") {
      return <EntradaPeloConvite resumo={preparo.resumo} voltar={voltar} cadastro={`/fornecedor/cadastro?convite=${token}`}
        aviso={{ titulo: "Convite de outra empresa", texto: `Este convite foi enviado para a empresa com CNPJ final ${r.cnpjFinal.slice(0, 4)}-${r.cnpjFinal.slice(4)}. Você entrou como ${f.razaoSocial}.`, sair: true }} />;
    }
  }
  return <EntradaPeloConvite resumo={preparo.resumo} voltar={voltar} cadastro={`/fornecedor/cadastro?convite=${token}`} temConta={preparo.temConta} />;
}
