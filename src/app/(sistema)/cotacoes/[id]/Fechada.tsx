import { EyeOff } from "lucide-react";
import { dataHoraCurta } from "@/componentes/cotacao/Pecas";
import type { SolicitacaoCompleta } from "@/servicos/cotacoes";

/** Estado das telas de preço enquanto as propostas não podem ser abertas. */
export function Fechada({ s, titulo }: { s: SolicitacaoCompleta; titulo: string }) {
  return (
    <div className="cartao vazio">
      <EyeOff style={{ width: 28, height: 28, marginBottom: 8, opacity: 0.6 }} />
      <b>{titulo}</b>
      {s.situacao === "rascunho" ? "A solicitação ainda não foi enviada."
        : s.situacao === "cancelada" ? "Cotação cancelada."
        : `Propostas fechadas até ${dataHoraCurta(s.prazo)}. ${s.respondidas} de ${s.convites.length} recebidas.`}
    </div>
  );
}
