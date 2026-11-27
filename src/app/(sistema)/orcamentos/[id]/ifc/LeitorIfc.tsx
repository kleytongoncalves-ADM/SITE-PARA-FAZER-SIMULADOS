"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import type { LeituraIfc } from "@/lib/ifc/quantitativos";
import { acaoGuardarModeloIfc, acaoRegistrarIfc } from "./acoes";

const LIMITE = 400 * 1024 * 1024;

/** Lê o IFC no navegador e envia os quantitativos e um modelo 3D leve. O arquivo em si não sai do computador. */
export function LeitorIfc({ orcamentoId }: { orcamentoId: string }) {
  const [etapa, setEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);

  async function ler(arquivo: File) {
    setErro(null);
    if (!/\.ifc$/i.test(arquivo.name)) { setErro("Escolha um arquivo .ifc."); return; }
    if (arquivo.size > LIMITE) { setErro("Arquivo acima de 400 MB. Exporte o modelo por pavimento ou por disciplina."); return; }
    try {
      setEtapa("Abrindo o arquivo…");
      const [{ IfcAPI }, { extrairQuantitativos }, M, conteudo] = await Promise.all([
        import("web-ifc"), import("@/lib/ifc/quantitativos"), import("@/lib/ifc/modelo"), arquivo.arrayBuffer(),
      ]);
      const api = new IfcAPI();
      api.SetWasmPath("/web-ifc/", true);
      await api.Init(undefined, true);
      setEtapa("Medindo os elementos…");
      await new Promise((r) => setTimeout(r, 30));
      let leitura: LeituraIfc;
      let partes: Uint8Array[] = [];
      const modelo = api.OpenModel(new Uint8Array(conteudo));
      try {
        const grupoDoElemento = new Map<number, number>();
        leitura = extrairQuantitativos(api, modelo, grupoDoElemento);
        if (leitura.grupos.length) {
          setEtapa("Preparando o modelo 3D…");
          await new Promise((r) => setTimeout(r, 30));
          try {
            const m3 = M.extrairModelo(api, modelo, grupoDoElemento);
            if (m3.aviso) leitura.avisos.push(m3.aviso);
            if (m3.modelo) {
              partes = M.emPartes(await M.compactar(M.empacotarModelo(m3.modelo)));
              if (partes.length > M.LIMITE_DE_PARTES) { partes = []; leitura.avisos.push("Modelo grande demais para a vista 3D. Os quantitativos foram lidos normalmente."); }
            }
          } catch {
            partes = [];
            leitura.avisos.push("Não foi possível preparar o modelo 3D. Os quantitativos foram lidos normalmente.");
          }
        }
      } finally {
        api.CloseModel(modelo);
      }
      if (!leitura.grupos.length) { setEtapa(null); setErro("Nenhum elemento construtivo encontrado no arquivo."); return; }
      setEtapa("Gravando…");
      const r = await acaoRegistrarIfc(orcamentoId, { arquivo: arquivo.name, tamanho: arquivo.size, leitura });
      if (r.erro || !r.leituraId) { setErro(r.erro ?? "Não foi possível gravar a leitura."); setEtapa(null); return; }
      if (r.modelo3d) {
        for (let i = 0; i < partes.length; i++) {
          setEtapa(`Enviando o modelo 3D (${i + 1} de ${partes.length})…`);
          const f = new FormData();
          f.set("parte", new Blob([partes[i] as BlobPart]));
          const e = await acaoGuardarModeloIfc(orcamentoId, r.leituraId, i, partes.length, f);
          if (e.erro) break; // a leitura vale mesmo sem o modelo 3D
        }
      }
      router.push(`/orcamentos/${orcamentoId}/ifc/${r.leituraId}`);
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
