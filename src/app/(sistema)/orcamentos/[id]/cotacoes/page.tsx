import type { Metadata } from "next";
import Link from "next/link";
import { Send } from "lucide-react";
import { dataHoraCurta, EtiquetaCotacao, tempoRestante } from "@/componentes/cotacao/Pecas";
import { moeda, percentual } from "@/lib/formato";
import { ROTULO_CRITERIO_APURACAO } from "@/servicos/cotacao-calculo";
import { listarSolicitacoes, materiaisDoOrcamento } from "@/servicos/cotacoes";
import { pode } from "@/servicos/permissoes";
import { carregarOrcamento } from "../carregar";
import "@/estilos/cotacoes.css";

export const metadata: Metadata = { title: "Cotações do orçamento" };

export default async function CotacoesDoOrcamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, orcamento } = await carregarOrcamento(id);
  if (!pode(ator, "cotacao.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa as cotações</b></div>;
  const [lista, { materiais }] = await Promise.all([listarSolicitacoes(ator, { orcamentoId: id }), materiaisDoOrcamento(ator, id)]);
  const podeSolicitar = pode(ator, "cotacao.solicitar") && orcamento.situacao !== "cancelado" && materiais.length > 0;
  const cotados = materiais.filter((m) => m.jaCotado).length;
  const economia = lista.reduce((s, l) => s + Number(l.economia ?? 0), 0);

  return (
    <div className="grade">
      <div className="barra-acoes">
        <div>
          <h2 className="cartao-titulo">Cotações com fornecedores</h2>
          <p className="cartao-sub">{materiais.length} {materiais.length === 1 ? "material" : "materiais"} neste orçamento, {cotados} em cotação.</p>
        </div>
        {podeSolicitar && <Link href={`/orcamentos/${id}/cotacoes/nova`} className="botao botao-primario" style={{ marginLeft: "auto" }}><Send /> Solicitar cotações</Link>}
      </div>

      {lista.length > 0 && (
        <div className="indicadores">
          <div className="indicador"><span>Solicitações</span><b className="num">{lista.length}</b><small>{lista.filter((l) => l.situacao === "aberta").length} recebendo propostas</small></div>
          <div className="indicador"><span>Materiais em cotação</span><b className="num">{cotados} de {materiais.length}</b></div>
          <div className="indicador"><span>Apuradas</span><b className="num">{lista.filter((l) => l.situacao === "apurada").length}</b></div>
          <div className={`indicador${economia > 0 ? " indicador-destaque" : ""}`}><span>Economia apurada</span><b className="num">{moeda(economia)}</b><small>sobre a referência do orçamento</small></div>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="cartao vazio">
          <b>Nenhuma cotação neste orçamento</b>
          {materiais.length === 0 ? "Lance serviços ou materiais na planilha para poder cotar." : "A cotação é opcional. O orçamento vale sem ela."}
        </div>
      ) : (
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Nº</th><th>Solicitação</th><th>Situação</th><th>Prazo</th><th className="dir">Materiais</th><th className="dir">Respostas</th><th className="dir">Referência</th><th className="dir">Resultado</th><th className="dir">Economia</th></tr></thead>
            <tbody>{lista.map((s) => (
              <tr key={s.id}>
                <td className="num">{String(s.numero).padStart(3, "0")}</td>
                <td style={{ minWidth: 220 }}><Link href={`/cotacoes/${s.id}`} className="forte">{s.titulo}</Link><div className="fraco">{ROTULO_CRITERIO_APURACAO[s.criterio]}</div></td>
                <td><EtiquetaCotacao situacao={s.situacao} /></td>
                <td className="sem-quebra">{dataHoraCurta(s.prazo)}{s.situacao === "aberta" && <div className="fraco">{tempoRestante(s.prazo)}</div>}</td>
                <td className="dir num">{s.materiais}</td>
                <td className="dir num">{s.respondidas} de {s.convidados}</td>
                <td className="dir num">{s.totalReferencia ? moeda(s.totalReferencia) : "—"}</td>
                <td className="dir num forte">{s.totalResultado ? moeda(s.totalResultado) : "—"}</td>
                <td className="dir num">{s.economia ? <>{moeda(s.economia)}{Number(s.totalReferencia) > 0 && <div className="fraco">{percentual((Number(s.economia) / Number(s.totalReferencia)) * 100, 1)}</div>}</> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
