import Link from "next/link";
import type { ResumoConversa } from "@/servicos/comunicacao";

const quando = (d: Date | string) => {
  const x = new Date(d);
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  return hoje.format(x) === hoje.format(new Date())
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(x)
    : hoje.format(x);
};

/** Lista de conversas: fornecedor (ou órgão), cotação ligada, último trecho e não lidas. */
export function ListaConversas({ itens, base, ativa, titulo }: { itens: (ResumoConversa & { orgao?: string })[]; base: string; ativa?: string; titulo?: (c: ResumoConversa & { orgao?: string }) => string }) {
  return (
    <ul className="conversas-lista" aria-label="Conversas">
      {itens.map((c) => (
        <li key={c.id}>
          <Link href={`${base}/${c.id}`} className={`conversa-item ${c.id === ativa ? "ativa" : ""} ${c.naoLidas ? "nova" : ""}`} aria-current={c.id === ativa ? "page" : undefined}>
            <span className="conversa-topo">
              <b>{titulo ? titulo(c) : c.fornecedor}</b>
              <time className="num">{quando(c.ultimaEm)}</time>
            </span>
            <span className="conversa-assunto">{c.cotacao ? `Cotação ${c.cotacao}` : "Conversa geral"}</span>
            <span className="conversa-trecho">
              <span>{c.ultimaMensagem ? `${c.ultimoAutor?.split(" · ")[0]}: ${c.ultimaMensagem}` : "Sem mensagens ainda"}</span>
              {c.naoLidas > 0 && <em className="num" aria-label={`${c.naoLidas} não lidas`}>{c.naoLidas}</em>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
