import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EntradaPeloConvite } from "@/componentes/fornecedor/EntradaPeloConvite";
import { ErroDeRegra } from "@/lib/db";
import { fornecedorAtual } from "@/lib/sessao";
import { chegarPeloLinkAberto, preparoDoLinkAberto } from "@/servicos/fornecedores";
import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Cotação de materiais", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const FORA: Record<string, { titulo: string; texto: string }> = {
  rascunho: { titulo: "Cotação ainda não aberta", texto: "Quem solicitou ainda não abriu o recebimento de propostas. Tente de novo mais tarde." },
  encerrada: { titulo: "Prazo encerrado", texto: "O prazo para enviar propostas nesta cotação terminou." },
  apurada: { titulo: "Prazo encerrado", texto: "O prazo para enviar propostas nesta cotação terminou." },
  cancelada: { titulo: "Cotação cancelada", texto: "Esta cotação foi cancelada por quem a solicitou." },
  invalido: { titulo: "Link inválido", texto: "Este endereço não está mais ativo. Peça um novo link a quem solicitou a cotação." },
};

/** Link compartilhado da cotação: o mesmo para todos, enviado por WhatsApp ou e-mail pela equipe. */
export default async function LinkCompartilhado({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const rede = (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || null;
  const voltar = `/convite/${token}`;
  const cadastro = `/fornecedor/cadastro?link=${token}`;
  let preparo;
  try {
    preparo = await preparoDoLinkAberto(token, rede);
  } catch (e) {
    if (e instanceof ErroDeRegra) return <EntradaPeloConvite resumo={null} voltar={voltar} cadastro={cadastro} aviso={{ titulo: "Aguarde alguns minutos", texto: e.message }} />;
    throw e;
  }
  if (!preparo) return <EntradaPeloConvite resumo={null} voltar="/fornecedor" cadastro="/fornecedor/cadastro" aviso={FORA.invalido} />;
  const f = await fornecedorAtual();
  if (f) {
    let r;
    try {
      r = await chegarPeloLinkAberto(f, token, rede);
    } catch (e) {
      if (e instanceof ErroDeRegra) return <EntradaPeloConvite resumo={preparo.resumo} voltar={voltar} cadastro={cadastro} aviso={{ titulo: "Não foi possível abrir", texto: e.message }} />;
      throw e;
    }
    if (r.tipo === "cotacao") redirect(`/fornecedor/cotacoes/${r.conviteId}`);
    if (r.tipo === "indisponivel") return <EntradaPeloConvite resumo={preparo.resumo} voltar={voltar} cadastro={cadastro} aviso={FORA[r.situacao] ?? FORA.invalido} />;
  }
  if (preparo.resumo.situacao !== "aberta") return <EntradaPeloConvite resumo={preparo.resumo} voltar={voltar} cadastro={cadastro} aviso={FORA[preparo.resumo.situacao] ?? FORA.invalido} />;
  return <EntradaPeloConvite resumo={preparo.resumo} voltar={voltar} cadastro={cadastro} />;
}
