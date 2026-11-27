import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataHora } from "@/lib/formato";
import { listarLeiturasIfc } from "@/servicos/ifc";
import { carregarOrcamento } from "../carregar";
import { acaoRemoverLeituraIfc } from "./acoes";
import { LeitorIfc } from "./LeitorIfc";

export const metadata: Metadata = { title: "IFC do orçamento" };

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

export default async function IfcDoOrcamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, editavel } = await carregarOrcamento(id);
  const leituras = await listarLeiturasIfc(ator, id);

  return (
    <div className="grade">
      <section className="cartao surgir">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 className="cartao-titulo">Quantitativos do projeto</h2>
            <p className="cartao-sub">Paredes, lajes, pilares, vigas, esquadrias e ambientes do modelo IFC, com comprimento, área, volume e peso. O arquivo é lido neste computador. Ficam guardados os quantitativos e um modelo 3D leve do projeto.</p>
          </div>
          {editavel && <LeitorIfc orcamentoId={id} />}
        </div>
      </section>

      {leituras.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum arquivo lido</b>{editavel ? "Leia o IFC exportado do Revit, ArchiCAD, Bonsai ou outro programa de projeto." : null}</div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Arquivo</th><th>Projeto</th><th className="dir">Elementos</th><th className="dir">Grupos</th><th className="dir">Itens lançados</th><th>Lido por</th>{editavel && <th />}</tr></thead>
            <tbody>
              {leituras.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/orcamentos/${id}/ifc/${l.id}`} className="link-item forte">{l.arquivo}</Link><br /><span className="fraco num">{l.schema ?? "IFC"} · {mb(l.tamanho)}</span></td>
                  <td>{l.projeto ?? "—"}{l.aplicativo && <><br /><span className="fraco">{l.aplicativo}</span></>}</td>
                  <td className="dir num">{l.elementos.toLocaleString("pt-BR")}</td>
                  <td className="dir num">{l.grupos.toLocaleString("pt-BR")}</td>
                  <td className="dir num">{l.lancamentos.toLocaleString("pt-BR")}</td>
                  <td>{l.criadoPor ?? "—"}<br /><span className="fraco num">{dataHora(l.criadoEm)}</span></td>
                  {editavel && (
                    <td className="dir">
                      <FormAcao acao={acaoRemoverLeituraIfc.bind(null, id, l.id)} mostrarOk={false} confirmar="Excluir esta leitura? Os itens já lançados continuam no orçamento.">
                        <BotaoEnviar className="botao botao-texto botao-pequeno" ariaLabel="Excluir leitura" title="Excluir leitura"><Trash2 /></BotaoEnviar>
                      </FormAcao>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
