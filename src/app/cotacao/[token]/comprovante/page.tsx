import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { dataHoraCurta } from "@/componentes/cotacao/Pecas";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { moeda, quantidade } from "@/lib/formato";
import { paginaDoFornecedor } from "@/servicos/cotacoes";
import "@/estilos/cotacoes.css";
import { unidade } from "@/lib/unidade";

export const metadata: Metadata = { title: "Comprovante da proposta", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const preco = (v: string | undefined) => (v ? `R$ ${v}` : "—");

export default async function Comprovante({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await paginaDoFornecedor(token, null).catch(() => null);
  if (!p || p.estado === "revogado" || !p.enviada) notFound();
  const e = p.enviada;
  const d = e.dados;
  const cotados = p.materiais.filter((m) => !d.itens[m.id]?.indisponivel).length;
  return (
    <main className="cot-externa">
      <div className="cot-externa-caixa">
        <div className="barra-acoes nao-imprimir" style={{ marginBottom: 14 }}>
          <Link href={`/cotacao/${token}`} className="botao botao-neutro"><ArrowLeft /> Voltar</Link>
          <BotaoImprimir />
        </div>
        <article className="rel">
          <CabecalhoRelatorio orgao={p.orgao} tipo="Comprovante de proposta" titulo={`Cotação nº ${String(p.numero).padStart(3, "0")}`} subtitulo={p.titulo}
            selo={{ texto: `Protocolo ${e.protocolo}`, cor: "verde" }}
            dados={[["Fornecedor", p.fornecedor], ["Responsável", [d.responsavelNome, d.responsavelCargo].filter(Boolean).join(" · ")], ["Enviada em", dataHoraCurta(e.enviadaEm)], ["Versão", String(e.versao)]]} />
          <Secao numero={1} titulo="Resumo">
            <Indicadores itens={[
              { rotulo: "Total da proposta", valor: moeda(e.total), destaque: true },
              { rotulo: "Itens cotados", valor: `${cotados} de ${p.materiais.length}` },
              { rotulo: "Validade", valor: d.validadeDias ? `${d.validadeDias} dias` : "—" },
              { rotulo: "Entrega", valor: d.prazoEntrega ? `${d.prazoEntrega} dias` : "—" },
            ]} />
          </Secao>
          <Secao numero={2} titulo="Itens da proposta">
            <table className="rel-tabela">
              <thead><tr><th>Item</th><th>Código</th><th>Material</th><th>Und.</th><th className="dir">Quantidade</th><th className="dir">Preço unitário</th><th>Marca e modelo</th></tr></thead>
              <tbody>{p.materiais.map((m) => {
                const i = d.itens[m.id];
                return (
                  <tr key={m.id}><td className="num">{m.ordem}</td><td className="num">{m.semSinapi ? "—" : m.codigo}</td><td>{m.descricao}{i?.observacao ? <div className="fraco">{i.observacao}</div> : null}</td>
                    <td>{unidade(m.unidade)}</td><td className="dir num">{quantidade(m.quantidade)}</td>
                    {i?.indisponivel || !i ? <td colSpan={2}>Indisponível</td> : <><td className="dir num">{preco(i.preco)}</td><td>{[i.marca, i.modelo].filter(Boolean).join(" · ")}</td></>}</tr>
                );
              })}</tbody>
            </table>
          </Secao>
          <Secao numero={3} titulo="Condições">
            <table className="rel-tabela"><tbody>
              <tr><td>Condição de pagamento</td><td>{[d.pagamentoDias ? `${d.pagamentoDias} dias` : "", d.condicaoPagamento].filter(Boolean).join(" · ") || "—"}</td></tr>
              <tr><td>Garantia</td><td>{d.garantiaMeses ? `${d.garantiaMeses} meses` : "—"}</td></tr>
              <tr><td>Frete</td><td>{p.freteIncluso ? "Incluído nos preços" : d.frete ? `R$ ${d.frete}` : "Sem frete"}</td></tr>
              {d.observacao ? <tr><td>Observações</td><td>{d.observacao}</td></tr> : null}
              <tr><td>Código de verificação</td><td className="num" style={{ overflowWrap: "anywhere" }}>{e.resumo}</td></tr>
            </tbody></table>
          </Secao>
          <RodapeRelatorio texto={`CiviObras · Comprovante da proposta ${e.protocolo} · ${p.fornecedor}`} />
        </article>
      </div>
    </main>
  );
}
