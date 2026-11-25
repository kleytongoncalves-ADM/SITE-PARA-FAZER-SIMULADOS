import type { Metadata } from "next";
import { ArrowRightLeft, CalendarRange, Calculator, FilePlus2, FileSignature, Ruler, Users } from "lucide-react";
import { dataHora } from "@/lib/formato";
import { linhaDoTempo } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Linha do tempo" };

const ICONE = { situacao: ArrowRightLeft, equipe: Users, cadastro: FilePlus2, orcamento: Calculator, contrato: FileSignature, cronograma: CalendarRange, medicao: Ruler } as const;

export default async function LinhaDoTempo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, obra } = await carregarObra(id);
  const eventos = await linhaDoTempo(ator, id);
  return (
    <>
      <CabecalhoObra obra={obra} aba="linha" podeEditar={pode(ator, "obra.editar")} />
      <section className="cartao">
        <h2 className="cartao-titulo">Linha do tempo</h2>
        <ol className="linha-tempo">
          {eventos.map((e, i) => {
            const Icone = ICONE[e.tipo as keyof typeof ICONE] ?? FilePlus2;
            return (
              <li key={e.id} className="surgir" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
                <span className="ponto"><Icone /></span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{e.resumo}</div>
                  <div className="cartao-sub num">{dataHora(new Date(e.quando))}{e.autor ? ` · ${e.autor}` : ""}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
