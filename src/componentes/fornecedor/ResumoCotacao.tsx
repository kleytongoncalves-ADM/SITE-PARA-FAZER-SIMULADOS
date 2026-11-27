import { CalendarClock, ClipboardList, Landmark, MapPin } from "lucide-react";
import { dataHoraCurta, tempoRestante } from "@/componentes/cotacao/Pecas";
import type { ResumoConvite } from "@/servicos/fornecedores";

/** Quem pede, o quê e até quando: o lado do convite na tela de entrada. */
export function ResumoCotacao({ r }: { r: ResumoConvite }) {
  const aberta = r.situacao === "aberta";
  return (
    <aside className="entrada-resumo" aria-label="Solicitação recebida">
      <span className="entrada-resumo-selo">Solicitação de cotação</span>
      <h2>{r.titulo}</h2>
      <ul>
        <li><Landmark /><span><small>Solicitado por</small>{r.orgao}</span></li>
        <li><ClipboardList /><span><small>Cotação nº {String(r.numero).padStart(3, "0")}</small>{r.itens} {r.itens === 1 ? "item" : "itens"} · {r.obra}</span></li>
        <li><CalendarClock /><span><small>{aberta ? "Responder até" : "Prazo"}</small>{dataHoraCurta(r.prazo)}{aberta ? ` · ${tempoRestante(r.prazo)}` : ""}</span></li>
        {r.localEntrega && <li><MapPin /><span><small>Entrega</small>{r.localEntrega}</span></li>}
      </ul>
      <ol className="entrada-passos">
        <li>Cadastre a empresa ou entre com o acesso dela.</li>
        <li>Confira os itens e as quantidades.</li>
        <li>Informe preço e marca de cada item e envie.</li>
      </ol>
    </aside>
  );
}
