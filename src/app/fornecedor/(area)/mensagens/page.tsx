import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCheck } from "lucide-react";
import { dataHoraCurta } from "@/componentes/cotacao/Pecas";
import { exigirFornecedor } from "@/lib/sessao";
import { mensagensDoFornecedor } from "@/servicos/fornecedores";
import { acaoMarcarLidas } from "../../acoes";

export const metadata: Metadata = { title: "Avisos · Fornecedor" };

const TIPO: Record<string, string> = { nova: "Nova cotação", prorrogacao: "Prazo prorrogado", reabertura: "Reaberta", cancelamento: "Cancelada", lembrete: "Lembrete", aviso: "Aviso" };

export default async function Mensagens() {
  const f = await exigirFornecedor();
  const lista = await mensagensDoFornecedor(f);
  const novas = lista.filter((m) => !m.lida).length;
  return (
    <div className="grade">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div><div className="sobretitulo">Área do fornecedor</div><h1 className="titulo">Avisos</h1></div>
        {novas > 0 && <form action={acaoMarcarLidas}><button className="botao botao-neutro"><CheckCheck /> Marcar todas como lidas</button></form>}
      </div>
      {lista.length ? (
        <ul className="forn-mensagens">
          {lista.map((m, i) => (
            <li key={m.id} className={`surgir ${m.lida ? "" : "nova"}`} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              <span className="etiqueta et-azul">{TIPO[m.tipo] ?? "Aviso"}</span>
              <b>{m.titulo}</b>
              <span>{m.texto}</span>
              <small>{dataHoraCurta(m.criadoEm)}</small>
              {m.conviteId && <Link href={`/fornecedor/cotacoes/${m.conviteId}`} className="botao botao-texto">Abrir cotação <ArrowRight /></Link>}
            </li>
          ))}
        </ul>
      ) : <div className="cartao vazio"><b>Nenhuma mensagem</b>Novas cotações, prorrogações e lembretes de prazo chegam aqui.</div>}
    </div>
  );
}
