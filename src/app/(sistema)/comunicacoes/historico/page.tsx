import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { historicoDeComunicacao } from "@/servicos/comunicacao";

export const metadata: Metadata = { title: "Histórico de envios · Comunicações" };
export const dynamic = "force-dynamic";

const quando = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const SITUACAO: Record<string, { texto: string; cor: string }> = {
  aberto: { texto: "Aberto no e-mail ou WhatsApp da pessoa", cor: "et-neutra" }, enviado: { texto: "Enviado", cor: "et-verde" },
  falhou: { texto: "Não entregue", cor: "et-vermelha" }, sem_servico: { texto: "Serviço desligado", cor: "et-laranja" },
};

export default async function Historico() {
  const a = comoAtor(await exigirUsuario());
  const linhas = await historicoDeComunicacao(a);
  if (!linhas.length) return <div className="cartao vazio"><b>Nada registrado ainda</b>Cada e-mail ou WhatsApp aberto pela equipe e cada envio automático aparecem aqui.</div>;
  return (
    <section className="cartao">
      <div className="tabela-caixa">
        <table className="tabela tabela-compacta">
          <thead><tr><th>Quando</th><th>Canal</th><th>Fornecedor</th><th>Para</th><th>Cotação</th><th>Situação</th><th>Por</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td className="num">{quando(l.criadoEm)}</td>
                <td><span className="hist-canal">{l.canal === "email" ? <Mail /> : <MessageCircle />}{l.canal === "email" ? "E-mail" : "WhatsApp"} · {l.modo === "manual" ? "manual" : "automático"}</span></td>
                <td>{l.fornecedor ?? "—"}</td>
                <td>{l.destino || "—"}</td>
                <td>{l.solicitacaoId ? <Link href={`/cotacoes/${l.solicitacaoId}/fornecedores`}>{l.cotacao}</Link> : "—"}</td>
                <td><span className={`etiqueta ${SITUACAO[l.situacao]?.cor ?? "et-neutra"}`} title={l.erro ?? undefined}>{SITUACAO[l.situacao]?.texto ?? l.situacao}</span></td>
                <td>{l.usuario ?? "Sistema"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
