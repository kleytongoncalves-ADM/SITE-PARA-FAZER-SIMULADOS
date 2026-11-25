import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EtiquetaSituacao } from "@/componentes/Situacao";
import { dataCurta } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { contarPorSituacao, listarObras } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { ROTULO_FORMA, ROTULO_SITUACAO, ROTULO_TIPO, SITUACOES } from "@/servicos/rotulos";

export const metadata: Metadata = { title: "Obras" };

export default async function Obras({ searchParams }: { searchParams: Promise<{ busca?: string; situacao?: string }> }) {
  const { busca, situacao } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  const [obras, contagem] = await Promise.all([listarObras(ator, { busca, situacao }), contarPorSituacao(ator)]);
  const total = Object.values(contagem).reduce((a, b) => a + b, 0);
  const link = (s?: string) => {
    const q = new URLSearchParams();
    if (busca) q.set("busca", busca);
    if (s) q.set("situacao", s);
    const t = q.toString();
    return t ? `/obras?${t}` : "/obras";
  };
  const filtrando = !!(busca || situacao);

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Visão geral</div>
          <h1 className="titulo">Obras</h1>
          <p className="subtitulo">
            {pode(ator, "obra.ver_todas") ? "Todas as obras." : "Suas obras."}{" "}
            {busca && <>Resultado da busca por <b>“{busca}”</b>.</>}
          </p>
        </div>
        {pode(ator, "obra.criar") && (
          <Link href="/obras/nova" className="botao botao-primario"><Plus /> Nova obra</Link>
        )}
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        <Link href={link()} className={`chip ${!situacao ? "chip-ativo" : ""}`}>Todas <small className="num">{total}</small></Link>
        {SITUACOES.filter((s) => (contagem[s] ?? 0) > 0 || s === situacao).map((s) => (
          <Link key={s} href={link(s)} className={`chip ${situacao === s ? "chip-ativo" : ""}`}>
            {ROTULO_SITUACAO[s]} <small className="num">{contagem[s] ?? 0}</small>
          </Link>
        ))}
      </div>

      {obras.length === 0 ? (
        <div className="cartao vazio">
          <b>{filtrando ? "Nenhuma obra encontrada" : "Nenhuma obra"}</b>
          {filtrando && <Link href="/obras" className="botao botao-texto">Limpar filtros</Link>}
        </div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead>
              <tr><th>Obra</th><th>Tipo</th><th>Execução</th><th>Local</th><th>Término previsto</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {obras.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/obras/${o.id}`}><span className="forte">{o.nome}</span><br /><span className="fraco num">{o.codigo}</span></Link></td>
                  <td>{ROTULO_TIPO[o.tipo]}</td>
                  <td>{ROTULO_FORMA[o.formaExecucao]}</td>
                  <td>{[o.municipio, o.uf].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="num">{dataCurta(o.dataFimPrevista)}</td>
                  <td><EtiquetaSituacao situacao={o.situacao} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
