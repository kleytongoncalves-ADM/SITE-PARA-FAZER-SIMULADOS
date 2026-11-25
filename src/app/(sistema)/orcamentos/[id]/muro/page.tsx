import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PADRAO_MURO } from "@/servicos/assistente-muro";
import { carregarOrcamento } from "../carregar";
import { AssistenteMuro } from "./AssistenteMuro";

export const metadata: Metadata = { title: "Assistente de muro" };

export default async function Muro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { editavel } = await carregarOrcamento(id);
  if (!editavel) redirect(`/orcamentos/${id}`);
  return (
    <div className="grade">
      <div>
        <Link href={`/orcamentos/${id}`} className="botao botao-texto" style={{ paddingLeft: 0 }}><ArrowLeft /> Planilha</Link>
        <h2 className="titulo" style={{ fontSize: 22, marginTop: 4 }}>Assistente de muro</h2>
      </div>
      <AssistenteMuro id={id} padrao={PADRAO_MURO} />
    </div>
  );
}
