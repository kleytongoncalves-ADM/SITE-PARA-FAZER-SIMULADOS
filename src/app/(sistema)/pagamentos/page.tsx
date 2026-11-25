import type { Metadata } from "next";
import Link from "next/link";
import { EtiquetaPagamento } from "@/componentes/Etiquetas";
import { dataCurta, moeda } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { rotuloContrato } from "@/servicos/contratos";
import { listarMedicoes, pagamentosRecentes, rotuloMedicao } from "@/servicos/medicoes";
import { pode } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Pagamentos" };

export default async function Pagamentos() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "medicao.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa pagamentos</b></div>;
  const [fila, recentes] = await Promise.all([listarMedicoes(ator, { situacao: "a_pagar" }), pagamentosRecentes(ator)]);
  const aPagar = fila.reduce((s, m) => s + Number(m.liquido) - Number(m.pago), 0);
  const retido = fila.reduce((s, m) => s + Number(m.retencao), 0);
  const pagoNoMes = recentes.filter((p) => p.data.slice(0, 7) === recentes[0]?.mesAtual).reduce((s, p) => s + Number(p.valor), 0);

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Contratar</div>
          <h1 className="titulo">Pagamentos</h1>
        </div>
      </div>

      <div className="indicadores">
        <div className="indicador indicador-destaque surgir" style={{ "--i": 0 } as React.CSSProperties}><span>A pagar</span><b className="num">{moeda(aPagar)}</b>
          <small className="num">{fila.length} {fila.length === 1 ? "medição aprovada" : "medições aprovadas"}</small></div>
        <div className="indicador surgir" style={{ "--i": 1 } as React.CSSProperties}><span>Retenções a recolher</span><b className="num">{moeda(retido)}</b></div>
        <div className="indicador surgir" style={{ "--i": 2 } as React.CSSProperties}><span>Pago no mês</span><b className="num">{moeda(pagoNoMes)}</b></div>
      </div>

      <div className="grade">
        <section className="surgir">
          <h2 className="cartao-titulo" style={{ marginBottom: 10 }}>Medições a pagar</h2>
          {fila.length === 0 ? <div className="cartao vazio"><b>Nada a pagar</b></div> : (
            <div className="tabela-caixa">
              <table className="tabela">
                <thead><tr><th>Medição</th><th>Contratada</th><th>Aprovada em</th><th>Situação</th><th className="dir">Líquido</th><th className="dir">Pago</th><th className="dir">Falta pagar</th></tr></thead>
                <tbody>
                  {fila.map((m) => (
                    <tr key={m.id}>
                      <td><Link href={`/medicoes/${m.id}`} className="forte sem-quebra">{rotuloMedicao(m)}</Link><br /><span className="fraco num">{m.obraCodigo} · {rotuloContrato({ numero: m.contratoNumero, regime: m.regime })}</span></td>
                      <td>{m.empresaNome}</td>
                      <td className="num">{m.aprovadaEm ? dataCurta(new Date(m.aprovadaEm).toISOString().slice(0, 10)) : "—"}</td>
                      <td>{m.situacaoPagamento && <EtiquetaPagamento situacao={m.situacaoPagamento} />}</td>
                      <td className="dir num">{moeda(m.liquido)}</td>
                      <td className="dir num">{moeda(m.pago)}</td>
                      <td className="dir num forte">{moeda(Number(m.liquido) - Number(m.pago))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="surgir">
          <h2 className="cartao-titulo" style={{ marginBottom: 10 }}>Pagamentos registrados</h2>
          {recentes.length === 0 ? <div className="cartao vazio"><b>Nenhum pagamento</b></div> : (
            <div className="tabela-caixa">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Medição</th><th>Contratada</th><th>Empenho</th><th>Ordem bancária</th><th className="dir">Valor</th></tr></thead>
                <tbody>
                  {recentes.map((p) => (
                    <tr key={p.id}>
                      <td className="num">{dataCurta(p.data)}</td>
                      <td><Link href={`/medicoes/${p.medicaoId}`}>{rotuloMedicao(p)}</Link><br /><span className="fraco num">{p.obraCodigo} · contrato {p.contratoNumero}</span></td>
                      <td>{p.empresaNome}</td>
                      <td>{p.empenho}</td>
                      <td>{p.ordemBancaria ?? "—"}</td>
                      <td className="dir num forte">{moeda(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
