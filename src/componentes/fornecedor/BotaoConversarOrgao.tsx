"use client";

import { useState, useTransition } from "react";
import { MessagesSquare } from "lucide-react";
import { acaoConversarComOrgao } from "@/app/fornecedor/acoes";

/** Abre (ou retoma) a conversa com quem pediu a cotação. */
export function BotaoConversarOrgao({ conviteId, orgao }: { conviteId: string; orgao: string }) {
  const [erro, setErro] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <button type="button" className="botao botao-neutro botao-pequeno" disabled={ocupado} title={`Conversar com ${orgao}`}
        onClick={() => iniciar(async () => { const r = await acaoConversarComOrgao(conviteId); if (r?.erro) setErro(r.erro); })}>
        <MessagesSquare /> {ocupado ? "Abrindo…" : "Conversar"}
      </button>
      {erro && <span className="erro" role="alert">{erro}</span>}
    </span>
  );
}
