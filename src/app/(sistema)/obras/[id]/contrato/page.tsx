import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EtiquetaContrato } from "@/componentes/Etiquetas";
import { dataCurta, moeda } from "@/lib/formato";
import { listarContratos, ROTULO_REGIME_EXECUCAO, rotuloContrato } from "@/servicos/contratos";
import { listarOrcamentos } from "@/servicos/orcamentos";
import { pode } from "@/servicos/permissoes";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Contrato da obra" };

export default async function ContratoDaObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, obra } = await carregarObra(id);
  const cab = <CabecalhoObra obra={obra} aba="contrato" podeEditar={pode(ator, "obra.editar")} />;
  if (!pode(ator, "contrato.ver")) return <>{cab}<div className="cartao vazio"><b>Seu perfil não acessa contratos</b></div></>;
  const lista = await listarContratos(ator, { obraId: id });
  const aprovado = pode(ator, "orcamento.ver") ? (await listarOrcamentos(ator, { obraId: id, situacao: "aprovado" }))[0] : undefined;
  const podeCriar = pode(ator, "contrato.editar") && aprovado && !lista.some((k) => k.orcamentoId === aprovado.id && (k.situacao === "rascunho" || k.situacao === "vigente"));

  return (
    <>
      {cab}
      <div className="grade">
        {podeCriar && (
          <div className="barra-acoes">
            <Link href={`/contratos/novo?orcamento=${aprovado!.id}`} className="botao botao-primario" style={{ marginLeft: "auto" }}><Plus /> Novo contrato</Link>
          </div>
        )}
        {lista.length === 0 ? (
          <div className="cartao vazio"><b>Nenhum contrato</b>{!aprovado && "O contrato é cadastrado a partir do orçamento aprovado."}</div>
        ) : (
          <div className="tabela-caixa surgir">
            <table className="tabela">
              <thead><tr><th>Contrato</th><th>Contratada</th><th>Regime</th><th>Vigência</th><th>Situação</th><th className="dir">Valor atual</th><th className="dir">Saldo</th></tr></thead>
              <tbody>
                {lista.map((k) => (
                  <tr key={k.id}>
                    <td><Link href={`/contratos/${k.id}`} className="forte">{rotuloContrato(k)}</Link></td>
                    <td>{k.empresaNome ?? "Equipe própria"}</td>
                    <td>{ROTULO_REGIME_EXECUCAO[k.regime]}</td>
                    <td className="num">{dataCurta(k.vigenciaFim)}</td>
                    <td><EtiquetaContrato situacao={k.situacao} /></td>
                    <td className="dir num forte">{moeda(k.valorAtual)}</td>
                    <td className="dir num">{moeda(k.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
