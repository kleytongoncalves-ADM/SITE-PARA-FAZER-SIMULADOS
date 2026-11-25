import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EtiquetaOrcamento } from "@/componentes/EtiquetaOrcamento";
import { dataHora, mesAno, moeda } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { listarOrcamentos, ROTULO_SITUACAO_ORC, rotuloOrcamento, type SituacaoOrcamento } from "@/servicos/orcamentos";
import { pode } from "@/servicos/permissoes";
import { ROTULO_FONTE, ROTULO_REGIME } from "@/servicos/precos";

export const metadata: Metadata = { title: "Orçamentos" };

export default async function Orcamentos({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { situacao } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "orcamento.ver")) {
    return <div className="cartao vazio"><b>Seu perfil não acessa orçamentos</b>Peça o acesso ao administrador do sistema.</div>;
  }
  const todos = await listarOrcamentos(ator);
  const lista = situacao ? todos.filter((o) => o.situacao === situacao) : todos;
  const contagem = todos.reduce<Record<string, number>>((m, o) => ({ ...m, [o.situacao]: (m[o.situacao] ?? 0) + 1 }), {});

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Custos</div>
          <h1 className="titulo">Orçamentos</h1>
        </div>
        {pode(ator, "orcamento.editar") && <Link href="/orcamentos/novo" className="botao botao-primario"><Plus /> Novo orçamento</Link>}
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        <Link href="/orcamentos" className={`chip ${!situacao ? "chip-ativo" : ""}`}>Todos <small className="num">{todos.length}</small></Link>
        {(Object.keys(ROTULO_SITUACAO_ORC) as SituacaoOrcamento[]).filter((s) => contagem[s] || s === situacao).map((s) => (
          <Link key={s} href={`/orcamentos?situacao=${s}`} className={`chip ${situacao === s ? "chip-ativo" : ""}`}>{ROTULO_SITUACAO_ORC[s]} <small className="num">{contagem[s] ?? 0}</small></Link>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum orçamento</b>{pode(ator, "orcamento.editar") && !situacao && <Link href="/orcamentos/novo" className="botao botao-texto">Criar o primeiro</Link>}</div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Orçamento</th><th>Obra</th><th>Base</th><th>Criado</th><th>Situação</th><th className="dir">Total</th></tr></thead>
            <tbody>
              {lista.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/orcamentos/${o.id}`}><span className="forte">{o.nome}</span><br /><span className="fraco num">{rotuloOrcamento(o)}</span></Link></td>
                  <td><Link href={`/obras/${o.obraId}`}>{o.obraNome}<br /><span className="fraco num">{o.obraCodigo}</span></Link></td>
                  <td>{ROTULO_FONTE[o.fonte]} {o.uf} {mesAno(o.mes)}<br /><span className="fraco">{ROTULO_REGIME[o.regime]}</span></td>
                  <td className="num">{dataHora(o.criadoEm)}</td>
                  <td><EtiquetaOrcamento situacao={o.situacao} /></td>
                  <td className="dir num forte">{moeda(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
