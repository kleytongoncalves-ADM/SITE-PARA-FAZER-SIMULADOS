"use client";

import { useState, useTransition } from "react";
import { MessagesSquare } from "lucide-react";
import { acaoIniciarConversa } from "../acoes";

export function BotaoConversar({ empresaId }: { empresaId: string }) {
  const [erro, setErro] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  return (
    <>
      <button type="button" className="botao botao-neutro botao-pequeno" disabled={ocupado}
        onClick={() => iniciar(async () => { const r = await acaoIniciarConversa(empresaId); if (r?.erro) setErro(r.erro); })}>
        <MessagesSquare /> {ocupado ? "Abrindo…" : "Iniciar chat"}
      </button>
      {erro && <span className="erro" role="alert">{erro}</span>}
    </>
  );
}
