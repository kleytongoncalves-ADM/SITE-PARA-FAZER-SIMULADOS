import Link from "next/link";
import { Pencil } from "lucide-react";
import { EtiquetaSituacao } from "@/componentes/Situacao";
import type { Obra } from "@/servicos/obras";
import { ROTULO_FORMA, ROTULO_TIPO } from "@/servicos/rotulos";

const FUTURAS: [string, number][] = [["Suprimentos", 7], ["Documentos", 8]];

export function CabecalhoObra({ obra, aba, podeEditar }: { obra: Obra; aba: "resumo" | "linha" | "orcamento" | "contrato" | "cronograma" | "medicoes" | "diario" | "qualidade" | "seguranca"; podeEditar: boolean }) {
  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo">
            <Link href="/obras">Obras</Link><span>/</span><span className="num">{obra.codigo}</span>
          </div>
          <h1 className="titulo">{obra.nome}</h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <EtiquetaSituacao situacao={obra.situacao} />
            <span>{ROTULO_TIPO[obra.tipo]} · {ROTULO_FORMA[obra.formaExecucao]}</span>
            {(obra.municipio || obra.uf) && <span>· {[obra.municipio, obra.uf].filter(Boolean).join(" / ")}</span>}
          </p>
        </div>
        {podeEditar && <Link href={`/obras/${obra.id}/editar`} className="botao botao-neutro"><Pencil /> Editar dados</Link>}
      </div>
      <nav className="abas" aria-label="Seções da obra">
        <Link href={`/obras/${obra.id}`} className={`aba ${aba === "resumo" ? "aba-ativa" : ""}`}>Resumo</Link>
        <Link href={`/obras/${obra.id}/orcamento`} className={`aba ${aba === "orcamento" ? "aba-ativa" : ""}`}>Orçamento</Link>
        <Link href={`/obras/${obra.id}/contrato`} className={`aba ${aba === "contrato" ? "aba-ativa" : ""}`}>Contrato</Link>
        <Link href={`/obras/${obra.id}/cronograma`} className={`aba ${aba === "cronograma" ? "aba-ativa" : ""}`}>Cronograma</Link>
        <Link href={`/obras/${obra.id}/medicoes`} className={`aba ${aba === "medicoes" ? "aba-ativa" : ""}`}>Medições</Link>
        <Link href={`/obras/${obra.id}/diario`} className={`aba ${aba === "diario" ? "aba-ativa" : ""}`}>Diário</Link>
        <Link href={`/obras/${obra.id}/qualidade`} className={`aba ${aba === "qualidade" ? "aba-ativa" : ""}`}>Qualidade</Link>
        <Link href={`/obras/${obra.id}/seguranca`} className={`aba ${aba === "seguranca" ? "aba-ativa" : ""}`}>Segurança</Link>
        <Link href={`/obras/${obra.id}/linha-do-tempo`} className={`aba ${aba === "linha" ? "aba-ativa" : ""}`}>Linha do tempo</Link>
        {FUTURAS.map(([nome]) => (
          <span key={nome} className="aba aba-futura" title="Em breve">{nome}</span>
        ))}
      </nav>
    </>
  );
}
