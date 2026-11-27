import type { Metadata } from "next";
import Link from "next/link";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { formatarCnpj } from "@/servicos/contratos";
import { contatosDeFornecedores } from "@/servicos/comunicacao";
import { pode } from "@/servicos/permissoes";
import { numeroWhatsapp } from "@/servicos/whatsapp";
import { BotaoConversar } from "./BotaoConversar";

export const metadata: Metadata = { title: "Contatos · Comunicações" };

export default async function Contatos() {
  const a = comoAtor(await exigirUsuario());
  const contatos = await contatosDeFornecedores(a);
  const podeEscrever = pode(a, "cotacao.solicitar");
  if (!contatos.length) return <div className="cartao vazio"><b>Nenhum fornecedor</b>Os fornecedores entram aqui quando são convidados para uma cotação.</div>;
  return (
    <section className="cartao">
      <div className="tabela-caixa">
        <table className="tabela">
          <thead><tr><th>Fornecedor</th><th>Responsável</th><th>E-mail</th><th>Telefone</th><th className="dir">Convites</th><th /></tr></thead>
          <tbody>
            {contatos.map((c) => {
              const zap = numeroWhatsapp(c.telefone);
              return (
                <tr key={c.empresaId}>
                  <td>
                    <b>{c.razaoSocial}</b>
                    <div className="fraco num" style={{ fontSize: 12.5 }}>{formatarCnpj(c.cnpj)}</div>
                    {c.contaId ? <span className="etiqueta et-verde">Com cadastro</span> : <span className="etiqueta et-neutra">Sem cadastro</span>}
                  </td>
                  <td>{c.responsavel ?? "—"}</td>
                  <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                  <td className="num">{c.telefone ? (zap ? <a href={`https://wa.me/${zap}`} target="_blank" rel="noopener noreferrer">{c.telefone}</a> : c.telefone) : "—"}</td>
                  <td className="dir num">{c.convites}</td>
                  <td className="dir">
                    {c.conversaId
                      ? <Link href={`/comunicacoes/conversas/${c.conversaId}`} className="botao botao-neutro botao-pequeno">Abrir chat{c.naoLidas ? ` (${c.naoLidas})` : ""}</Link>
                      : c.contaId && podeEscrever ? <BotaoConversar empresaId={c.empresaId} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="cartao-sub" style={{ marginTop: 10 }}>O chat funciona com fornecedores que têm cadastro na área do fornecedor. Os demais recebem pelo seu e-mail ou WhatsApp.</p>
    </section>
  );
}
