import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, CircleCheck, Eye, FileSpreadsheet, FileText, Info } from "lucide-react";
import { mesAno, moeda, resumir } from "@/lib/formato";
import type { OrcamentoCompleto } from "@/servicos/orcamentos";
import { ROTULO_FONTE } from "@/servicos/precos";

/** Resumo fixo à direita em todos os passos do orçamento. */
export function ResumoOrcamento({ o, detalhe = true }: { o: OrcamentoCompleto; detalhe?: boolean }) {
  const itens = o.etapas.reduce((s, e) => s + e.itens.length, 0);
  const etapasComItens = o.etapas.filter((e) => e.itens.length > 0);
  const fontes = [...new Set(o.bases.filter((b) => b.principal || b.itens > 0).map((b) => ROTULO_FONTE[b.fonte]))];
  const base = `/orcamentos/${o.id}`;
  return (
    <aside className="resumo-orc" aria-label="Resumo do orçamento">
      <h2 className="resumo-orc-titulo"><BarChart3 /> Resumo do orçamento</h2>
      <div className="resumo-orc-total">
        <span>Total geral (com BDI)</span>
        <b className="num">{moeda(o.totais.total)}</b>
      </div>
      <ul className="resumo-orc-dados">
        <li><CircleCheck /><span>Serviços</span><b className="num">{itens}</b></li>
        <li><CircleCheck /><span>Etapas</span><b className="num">{o.etapas.length}</b></li>
        <li><CircleCheck /><span>Bases</span><b>{fontes.join(", ")}</b></li>
        <li><CircleCheck /><span>Data-base</span><b className="num">{mesAno(o.mes)}</b></li>
      </ul>
      {detalhe && etapasComItens.length > 0 && (
        <ol className="resumo-orc-etapas">
          {etapasComItens.map((e) => (
            <li key={e.id}><span><b className="num">{e.ordem}.</b> {resumir(e.nome, 30)}</span><span className="num">{moeda(e.totais.total)}</span></li>
          ))}
        </ol>
      )}
      {itens > 0 ? (
        <div className="resumo-orc-acoes">
          <Link href={`${base}/planilhas`} className="botao botao-neutro"><Eye /> Visualizar orçamento</Link>
          <a href={`${base}/planilhas/excel?tipo=sintetica`} className="resumo-baixar"><FileSpreadsheet /> Baixar planilha sintética <small>(.xlsx)</small></a>
          <a href={`${base}/planilhas/excel?tipo=analitica`} className="resumo-baixar"><FileSpreadsheet /> Baixar planilha analítica <small>(.xlsx)</small></a>
          <Link href={`${base}/planilhas?ver=ambas&imprimir=1`} className="resumo-baixar"><FileText /> Planilhas em PDF</Link>
        </div>
      ) : (
        <p className="cartao-sub">Os serviços escolhidos aparecem aqui, com o total por etapa.</p>
      )}
      <p className="resumo-orc-nota"><Info /> Cada item guarda a base, o código, a data-base e a composição de onde veio.</p>
    </aside>
  );
}

/** Voltar e Próximo passo, sempre no mesmo lugar. */
export function NavPassos({ voltar, proximo, rotuloProximo = "Próximo passo" }: { voltar?: string; proximo?: string; rotuloProximo?: string }) {
  return (
    <div className="nav-passos nao-imprimir">
      {voltar ? <Link href={voltar} className="botao botao-neutro"><ArrowLeft /> Voltar</Link> : <span />}
      {proximo && <Link href={proximo} className="botao botao-primario">{rotuloProximo} <ArrowRight /></Link>}
    </div>
  );
}
