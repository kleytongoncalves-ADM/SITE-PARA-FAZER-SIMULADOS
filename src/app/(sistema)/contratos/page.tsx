import type { Metadata } from "next";
import Link from "next/link";
import { Building, Plus } from "lucide-react";
import { EtiquetaContrato } from "@/componentes/Etiquetas";
import { dataCurta, moeda } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { formatarCnpj, listarContratos, ROTULO_SITUACAO_CONTRATO, rotuloContrato, type SituacaoContrato } from "@/servicos/contratos";
import { pode } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Contratos" };

function Vigencia({ dias, situacao }: { dias: number | null; situacao: SituacaoContrato }) {
  if (dias == null || situacao !== "vigente") return null;
  if (dias < 0) return <span className="etiqueta et-vermelha">Vencida</span>;
  if (dias <= 30) return <span className="etiqueta et-vermelha">{dias} dias</span>;
  if (dias <= 90) return <span className="etiqueta et-laranja">{dias} dias</span>;
  return <span className="fraco num">{dias} dias</span>;
}

export default async function Contratos({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { situacao } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "contrato.ver")) {
    return <div className="cartao vazio"><b>Seu perfil não acessa contratos</b>Peça o acesso ao administrador do sistema.</div>;
  }
  const todos = await listarContratos(ator);
  const lista = situacao ? todos.filter((k) => k.situacao === situacao) : todos;
  const contagem = todos.reduce<Record<string, number>>((m, k) => ({ ...m, [k.situacao]: (m[k.situacao] ?? 0) + 1 }), {});
  const vigentes = todos.filter((k) => k.situacao === "vigente");
  const soma = (v: (k: (typeof todos)[number]) => string) => vigentes.reduce((s, k) => s + Number(v(k)), 0);
  const vencendo = vigentes.filter((k) => k.diasParaVencer != null && k.diasParaVencer <= 90).length;

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Contratar</div>
          <h1 className="titulo">Contratos</h1>
        </div>
        <div className="barra-acoes">
          <Link href="/contratos/empresas" className="botao botao-neutro"><Building /> Empresas</Link>
          {pode(ator, "contrato.editar") && <Link href="/contratos/novo" className="botao botao-primario"><Plus /> Novo contrato</Link>}
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Contratos vigentes</span><b className="num">{vigentes.length}</b></div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Valor contratado</span><b className="num">{moeda(soma((k) => k.valorAtual))}</b></div>
        <div className="indicador indicador-destaque surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Saldo a executar</span><b className="num">{moeda(soma((k) => k.saldo))}</b></div>
        <div className="indicador surgir" style={{ "--i": 3 } as React.CSSProperties}><span>Vigência em até 90 dias</span><b className="num">{vencendo}</b></div>
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        <Link href="/contratos" className={`chip ${!situacao ? "chip-ativo" : ""}`}>Todos <small className="num">{todos.length}</small></Link>
        {(Object.keys(ROTULO_SITUACAO_CONTRATO) as SituacaoContrato[]).filter((s) => contagem[s] || s === situacao).map((s) => (
          <Link key={s} href={`/contratos?situacao=${s}`} className={`chip ${situacao === s ? "chip-ativo" : ""}`}>{ROTULO_SITUACAO_CONTRATO[s]} <small className="num">{contagem[s] ?? 0}</small></Link>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum contrato</b>{pode(ator, "contrato.editar") && !situacao && <Link href="/contratos/novo" className="botao botao-texto">Cadastrar o primeiro</Link>}</div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Contrato</th><th>Obra</th><th>Contratada</th><th>Vigência</th><th>Situação</th><th className="dir">Valor atual</th><th className="dir">Saldo</th></tr></thead>
            <tbody>
              {lista.map((k) => (
                <tr key={k.id}>
                  <td><Link href={`/contratos/${k.id}`}><span className="forte">{rotuloContrato(k)}</span><br /><span className="fraco">{k.objeto}</span></Link></td>
                  <td><Link href={`/obras/${k.obraId}`}>{k.obraNome}<br /><span className="fraco num">{k.obraCodigo}</span></Link></td>
                  <td>{k.empresaNome ? <>{k.empresaNome}<br /><span className="fraco num">{formatarCnpj(k.empresaCnpj!)}</span></> : <span className="fraco">Equipe própria</span>}</td>
                  <td className="num">{dataCurta(k.vigenciaFim)}<br /><Vigencia dias={k.diasParaVencer} situacao={k.situacao} /></td>
                  <td><EtiquetaContrato situacao={k.situacao} /></td>
                  <td className="dir num forte">{moeda(k.valorAtual)}</td>
                  <td className="dir num">{moeda(k.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
