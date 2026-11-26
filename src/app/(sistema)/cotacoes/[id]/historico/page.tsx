import type { Metadata } from "next";
import { Ban, CalendarClock, CheckCheck, Eye, FileCheck2, Link2, Lock, RotateCcw, Scale, Send, UserPlus, type LucideIcon } from "lucide-react";
import { dataHoraCurta } from "@/componentes/cotacao/Pecas";
import { moeda } from "@/lib/formato";
import { protocolo } from "@/servicos/cotacoes";
import { carregarSolicitacao } from "../carregar";

export const metadata: Metadata = { title: "Histórico da cotação" };

const ICONE: Record<string, LucideIcon> = {
  envio: Send, convite: UserPlus, abertura: Eye, proposta: FileCheck2, declinio: Ban, prorrogacao: CalendarClock, encerramento: Lock, reabertura: RotateCcw,
  cancelamento: Ban, avaliacao: Scale, homologacao: CheckCheck, link: Link2,
};

export default async function Historico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { s } = await carregarSolicitacao(id);
  return (
    <div className="cot-duas">
      <section className="cartao surgir">
        <h2 className="cartao-titulo">Registro de eventos</h2>
        <p className="cartao-sub">Os registros não podem ser alterados nem excluídos.</p>
        {s.eventos.length === 0 ? <p className="fraco" style={{ marginTop: 14 }}>Sem eventos. O registro começa no envio da solicitação.</p> : (
          <ol className="cot-eventos" style={{ marginTop: 16 }}>
            {s.eventos.map((e) => {
              const Icone = ICONE[e.tipo] ?? FileCheck2;
              const just = typeof e.detalhe?.justificativa === "string" ? e.detalhe.justificativa : typeof e.detalhe?.motivo === "string" ? e.detalhe.motivo : null;
              return (
                <li key={e.id}>
                  <span className="cot-ponto"><Icone /></span>
                  <div>
                    <b>{e.resumo}</b>
                    <time>{dataHoraCurta(e.em)}{e.usuario ? ` · ${e.usuario}` : e.fornecedor ? ` · ${e.fornecedor}` : ""}{e.rede ? ` · rede ${e.rede}` : ""}</time>
                    {just && <p className="cot-justificativa">{just}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="cartao surgir">
        <h2 className="cartao-titulo">Versões das propostas</h2>
        <p className="cartao-sub">Cada envio gera uma versão. Vale a última recebida dentro do prazo.</p>
        {s.versoes.length === 0 ? <p className="fraco" style={{ marginTop: 14 }}>Nenhuma proposta recebida.</p> : (
          <div className="tabela-caixa" style={{ marginTop: 14 }}>
            <table className="tabela tabela-compacta">
              <thead><tr><th>Fornecedor</th><th>Versão</th><th>Recebida</th><th>Origem</th><th className="dir">Itens</th><th className="dir">Total</th><th>Protocolo</th></tr></thead>
              <tbody>{[...s.versoes].reverse().map((v) => (
                <tr key={`${v.conviteId}-${v.versao}`}>
                  <td className="forte">{v.fornecedor}<div className="fraco" style={{ fontWeight: 450 }}>{v.responsavelNome}</div></td>
                  <td className="num">v{v.versao}</td><td className="num sem-quebra">{dataHoraCurta(v.enviadaEm)}</td>
                  <td>{v.origem === "equipe" ? "Lançada pela equipe" : "Fornecedor"}</td>
                  <td className="dir num">{v.itens}</td><td className="dir num">{v.total == null ? "Fechada" : moeda(v.total)}</td>
                  <td className="num">{protocolo(v.resumo, v.versao)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
