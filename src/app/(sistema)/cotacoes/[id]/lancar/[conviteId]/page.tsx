import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormularioProposta } from "@/componentes/cotacao/FormularioProposta";
import { formatarCnpj } from "@/servicos/contratos";
import { marcasConhecidas } from "@/servicos/cotacoes";
import { acaoLancarProposta } from "../../../acoes";
import { carregarSolicitacao } from "../../carregar";

export const metadata: Metadata = { title: "Lançar proposta recebida" };

export default async function LancarProposta({ params }: { params: Promise<{ id: string; conviteId: string }> }) {
  const { id, conviteId } = await params;
  const { ator, s } = await carregarSolicitacao(id);
  const c = s.convites.find((x) => x.id === conviteId);
  if (!c) notFound();
  const voltar = <Link href={`/cotacoes/${id}/fornecedores`} className="botao botao-neutro botao-pequeno"><ArrowLeft /> Fornecedores</Link>;
  if (!s.podeSolicitar || s.situacao !== "aberta") {
    return <div className="grade"><div className="barra-acoes">{voltar}</div><div className="cartao vazio"><b>Lançamento indisponível</b>{s.situacao === "aberta" ? "Seu perfil não lança propostas." : "O recebimento desta cotação não está aberto."}</div></div>;
  }
  const marcas = await marcasConhecidas(ator);
  return (
    <div className="grade">
      <div className="barra-acoes">
        {voltar}
        <span><b>{c.razaoSocial}</b> <span className="fraco num">· {formatarCnpj(c.cnpj)}</span></span>
      </div>
      {c.versao != null && <div className="aviso aviso-info"><span>Este fornecedor já tem a versão {c.versao}. O lançamento cria uma nova versão, que passa a valer.</span></div>}
      <section className="cartao">
        <h2 className="cartao-titulo">Proposta recebida por outro meio</h2>
        <p className="cartao-sub">Digite os preços como constam no documento do fornecedor e informe a referência do documento.</p>
        <div style={{ marginTop: 16 }}>
          <FormularioProposta modo="equipe" materiais={s.materiais} inicial={null} marcas={marcas} validadeMinima={s.validadeMinima} freteIncluso={s.freteIncluso}
            pontua={s.criterio === "custo_beneficio" ? [s.pesos.prazo ? "prazo de entrega" : "", s.pesos.pagamento ? "prazo de pagamento" : "", s.pesos.garantia ? "garantia" : ""].filter(Boolean) : []}
            enviar={acaoLancarProposta.bind(null, id, conviteId)} destino={`/cotacoes/${id}/fornecedores`} />
        </div>
      </section>
    </div>
  );
}
