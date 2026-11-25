import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EtiquetaOrcamento } from "@/componentes/EtiquetaOrcamento";
import { dataHora, mesAno, moeda } from "@/lib/formato";
import { listarOrcamentos, rotuloOrcamento } from "@/servicos/orcamentos";
import { pode } from "@/servicos/permissoes";
import { ROTULO_FONTE, ROTULO_REGIME } from "@/servicos/precos";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Orçamento da obra" };

export default async function OrcamentoDaObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, obra } = await carregarObra(id);
  const lista = pode(ator, "orcamento.ver") ? await listarOrcamentos(ator, { obraId: id }) : [];
  const vigente = lista.find((o) => o.situacao === "aprovado");

  return (
    <>
      <CabecalhoObra obra={obra} aba="orcamento" podeEditar={pode(ator, "obra.editar")} />
      {!pode(ator, "orcamento.ver") ? <div className="cartao vazio"><b>Seu perfil não acessa orçamentos</b></div> : (
        <div className="grade">
          <div className="barra-acoes">
            {vigente && <span className="cartao-sub">Em vigor: <Link href={`/orcamentos/${vigente.id}/nota`} className="forte">{rotuloOrcamento(vigente)} · {moeda(vigente.total)}</Link></span>}
            {pode(ator, "orcamento.editar") && <Link href={`/orcamentos/novo?obra=${id}`} className="botao botao-primario" style={{ marginLeft: "auto" }}><Plus /> Novo orçamento</Link>}
          </div>
          {lista.length === 0 ? <div className="cartao vazio"><b>Nenhum orçamento</b></div> : (
            <div className="tabela-caixa surgir">
              <table className="tabela">
                <thead><tr><th>Orçamento</th><th>Base</th><th>Criado</th><th>Situação</th><th className="dir">Total</th></tr></thead>
                <tbody>
                  {lista.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/orcamentos/${o.id}`}><span className="forte">{o.nome}</span><br /><span className="fraco num">{rotuloOrcamento(o)}</span></Link></td>
                      <td>{ROTULO_FONTE[o.fonte]} {o.uf} {mesAno(o.mes)} · {ROTULO_REGIME[o.regime]}</td>
                      <td className="num">{dataHora(o.criadoEm)}</td>
                      <td><EtiquetaOrcamento situacao={o.situacao} /></td>
                      <td className="dir num forte">{moeda(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
