"use client";

import { useActionState, useState } from "react";
import { ArrowRightLeft, UserMinus, UserPlus } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { PAPEIS, ROTULO_PAPEL, ROTULO_SITUACAO, type Papel, type Situacao } from "@/servicos/rotulos";
import { acaoEncerrarVinculo, acaoMudarSituacao, acaoVincular, type Estado } from "../acoes";

const DOCUMENTO: Partial<Record<Situacao, string>> = {
  orcada: "Orçamento aprovado (número e data)",
  licitada: "Edital ou aviso de licitação",
  contratada: "Contrato assinado (número)",
  em_execucao: "Ordem de serviço",
  paralisada: "Ofício ou termo de paralisação",
  concluida: "Termo de conclusão ou última medição",
  recebida_provisoriamente: "Termo de recebimento provisório",
  recebida_definitivamente: "Termo de recebimento definitivo",
  cancelada: "Ato de cancelamento",
  em_estudo: "Despacho de retorno ao estudo",
};

export function PainelSituacao({ obraId, proximas }: { obraId: string; proximas: Situacao[] }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoMudarSituacao.bind(null, obraId), {});
  const [para, setPara] = useState<Situacao>(proximas[0]);
  const destino = proximas.includes(para) ? para : proximas[0];
  const pedeMotivo = destino === "paralisada" || destino === "cancelada";
  return (
    <form action={acao} style={{ display: "grid", gap: 12 }}>
      <Avisos erro={estado.erro} ok={estado.ok} />
      <div className="campo">
        <label htmlFor="para">Nova situação</label>
        <select id="para" name="para" className="entrada-texto" value={destino} onChange={(e) => setPara(e.target.value as Situacao)}>
          {proximas.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s]}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="documento">Documento que justifica</label>
        <input id="documento" name="documento" className="entrada-texto" required placeholder={DOCUMENTO[destino]} />
      </div>
      {pedeMotivo && (
        <div className="campo">
          <label htmlFor="justificativa">Motivo</label>
          <textarea id="justificativa" name="justificativa" className="entrada-texto" required />
        </div>
      )}
      <button className="botao botao-primario" disabled={enviando}><ArrowRightLeft />{enviando ? "Registrando…" : "Mudar situação"}</button>
    </form>
  );
}

export function FormVinculo({ obraId, usuarios }: { obraId: string; usuarios: { id: string; nome: string; perfil: string }[] }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoVincular.bind(null, obraId), {});
  return (
    <form action={acao} style={{ display: "grid", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--linha)" }}>
      <Avisos erro={estado.erro} ok={estado.ok} />
      <div className="grade-form">
        <div className="campo c6">
          <label htmlFor="usuarioId">Pessoa</label>
          <select id="usuarioId" name="usuarioId" className="entrada-texto" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.perfil})</option>)}
          </select>
        </div>
        <div className="campo c6">
          <label htmlFor="papel">Papel na obra</label>
          <select id="papel" name="papel" className="entrada-texto" defaultValue="fiscal">
            {PAPEIS.map((p: Papel) => <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>)}
          </select>
        </div>
      </div>
      <button className="botao botao-neutro" disabled={enviando} style={{ justifySelf: "start" }}><UserPlus />{enviando ? "Vinculando…" : "Vincular à obra"}</button>
    </form>
  );
}

export function BotaoEncerrarVinculo({ obraId, vinculoId, nome }: { obraId: string; vinculoId: string; nome: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoEncerrarVinculo.bind(null, obraId, vinculoId), {});
  return (
    <form action={acao} style={{ display: "contents" }}>
      <button className="botao botao-neutro botao-pequeno" disabled={enviando} aria-label={`Encerrar vínculo de ${nome}`} title="Encerrar vínculo">
        <UserMinus />
      </button>
      {estado.erro && <span className="erro" role="alert" style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 600, color: "#c23a3a" }}>{estado.erro}</span>}
    </form>
  );
}
