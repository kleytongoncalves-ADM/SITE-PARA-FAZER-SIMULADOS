"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import type { LeituraIfc } from "@/lib/ifc/quantitativos";
import { acaoRegistrarIfc } from "./acoes";

const LIMITE = 400 * 1024 * 1024;

/** Lê o IFC no navegador e envia só os quantitativos. O arquivo não sai do computador. */
export function LeitorIfc({ orcamentoId }: { orcamentoId: string }) {
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);

  async function ler(arquivo: File) {
    setErro(null);
    if (!/\.ifc$/i.test(arquivo.name)) { setErro("Escolha um arquivo .ifc."); return; }
    if (arquivo.size > LIMITE) { setErro("Arquivo acima de 400 MB. Exporte o modelo por pavimento ou por disciplina."); return; }
    try {
      setEtapa("Abrindo o arquivo…");
      const [{ IfcAPI }, { extrairQuantitativos }, conteudo] = await Promise.all([
        import("web-ifc"), import("@/lib/ifc/quantitativos"), arquivo.arrayBuffer(),
      ]);
      const api = new IfcAPI();
      api.SetWasmPath("/web-ifc/", true);
      await api.Init(undefined, true);
      setEtapa("Medindo os elementos…");
      await new Promise((r) => setTimeout(r, 30));
      let leitura: LeituraIfc;
      const modelo = api.OpenModel(new Uint8Array(conteudo));
      try {
        leitura = extrairQuantitativos(api, modelo);
      } finally {
        api.CloseModel(modelo);
      }
      if (!leitura.grupos.length) { setEtapa(null); setErro("Nenhum elemento construtivo encontrado no arquivo."); return; }
      setEtapa("Gravando…");
      iniciar(async () => {
        const r = await acaoRegistrarIfc(orcamentoId, { arquivo: arquivo.name, tamanho: arquivo.size, leitura });
        if (r?.erro) { setErro(r.erro); setEtapa(null); }
      });
    } catch (e) {
      setEtapa(null);
      const msg = e instanceof Error ? e.message : "";
      setErro(/wasm|aborted/i.test(msg) ? "Não foi possível abrir o leitor de IFC. Recarregue a página e tente de novo." : `Não foi possível ler o arquivo. ${msg}`.trim());
    } finally {
      if (campo.current) campo.current.value = "";
    }
  }

  return (
    <div className="form-linha" style={{ alignItems: "center" }}>
      <label className="botao botao-primario" aria-disabled={!!etapa} style={etapa ? { opacity: 0.7, pointerEvents: "none" } : undefined}>
        <FileUp /> {etapa ?? "Ler arquivo IFC"}
        <input ref={campo} type="file" accept=".ifc" hidden disabled={!!etapa} onChange={(e) => { const f = e.target.files?.[0]; if (f) void ler(f); }} />
      </label>
      {erro && <span className="aviso aviso-erro" role="alert" style={{ margin: 0 }}>{erro}</span>}
    </div>
  );
}
