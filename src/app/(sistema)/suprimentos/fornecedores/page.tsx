import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { moeda, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { avaliacaoFornecedores } from "@/servicos/suprimentos";

export const metadata: Metadata = { title: "Fornecedores" };
const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export default async function Fornecedores() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "suprimentos.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa os suprimentos</b></div>;
  const lista = (await avaliacaoFornecedores(ator)).sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo"><Link href="/suprimentos">Suprimentos</Link></div><h1 className="titulo">Fornecedores</h1></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pode(ator, "contrato.editar") && <Link href="/contratos/empresas" className="botao botao-neutro">Cadastro de empresas</Link>}
          <Link href="/suprimentos" className="botao botao-neutro"><ArrowLeft /> Suprimentos</Link>
        </div>
      </div>
      {lista.length === 0 ? <div className="cartao vazio"><b>Nenhum fornecedor cadastrado</b></div> : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Fornecedor</th><th className="dir">Pedidos</th><th className="dir">Comprado</th><th className="dir">Entregas no prazo</th><th className="dir">Qualidade</th><th className="dir">Atendimento</th><th className="dir">Recusas</th><th className="dir">Nota</th></tr></thead>
            <tbody>{lista.map((f) => (
              <tr key={f.id}>
                <td><b>{f.razaoSocial}</b><div className="fraco num">{cnpjFmt(f.cnpj)}</div>{f.documentosVencidos > 0 && <span className="etiqueta et-vermelha etiqueta-mini">{f.documentosVencidos} {f.documentosVencidos === 1 ? "certidão vencida" : "certidões vencidas"}</span>}</td>
                <td className="dir num">{f.pedidos}</td>
                <td className="dir num">{moeda(f.valor)}</td>
                <td className="dir num">{f.noPrazo != null ? `${numero(f.noPrazo, 0)}%` : "—"}</td>
                <td className="dir num">{f.qualidade != null ? numero(f.qualidade, 1) : "—"}</td>
                <td className="dir num">{f.atendimento != null ? numero(f.atendimento, 1) : "—"}</td>
                <td className="dir num">{f.recusas || "—"}</td>
                <td className="dir num">{f.nota != null ? <span className={`etiqueta ${f.nota >= 8 ? "et-verde" : f.nota >= 6 ? "et-laranja" : "et-vermelha"}`}>{numero(f.nota, 1)}</span> : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="cartao-sub" style={{ marginTop: 12 }}>Nota de 0 a 10: metade pela pontualidade das entregas, metade pelas notas de qualidade e atendimento dadas no recebimento.</p>
    </>
  );
}
