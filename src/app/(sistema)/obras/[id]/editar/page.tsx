import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterObra, type Obra } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { FormObra } from "../../FormObra";
import { SemAcesso } from "@/componentes/SemAcesso";

export const metadata: Metadata = { title: "Editar obra" };

const br = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export default async function EditarObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  let o: Obra;
  try {
    o = await obterObra(ator, id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  if (!pode(ator, "obra.editar")) {
    return <SemAcesso modulo="a edição de obras" />;
  }
  const iniciais: Record<string, string> = {
    codigo: o.codigo, nome: o.nome, tipo: o.tipo, formaExecucao: o.formaExecucao, endereco: o.endereco ?? "",
    municipio: o.municipio ?? "", uf: o.uf ?? "", latitude: br(o.latitude), longitude: br(o.longitude),
    areaM2: br(o.areaM2), extensaoM: br(o.extensaoM), fonteRecurso: o.fonteRecurso ?? "", convenio: o.convenio ?? "",
    processoAdministrativo: o.processoAdministrativo ?? "", licitacao: o.licitacao ?? "", artNumero: o.artNumero ?? "",
    ordemServicoNumero: o.ordemServicoNumero ?? "", ordemServicoData: o.ordemServicoData ?? "",
    dataInicioPrevista: o.dataInicioPrevista ?? "", dataFimPrevista: o.dataFimPrevista ?? "",
  };
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/obras">Obras</Link><span>/</span><Link href={`/obras/${o.id}`}>{o.codigo}</Link><span>/</span><span>Editar</span></div>
          <h1 className="titulo">Editar obra</h1>
        </div>
      </div>
      <FormObra id={o.id} iniciais={iniciais} cancelar={`/obras/${o.id}`} />
    </>
  );
}
