import type { Metadata } from "next";
import Link from "next/link";
import { EtiquetaMedicao, EtiquetaPagamento } from "@/componentes/Etiquetas";
import { dataCurta, mesAno, moeda, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { rotuloContrato } from "@/servicos/contratos";
import { panoramaMedicoes, rotuloMedicao, type ResumoMedicao } from "@/servicos/medicoes";
import { pode } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Medições" };

const FILTROS = [
  { chave: "", rotulo: "Todas" },
  { chave: "rascunho", rotulo: "Em elaboração" },
  { chave: "atestada", rotulo: "Para aprovar" },
  { chave: "a_pagar", rotulo: "A pagar" },
  { chave: "aprovada", rotulo: "Aprovadas" },
] as const;

export default async function Medicoes({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { situacao = "" } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "medicao.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa medições</b></div>;
  const p = await panoramaMedicoes(ator);
  const filtro = (m: ResumoMedicao) =>
    !situacao ? true : situacao === "a_pagar" ? m.situacaoPagamento === "a_pagar" || m.situacaoPagamento === "parcial" : m.situacao === situacao;
  const lista = p.lista.filter(filtro);

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Contratar</div>
          <h1 className="titulo">Medições</h1>
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador surgir" style={{ "--i": 0 } as React.CSSProperties}><span>Em elaboração</span><b className="num">{p.elaboracao}</b></div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Aguardando aprovação</span><b className="num">{p.paraAprovar}</b>
          <small className="num">{p.tempoMedioAprovacao != null ? `Aprovação em ${numero(p.tempoMedioAprovacao, 1)} dias, em média` : "Sem aprovações ainda"}</small></div>
        <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Aprovado em {mesAno(p.mes)}</span><b className="num">{moeda(p.medidoNoMes)}</b>
          <small className="num">Retido {moeda(p.retidoNoMes)}</small></div>
        <div className="indicador indicador-destaque surgir" style={{ "--i": 3 } as React.CSSProperties}><span>A pagar</span><b className="num">{moeda(p.valorAPagar)}</b>
          <small className="num">{p.aPagar} {p.aPagar === 1 ? "medição" : "medições"}</small></div>
      </div>

      <nav className="abas" aria-label="Filtrar medições">
        {FILTROS.map((f) => (
          <Link key={f.chave} href={f.chave ? `/medicoes?situacao=${f.chave}` : "/medicoes"} className={`aba ${situacao === f.chave ? "aba-ativa" : ""}`}>{f.rotulo}</Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <div className="cartao vazio"><b>Nenhuma medição</b>{p.lista.length === 0 && "A medição é aberta na obra, sobre o contrato assinado."}</div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Medição</th><th>Obra e contrato</th><th>Período</th><th>Situação</th><th className="dir">Medido</th><th className="dir">Líquido</th><th className="dir">Em andamento</th></tr></thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className={m.situacao === "cancelada" ? "linha-apagada" : ""}>
                  <td><Link href={`/medicoes/${m.id}`} className="forte sem-quebra">{rotuloMedicao(m)}</Link></td>
                  <td><Link href={`/obras/${m.obraId}/medicoes`}>{m.obraNome}</Link><br /><span className="fraco num">{m.obraCodigo} · {rotuloContrato({ numero: m.contratoNumero, regime: m.regime })}</span></td>
                  <td className="num">{dataCurta(m.periodoInicio)} a {dataCurta(m.periodoFim)}</td>
                  <td><EtiquetaMedicao situacao={m.situacao} />{m.situacaoPagamento && <> <EtiquetaPagamento situacao={m.situacaoPagamento} /></>}</td>
                  <td className="dir num forte">{moeda(m.bruto)}</td>
                  <td className="dir num">{moeda(m.liquido)}</td>
                  <td className="dir num">{m.situacao === "rascunho" || m.situacao === "atestada" ? `${m.diasEmAndamento} ${m.diasEmAndamento === 1 ? "dia" : "dias"}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
