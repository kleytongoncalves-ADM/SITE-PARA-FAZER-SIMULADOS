import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { prazoDaqui } from "@/componentes/cotacao/Pecas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { mesAno } from "@/lib/formato";
import { materiaisDoOrcamento } from "@/servicos/cotacoes";
import { pode } from "@/servicos/permissoes";
import { ROTULO_FONTE } from "@/servicos/precos";
import { acaoCriarSolicitacao } from "../../../../cotacoes/acoes";
import { carregarOrcamento } from "../../carregar";
import { FormSolicitacao } from "./FormSolicitacao";
import "@/estilos/cotacoes.css";

export const metadata: Metadata = { title: "Solicitar cotações" };

export default async function NovaSolicitacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, orcamento: o } = await carregarOrcamento(id);
  if (!pode(ator, "cotacao.solicitar")) return <div className="cartao vazio"><b>Seu perfil não solicita cotações</b></div>;
  const { materiais } = await materiaisDoOrcamento(ator, id);
  if (!materiais.length) return <div className="cartao vazio"><b>Sem materiais para cotar</b>Lance serviços ou materiais na planilha.</div>;

  return (
    <FormAcao acao={acaoCriarSolicitacao.bind(null, id)} className="grade">
      <div className="barra-acoes">
        <Link href={`/orcamentos/${id}/cotacoes`} className="botao botao-neutro botao-pequeno"><ArrowLeft /> Cotações</Link>
        <span className="fraco">Referência: {ROTULO_FONTE[o.fonte]} {o.uf} {mesAno(o.mes)}</span>
      </div>
      <FormSolicitacao materiais={materiais} fonte={ROTULO_FONTE[o.fonte]}
        prazoPadrao={prazoDaqui(7 * 86400000).slice(0, 11) + "18:00"} prazoMinimo={prazoDaqui(3600000)} />
      <div className="rodape-form">
        <BotaoEnviar enviando="Salvando…">Escolher fornecedores <ArrowRight /></BotaoEnviar>
      </div>
    </FormAcao>
  );
}
